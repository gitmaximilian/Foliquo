import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, rename, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import {networkFetch} from './diagnostics.mjs';

export const ISSUER = 'https://auth.openai.com';
export const RESOURCE = 'https://api.openai.com/v1';
const TOKEN_ENDPOINT = `${ISSUER}/api/accounts/oauth/token`;
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));
export const random = () => randomBytes(32).toString('base64url');

export async function verifyIdentity(token, clientId, nonce, keySet = JWKS) {
  const { payload } = await jwtVerify(token, keySet, {
    issuer: ISSUER, audience: clientId, algorithms: ['RS256'],
    requiredClaims: ['sub', 'exp', 'iat'], clockTolerance: 5,
  });
  if (!payload.sub || (nonce !== undefined && payload.nonce !== nonce)) throw new Error('Die Identitätsprüfung ist fehlgeschlagen. Bitte erneut anmelden.');
  return payload;
}
export function createAuthorization(hostId, clientId, redirectUri) {
  const verifier = random(), state = random(), nonce = random();
  const url = new URL(`${ISSUER}/api/accounts/authorize`);
  url.search = new URLSearchParams({
    client_id: clientId || 'dynamic_agent_client', ext_agent_host_id: hostId,
    ...(!clientId ? { agent_name_hint: 'TranslateOCR' } : {}),
    response_type: 'code', redirect_uri: redirectUri,
    scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
    resource: RESOURCE, state, nonce, code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
  }).toString();
  return { url: url.href, verifier, state, nonce, clientId, redirectUri, expiresAt: Date.now() + 600000 };
}
export function consumeCallback(pending, url, browserSession) {
  if (!pending || pending.expiresAt < Date.now() || pending.session !== browserSession || url.searchParams.get('state') !== pending.state) throw new Error('Die Anmeldung ist abgelaufen oder passt nicht zu dieser Sitzung. Bitte erneut verbinden.');
  if (url.searchParams.has('error')) throw new Error('Die Anmeldung oder Planfreigabe wurde nicht abgeschlossen. Bitte erneut verbinden und die gewünschten Berechtigungen prüfen.');
  const returnedId = url.searchParams.get('client_id');
  if (pending.clientId && returnedId && returnedId !== pending.clientId) throw new Error('Die Konto-Registrierung stimmt nicht überein.');
  const clientId = pending.clientId || returnedId;
  const code = url.searchParams.get('code');
  if (!code || !clientId || clientId === 'dynamic_agent_client') throw new Error('OpenAI hat keine vollständige Registrierung zurückgegeben.');
  return { code, clientId };
}
export function publicError(error) {
  const code = error?.code || '';
  if (/usage_limit|usage_unavailable|rate_limit/.test(code)) return 'Dein ChatGPT-Nutzungslimit ist erreicht oder die Plan-Nutzung ist derzeit nicht verfügbar. Prüfe deine ChatGPT-Einstellungen und versuche es später erneut.';
  if (/invalid_grant|invalid_token|unauthorized/.test(code)) return 'Die ChatGPT-Verbindung ist abgelaufen. Bitte erneut verbinden.';
  return 'OpenAI konnte die Anfrage nicht abschließen. Bitte Modell, Planfreigabe und Verbindung prüfen.';
}
async function exchange(params, fetcher = fetch) {
  const response = await networkFetch(TOKEN_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...params, resource: RESOURCE }), signal: AbortSignal.timeout(30000) },{stage:params.grant_type==='refresh_token'?'token_refresh':'token_exchange'},fetcher);
  const tokens = await response.json();
  if (!response.ok) { const error = new Error(publicError({code: tokens.error})); error.code = tokens.error;error.context={stage:params.grant_type==='refresh_token'?'token_refresh':'token_exchange',httpStatus:response.status,host:'auth.openai.com',requestId:response.headers.get('x-request-id')};throw error; }
  if (typeof tokens.access_token !== 'string' || !Number.isFinite(tokens.expires_in)) throw new Error('Die Anmeldung hat keine verwendbaren Zugangsdaten geliefert.');
  return tokens;
}
export class ChatGPTConnection {
  constructor(directory) { this.directory = directory; this.data = { hostId: `urn:uuid:${randomUUID()}` }; this.refreshing = null; }
  async init() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 }); await chmod(this.directory, 0o700);
    try { this.data = JSON.parse(await readFile(join(this.directory, 'chatgpt.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw new Error('Lokale ChatGPT-Konfiguration konnte nicht gelesen werden.'); await this.save(); }
  }
  async save() { const path = join(this.directory, 'chatgpt.json'), tmp = `${path}.${random()}.tmp`; await writeFile(tmp, JSON.stringify(this.data), { mode: 0o600 }); await rename(tmp, path); await chmod(path, 0o600); }
  get connected() { return Boolean(this.data.credentials?.access_token); }
  get planEnabled() { return this.data.credentials?.scopes?.includes('chatgpt.tokens.use.direct') || false; }
  status() { return { connected: this.connected, planEnabled: this.planEnabled, email: this.data.email || null }; }
  async finish(pending, url, session) {
    const {code, clientId} = consumeCallback(pending, url, session);
    // Retain the issued registration even if the code exchange fails. Never reuse the code.
    if (!this.data.clientId) { this.data.clientId = clientId; await this.save(); }
    const tokens = await exchange({ grant_type: 'authorization_code', client_id: clientId, code, code_verifier: pending.verifier, redirect_uri: pending.redirectUri });
    const identity = await verifyIdentity(tokens.id_token, clientId, pending.nonce);
    if (this.data.subject && identity.sub !== this.data.subject) throw new Error('Bitte mit demselben persönlichen ChatGPT-Konto anmelden.');
    this.data.clientId = clientId; this.data.subject = identity.sub; this.data.email = identity.email || null;
    this.data.credentials = { ...tokens, scopes: String(tokens.scope || '').split(' '), expiresAt: Date.now() + tokens.expires_in * 1000 };
    await this.save();
  }
  async accessToken() {
    if (!this.connected || !this.planEnabled) throw new Error('Bitte zuerst ChatGPT verbinden und die Nutzung deines Plans freigeben.');
    if (this.data.credentials.expiresAt > Date.now() + 60000) return this.data.credentials.access_token;
    if (!this.refreshing) this.refreshing = this.refresh().finally(() => { this.refreshing = null; });
    return this.refreshing;
  }
  async refresh() {
    const old = this.data.credentials;
    if (!old.refresh_token) throw new Error('Bitte ChatGPT erneut verbinden.');
    const tokens = await exchange({ grant_type: 'refresh_token', client_id: this.data.clientId, refresh_token: old.refresh_token });
    if (tokens.id_token) { const identity = await verifyIdentity(tokens.id_token, this.data.clientId); if (identity.sub !== this.data.subject) throw new Error('Das erneuerte Konto stimmt nicht überein.'); }
    this.data.credentials = { ...old, ...tokens, scopes: tokens.scope ? tokens.scope.split(' ') : old.scopes, expiresAt: Date.now() + tokens.expires_in * 1000 };
    await this.save();
    if (!this.planEnabled) throw new Error('Die Planfreigabe fehlt. Bitte ChatGPT erneut verbinden.');
    return this.data.credentials.access_token;
  }
  async disconnect() {
    const credentials = this.data.credentials; let revoked = !credentials?.refresh_token;
    try {
      if (credentials?.refresh_token) {
        const discovery = await fetch(`${ISSUER}/.well-known/openid-configuration`, {signal: AbortSignal.timeout(15000)}).then(r => r.json());
        const endpoint = new URL(discovery.revocation_endpoint);
        if (endpoint.origin !== ISSUER || endpoint.protocol !== 'https:') throw new Error('Invalid revocation endpoint');
        const response = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:credentials.refresh_token,token_type_hint:'refresh_token',client_id:this.data.clientId}),signal:AbortSignal.timeout(15000)});
        revoked = response.ok;
      }
    } catch { /* Local sign-out must still succeed. */ }
    delete this.data.credentials;this.modelCache=null;await this.save(); return revoked;
  }
  async models() {
    const token = await this.accessToken();
    if(this.modelCache&&this.modelCache.until>Date.now())return this.modelCache.models;
    const response = await networkFetch(`${RESOURCE}/models`, {headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)},{stage:'model_catalog'});
    if (!response.ok) {const error=new Error(publicError({code:response.status === 401 ? 'unauthorized' : ''}));error.pauseQueue=[401,403,429].includes(response.status);error.context={stage:'model_catalog',host:'api.openai.com',httpStatus:response.status,requestId:response.headers.get('x-request-id')};throw error;}
    const data = await response.json();
    const models=(data.models || data.data || []).filter(m => !m.visibility || m.visibility === 'list').map(m => ({id:m.slug || m.id, name:m.display_name || m.id || m.slug})).filter(m => m.id && m.name);
    this.modelCache={until:Date.now()+60000,models};return models;
  }
}
export async function readResponseStream(body, onProgress = () => {}) {
  const decoder = new TextDecoder(); let buffer = '', text = '', completed = false;
  function event(block) {
    const data = block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
    if (!data || data === '[DONE]') return;
    const item = JSON.parse(data);
    if (item.type === 'response.output_text.delta') { text += item.delta || ''; onProgress(text.length); }
    if (item.type === 'response.failed' || item.type === 'error') {const detail=item.response?.error||item.error||item,error=new Error(publicError(detail));error.code=detail.code;throw error;}
    if (item.type === 'response.incomplete') throw new Error('Die Übersetzung wurde nicht vollständig erzeugt. Es wird keine fertige PDF ausgegeben. Bitte erneut versuchen.');
    if (item.type === 'response.completed') { completed = true; const final = item.response?.output?.flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('\n'); if (final) text = final; }
  }
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, {stream:true}); buffer = buffer.replace(/\r\n/g,'\n');
    let end; while ((end = buffer.indexOf('\n\n')) !== -1) { event(buffer.slice(0,end)); buffer = buffer.slice(end+2); }
    if (text.length > 1500000 || buffer.length > 3000000) throw new Error('Die Antwort ist zu groß. Bitte weniger Seiten auf einmal übersetzen.');
  }
  buffer += decoder.decode(); if (buffer.trim()) event(buffer);
  if (!completed || !text.trim()) throw new Error('Die Übersetzung ist nicht vollständig angekommen. Bitte erneut versuchen.');
  return text;
}
