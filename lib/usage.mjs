import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';

export const USAGE_SCHEMA = 1;
export const PRICE_VERSION = '2026-10-29';
const MAX_ENTRIES = 5000;
const DAY = 86400000;
const number = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

// Public list prices, USD per million tokens. These are estimates; negotiated
// discounts, taxes and provider-side adjustments are not available locally.
const OPENAI = {
 'gpt-6-astra': { input: 10, output: 50, cachedInput: 1, cacheWrite5m: 12.5, cacheWrite12h: 25, longContext: { input: 20, output: 75, cachedInput: 2, cacheWrite5m: 25, cacheWrite12h: 50 } },
 'gpt-6.1-sol': { input: 2, output: 10, cachedInput: .1, cacheWrite5m: 2.5, cacheWrite12h: 5, longContext: { input: 4, output: 15, cachedInput: .2, cacheWrite5m: 5, cacheWrite12h: 10 } },
 'gpt-6.1-terra': { input: 1, output: 5, cachedInput: .05, cacheWrite5m: 1.25, cacheWrite12h: 2.5, longContext: { input: 2, output: 10, cachedInput: .1, cacheWrite5m: 2.5, cacheWrite12h: 5 } },
 'gpt-6-sol': { input: 2, output: 10, cachedInput: .2, cacheWrite5m: 2.5, cacheWrite12h: 5 },
 'gpt-6-luna': { input: .1, output: .5, cachedInput: .01, cacheWrite5m: .125, cacheWrite12h: .25, longContext: { input: .2, output: .75, cachedInput: .02, cacheWrite5m: .25, cacheWrite12h: .5 } },
};
const CLAUDE = {
 'claude-fable-5-1': { input: 10, output: 50, cachedInput: .25, cacheWrite5m: 12.5, cacheWrite1h: 20 },
 'claude-opus-5-5': { input: 4, output: 20, cachedInput: .2, cacheWrite5m: 5, cacheWrite1h: 8 },
 'claude-sonnet-5-5': { input: 2, output: 10, cachedInput: .1, cacheWrite5m: 2.5, cacheWrite1h: 4 },
 'claude-haiku-5-5': { input: .1, output: .5, cachedInput: .01, cacheWrite5m: .125, cacheWrite1h: .2, longContext: { input: .5, output: 2.5, cachedInput: .05, cacheWrite5m: .625, cacheWrite1h: 1 } },
 'claude-fable-5': { input: 10, output: 50, cachedInput: 1, cacheWrite5m: 12.5, cacheWrite1h: 20 },
 'claude-opus-5': { input: 5, output: 25, cachedInput: .5, cacheWrite5m: 6.25, cacheWrite1h: 10 },
 'claude-opus-4-8': { input: 5, output: 25, cachedInput: .5, cacheWrite5m: 6.25, cacheWrite1h: 10 },
 'claude-opus-4-7': { input: 5, output: 25, cachedInput: .5, cacheWrite5m: 6.25, cacheWrite1h: 10 },
 'claude-opus-4-6': { input: 5, output: 25, cachedInput: .5, cacheWrite5m: 6.25, cacheWrite1h: 10 },
 'claude-opus-4-5': { input: 5, output: 25, cachedInput: .5, cacheWrite5m: 6.25, cacheWrite1h: 10 },
 'claude-opus-4-1': { input: 15, output: 75, cachedInput: 1.5, cacheWrite5m: 18.75, cacheWrite1h: 30 },
 'claude-opus-4': { input: 15, output: 75, cachedInput: 1.5, cacheWrite5m: 18.75, cacheWrite1h: 30 },
 'claude-sonnet-5': { input: 2, output: 10, cachedInput: .2, cacheWrite5m: 2.5, cacheWrite1h: 4 },
 'claude-sonnet-4-6': { input: 3, output: 15, cachedInput: .3, cacheWrite5m: 3.75, cacheWrite1h: 6 },
 'claude-sonnet-4-5': { input: 3, output: 15, cachedInput: .3, cacheWrite5m: 3.75, cacheWrite1h: 6 },
 'claude-sonnet-4': { input: 3, output: 15, cachedInput: .3, cacheWrite5m: 3.75, cacheWrite1h: 6 },
 'claude-haiku-4-5': { input: 1, output: 5, cachedInput: .1, cacheWrite5m: 1.25, cacheWrite1h: 2 },
 'claude-haiku-3-5': { input: .8, output: 4, cachedInput: .08, cacheWrite5m: 1, cacheWrite1h: 1.6 },
};
const DEEPSEEK = {
 'deepseek-flash': { inputMiss: [.15, .3], inputHit: [.003, .006], output: [.6, 1.2] },
 'deepseek-v4-pro': { inputMiss: [.66, 1.32], inputHit: [.022, .044], output: [1.98, 3.96] },
};

function datedModel(model, table) {
 const value = String(model || '').toLowerCase();
 return Object.keys(table).find(id => value === id || value.startsWith(id + '-'));
}

function usdRange(provider, model, usage) {
 const input = number(usage?.inputTokens), output = number(usage?.outputTokens);
 if (input === null || output === null) return null;
 const cached = Math.min(input, number(usage?.cachedInputTokens) ?? 0);
 const created5m = number(usage?.cacheWrite5mTokens) ?? 0;
 const created1h = number(usage?.cacheWrite1hTokens) ?? 0;
 const ordinary = Math.max(0, input - cached - created5m - created1h);
 const price = perMillion => perMillion / 1_000_000;
 if (provider === 'openai') {
  if ((number(usage?.cacheWriteTokens) ?? 0) > 0) return null;
  const base = OPENAI[datedModel(model, OPENAI)];if(!base)return null;
  const rate = base.longContext&&input>272_000?base.longContext:base;
  const write12=number(usage?.cacheWrite12hTokens)??0,write5=number(usage?.cacheWrite5mTokens)??created5m,knownWrites=write12+write5;
  const uncategorized=Math.max(0,input-cached-knownWrites),low=uncategorized*rate.input+cached*rate.cachedInput+write5*rate.cacheWrite5m+write12*rate.cacheWrite12h+output*rate.output,high=uncategorized*rate.cacheWrite5m+cached*rate.cachedInput+write5*rate.cacheWrite5m+write12*rate.cacheWrite12h+output*rate.output;
  return { low: price(low), high: price(high) };
 }
 if (provider === 'anthropic') {
  if ((number(usage?.cacheWriteTokens) ?? 0) > 0 && (created5m + created1h) === 0) return null;
  let rate = CLAUDE[datedModel(model, CLAUDE)];
  if (!rate) return null;
  const totalPrompt = input;
  if (rate.longContext && totalPrompt > 100_000) rate = rate.longContext;
  return { low: price(ordinary * rate.input + cached * rate.cachedInput + created5m * rate.cacheWrite5m + created1h * rate.cacheWrite1h + output * rate.output), high: price(ordinary * rate.input + cached * rate.cachedInput + created5m * rate.cacheWrite5m + created1h * rate.cacheWrite1h + output * rate.output) };
 }
 if (provider === 'deepseek') {
  const rate = DEEPSEEK[datedModel(model, DEEPSEEK)];
  if (!rate) return null;
  return {
   low: price(ordinary * rate.inputMiss[0] + cached * rate.inputHit[0] + output * rate.output[0]),
   high: price(ordinary * rate.inputMiss[1] + cached * rate.inputHit[1] + output * rate.output[1]),
  };
 }
 return null;
}

export function newUsageRequest({ provider, model, operation, jobId = null, accountScope = null }, now = Date.now()) {
 return { id: randomUUID(), provider: String(provider || 'unknown').slice(0, 40), model: String(model || 'unknown').slice(0, 180), operation: String(operation || 'model_request').slice(0, 40), jobId: typeof jobId === 'string' ? jobId.slice(0, 80) : null, ...(typeof accountScope==='string'&&/^[a-f0-9]{16}$/.test(accountScope)?{accountScope}:{}), startedAt: now, finishedAt: null, status: 'in_flight', completed: false, inputTokens: null, outputTokens: null, totalTokens: null, cachedInputTokens: null, cacheWriteTokens: null, cacheWrite5mTokens: null, cacheWrite1hTokens: null, cacheWrite12hTokens: null, reasoningTokens: null, estimatedCost: null, priceVersion: PRICE_VERSION };
}

export async function estimateRequestCost(provider,model,request){
 if(!['openai','anthropic','deepseek'].includes(provider))return null;
 let textCharacters=0,imagePages=0,pdfPages=0;
 try{for(const item of request?.input||[])for(const part of item.content||[]){if(part.type==='input_text')textCharacters+=String(part.text||'').length;else if(part.type==='input_image')imagePages++;else if(part.type==='input_file'){const match=String(part.file_data||'').match(/^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/);if(!match)return null;const pdf=await PDFDocument.load(Buffer.from(match[1],'base64'),{ignoreEncryption:false,updateMetadata:false});pdfPages+=pdf.getPageCount();}}}catch{return null;}
 const pages=imagePages+pdfPages,inputTokens=Math.max(1,Math.ceil(textCharacters/3)+imagePages*20000+pdfPages*25000),outputTokens=Math.max(1200,pages*4000+Math.ceil(textCharacters/60));
 const cost=usdRange(provider,model,{inputTokens,outputTokens});return cost?{...cost,inputTokens,outputTokens,pages,method:'conservative-local-estimate'}:null;
}

export function mergeUsageRequest(entries, id, rawUsage, { complete = false, responseId = null, errorCode = null } = {}, now = Date.now()) {
 const entry = entries.find(item => item.id === id);
 if (!entry) return null;
 if(typeof responseId==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(responseId)){
  const duplicate=entries.find(item=>item!==entry&&!item.duplicateOf&&item.provider===entry.provider&&(item.accountScope||'')===(entry.accountScope||'')&&item.responseId===responseId);
  if(duplicate){entry.responseId=responseId;entry.duplicateOf=duplicate.id;entry.completed=true;entry.status='complete';entry.finishedAt=now;entry.estimatedCost=null;delete entry.preflightCostEstimate;delete entry.uncertainCostUSDHigh;return entry;}
 }
 const input = number(rawUsage?.inputTokens), output = number(rawUsage?.outputTokens);
 const cached = number(rawUsage?.cachedInputTokens), write = number(rawUsage?.cacheWriteTokens), write5m = number(rawUsage?.cacheWrite5mTokens), write1h = number(rawUsage?.cacheWrite1hTokens), write12h = number(rawUsage?.cacheWrite12hTokens), reasoning = number(rawUsage?.reasoningTokens);
 if (input !== null) entry.inputTokens = input;
 if (output !== null) entry.outputTokens = output;
 if (cached !== null) entry.cachedInputTokens = cached;
 if (write !== null) entry.cacheWriteTokens = write;
 if (write5m !== null) entry.cacheWrite5mTokens = write5m;
 if (write1h !== null) entry.cacheWrite1hTokens = write1h;
 if (write12h !== null) entry.cacheWrite12hTokens = write12h;
 if (reasoning !== null) entry.reasoningTokens = reasoning;
 if (entry.inputTokens !== null && entry.outputTokens !== null) entry.totalTokens = entry.inputTokens + entry.outputTokens;
 if (complete) { entry.completed = true; entry.status = entry.inputTokens !== null && entry.outputTokens !== null ? 'complete' : 'unknown'; }
 else if (entry.inputTokens !== null || entry.outputTokens !== null) entry.status = 'partial';
 else if (errorCode) entry.status = 'unknown';
 if (complete || errorCode) entry.finishedAt = now;
 if (typeof responseId === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(responseId)) entry.responseId = responseId;
 if (typeof errorCode === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(errorCode)) entry.errorCode = errorCode;
 entry.estimatedCost = entry.inputTokens !== null && entry.outputTokens !== null && (number(entry.cacheWriteTokens) ?? 0) === 0 ? usdRange(entry.provider, entry.model, entry) : null;
 return entry;
}

function safeCost(value) {
 return value && Number.isFinite(value.low) && value.low >= 0 && Number.isFinite(value.high) && value.high >= value.low
  ? { low: value.low, high: value.high } : null;
}
function safeUsageEntry(entry) {
 if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || entry.id.length > 80 || !Number.isFinite(entry.startedAt)) return null;
 const status = ['in_flight', 'partial', 'unknown', 'complete'].includes(entry.status) ? entry.status : 'unknown';
 const token = key => number(entry[key]);
 return {
  id: entry.id, provider: String(entry.provider || 'unknown').slice(0, 40), model: String(entry.model || 'unknown').slice(0, 180), operation: String(entry.operation || 'model_request').slice(0, 40),
  jobId: typeof entry.jobId === 'string' ? entry.jobId.slice(0, 80) : null, ...(typeof entry.accountScope==='string'&&/^[a-f0-9]{16}$/.test(entry.accountScope)?{accountScope:entry.accountScope}:{}), startedAt: entry.startedAt, finishedAt: Number.isFinite(entry.finishedAt) ? entry.finishedAt : null, status, completed: entry.completed === true,
  inputTokens: token('inputTokens'), outputTokens: token('outputTokens'), totalTokens: token('totalTokens'), cachedInputTokens: token('cachedInputTokens'), cacheWriteTokens: token('cacheWriteTokens'), cacheWrite5mTokens: token('cacheWrite5mTokens'), cacheWrite1hTokens: token('cacheWrite1hTokens'), cacheWrite12hTokens: token('cacheWrite12hTokens'), reasoningTokens: token('reasoningTokens'),
  estimatedCost: safeCost(entry.estimatedCost), priceVersion: typeof entry.priceVersion === 'string' ? entry.priceVersion.slice(0, 20) : PRICE_VERSION,
  ...(safeCost(entry.preflightCostEstimate)?{preflightCostEstimate:safeCost(entry.preflightCostEstimate)}:{}),
  ...(Number.isFinite(entry.uncertainCostUSDHigh)&&entry.uncertainCostUSDHigh>=0?{uncertainCostUSDHigh:entry.uncertainCostUSDHigh}:{}),
  ...(typeof entry.duplicateOf==='string'&&entry.duplicateOf.length<=80?{duplicateOf:entry.duplicateOf}:{}),
  ...(typeof entry.responseId === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(entry.responseId) ? { responseId: entry.responseId } : {}),
  ...(typeof entry.errorCode === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(entry.errorCode) ? { errorCode: entry.errorCode } : {}),
 };
}

export function pruneUsage(entries, { now = Date.now(), retentionDays = 365, maxEntries = MAX_ENTRIES } = {}) {
 const cutoff = now - Math.max(1, Math.min(3650, retentionDays)) * DAY;
 return (Array.isArray(entries) ? entries.map(safeUsageEntry).filter(Boolean) : []).filter(entry => entry.startedAt >= cutoff).sort((a, b) => a.startedAt - b.startedAt).slice(-Math.max(1, maxEntries));
}

export function usageSummary(entries, { days = 30, fromMs = null, toMs = null, now = Date.now(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } = {}) {
 const rangeDays = Math.max(1, Math.min(365, Number.isInteger(days) ? days : 30));
 const cutoff = now - rangeDays * DAY;
 const bounded=Number.isSafeInteger(fromMs)&&Number.isSafeInteger(toMs)&&fromMs>=0&&toMs>fromMs&&toMs-fromMs<=367*DAY;
 const recent = (Array.isArray(entries) ? entries.map(safeUsageEntry).filter(Boolean) : []).filter(entry => (bounded?entry.startedAt>=fromMs&&entry.startedAt<toMs:entry.startedAt>=cutoff)&&!entry.duplicateOf);
 const aggregate = (items, key) => {
  const requests = items.length;
  const completeRequests = items.filter(x => x.completed === true).length;
  const partialRequests = items.filter(x => x.status === 'partial').length;
  const unknownRequests = items.filter(x => ['in_flight', 'partial', 'unknown'].includes(x.status) || x.inputTokens === null || x.outputTokens === null).length;
  const inputTokens = items.reduce((sum, x) => sum + (x.inputTokens ?? 0), 0);
  const outputTokens = items.reduce((sum, x) => sum + (x.outputTokens ?? 0), 0);
  const knownCosts = items.map(x => x.estimatedCost).filter(x => x && Number.isFinite(x.low) && Number.isFinite(x.high));
  return { ...(key ? { [key[0]]: key[1] } : {}), requests, completeRequests, partialRequests, unknownRequests, knownTokenRequests: items.filter(x => x.inputTokens !== null && x.outputTokens !== null).length, inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, tokenTotalsPartial: unknownRequests > 0, unpricedRequests: items.filter(x => x.completed === true && !x.estimatedCost).length, estimatedCostUSDLow: knownCosts.reduce((sum, x) => sum + x.low, 0), estimatedCostUSDHigh: knownCosts.reduce((sum, x) => sum + x.high, 0) };
 };
 const groups = (field) => [...new Set(recent.map(x => x[field] || 'unknown'))].map(value => aggregate(recent.filter(x => (x[field] || 'unknown') === value), [field, value]));
 const providers = groups('provider');
 const operationMap = [...new Set(recent.map(x => x.operation || 'model_request'))].map(value => aggregate(recent.filter(x => x.operation === value), ['operation', value]));
 const operationsByProvider = [...new Set(recent.map(x => `${x.provider || 'unknown'}\0${x.operation || 'model_request'}`))].map(pair => { const [provider, operation] = pair.split('\0'); return { ...aggregate(recent.filter(x => x.provider === provider && x.operation === operation), ['operation', operation]), provider }; });
 let dateFor;
 try { const format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }); dateFor = time => format.format(new Date(time)); }
 catch { timeZone = 'UTC'; const format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }); dateFor = time => format.format(new Date(time)); }
 const dayKeys = [...new Set(recent.map(entry => dateFor(entry.startedAt)))].sort();
 const daily = dayKeys.map(date => ({ ...aggregate(recent.filter(entry => dateFor(entry.startedAt) === date)), date }));
 const jobGroups = new Map(); for (const entry of recent) if (entry.jobId) { const group = jobGroups.get(entry.jobId) || { items: [], latest: 0 }; group.items.push(entry); group.latest = Math.max(group.latest, entry.startedAt); jobGroups.set(entry.jobId, group); } const jobs = [...jobGroups].map(([jobId, group]) => ({ jobId, ...aggregate(group.items), lastUsedAt: group.latest })).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
 const records = recent.slice().sort((a, b) => b.startedAt - a.startedAt).slice(0, 40).map(({ responseId, errorCode, accountScope, ...entry }) => ({ ...entry, durationMs: Number.isFinite(entry.finishedAt) ? Math.max(0, entry.finishedAt - entry.startedAt) : null }));
 return { days: rangeDays, ...(bounded?{fromMs,toMs}:{}), timeZone, generatedAt: now, totals: aggregate(recent), providers, operations: operationMap, operationsByProvider, daily, jobs, records, note: 'Tokenverbrauch stammt vom Anbieter. USD-Beträge sind geschätzte Listenpreise, keine Anbieterrechnung. Fehlende Messwerte bleiben unbekannt; Summen enthalten nur gemeldete Werte.' };
}
