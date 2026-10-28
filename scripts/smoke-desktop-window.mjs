import {spawn, spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {basename,join} from 'node:path';
import {readFile,readdir,rm} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';

if (process.platform !== 'win32') throw new Error('This native window smoke check runs on Windows only.');
const installerDirectory = join(process.cwd(), 'desktop/src-tauri/target/release/bundle/nsis');
const installerName = (await readdir(installerDirectory)).find(name => name.endsWith('-setup.exe'));
if (!installerName) throw new Error('The Windows NSIS installer was not produced.');
const installDir = join(tmpdir(), 'foliquo-window-install-' + randomUUID());
const installer = spawnSync(join(installerDirectory, installerName), ['/S', '/D=' + installDir], {
  cwd: process.cwd(),
  stdio: 'inherit',
  timeout: 120000,
  windowsHide: true
});
if (installer.error) throw installer.error;
if (installer.status !== 0) throw new Error('The Windows desktop installer failed with exit code ' + installer.status + '.');

async function findInstalledApp(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const path = join(directory, entry.name);
    if (entry.isFile() && basename(path).toLowerCase() === 'foliquo-desktop.exe') return path;
    if (entry.isDirectory()) {
      const found = await findInstalledApp(path);
      if (found) return found;
    }
  }
  return null;
}

const executable = await findInstalledApp(installDir);
if (!executable) throw new Error('The Windows installer did not install foliquo-desktop.exe.');
const portServer = createServer();
const debugPort = await new Promise((resolve, reject) => {
  portServer.once('error', reject);
  portServer.listen(0, '127.0.0.1', () => {
    const address = portServer.address();
    portServer.close(() => resolve(address.port));
  });
});
const dataDir = join(tmpdir(), 'foliquo-window-smoke-' + randomUUID());
const child = spawn(executable, [], {
  cwd: installDir,
  env: {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=' + debugPort,
    FOLIQUO_DATA_DIR: dataDir,
    FOLIQUO_LOG_DIR: join(dataDir, 'logs'),
    FOLIQUO_NO_BROWSER: '1'
  },
  stdio: 'ignore',
  windowsHide: false
});
let exited = false;
let exitCode = null;
child.once('exit', code => { exited = true; exitCode = code; });
let socket;
const pending = new Map();
const browserErrors = [];
let commandId = 0;
async function stopOwnedService() {
  let record;
  try { record = JSON.parse(await readFile(join(dataDir, 'service.json'), 'utf8')); } catch { return; }
  if (!Number.isInteger(record.pid) || !Number.isInteger(record.port) || !record.instance || !record.token) return;
  const healthUrl = 'http://127.0.0.1:' + record.port + '/api/health';
  try {
    const health = await fetch(healthUrl, {signal: AbortSignal.timeout(1000)}).then(response => response.json());
    if (health.application !== 'foliquo' || health.instance !== record.instance) return;
    await fetch('http://127.0.0.1:' + record.port + '/api/lifecycle/stop', {
      method: 'POST',
      headers: {authorization: 'Bearer ' + record.token},
      signal: AbortSignal.timeout(3000)
    });
  } catch {}
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const health = await fetch(healthUrl, {signal: AbortSignal.timeout(300)}).then(response => response.json());
      if (health.instance !== record.instance) return;
    } catch { return; }
    await delay(100);
  }
  spawnSync('taskkill.exe', ['/pid', String(record.pid), '/t', '/f'], {stdio: 'ignore'});
}
function cdp(method, params = {}) {
  const id = ++commandId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Timed out waiting for WebView2 command ' + method));
    }, 5000);
    pending.set(id, {resolve, reject, timer});
    socket.send(JSON.stringify({id, method, params}));
  });
}
try {
  let target;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline && !target) {
    if (exited) throw new Error('Foliquo desktop exited before its WebView rendered (exit ' + exitCode + ').');
    try {
      const response = await fetch('http://localhost:' + debugPort + '/json/list', {signal: AbortSignal.timeout(1000)});
      const targets = await response.json();
      target = targets.find(item => item.type === 'page' && item.webSocketDebuggerUrl);
    } catch {}
    if (!target) await delay(300);
  }
  if (!target) throw new Error('Windows WebView2 did not expose a page target within 60 seconds.');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  socket.addEventListener('message', event => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.method === 'Runtime.exceptionThrown') {
      browserErrors.push(message.params?.exceptionDetails?.exception?.description || message.params?.exceptionDetails?.text || 'JavaScript exception');
      return;
    }
    if (message.method === 'Log.entryAdded' && message.params?.entry?.level === 'error') {
      browserErrors.push(message.params.entry.text || 'WebView error');
      return;
    }
    if (!message.id) return;
    const waiting = pending.get(message.id);
    if (!waiting) return;
    clearTimeout(waiting.timer);
    pending.delete(message.id);
    if (message.error) waiting.reject(new Error(message.error.message || 'WebView2 command failed.'));
    else waiting.resolve(message);
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out connecting to the Windows WebView2 page.')), 10000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, {once: true});
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Could not connect to the Windows WebView2 page.')); }, {once: true});
  });
  // Runtime.evaluate works without enabling the event streams. Some hosted
  // WebView2 builds expose the page target but never answer Runtime.enable.
  const expression = "(()=>{const s=document.querySelector('.app-shell');const main=document.querySelector('#main-content');const body=(s?.innerText||document.body?.innerText||'').trim();return {url:location.href,title:document.title,ready:document.readyState,desktop:window.__FOLIQUO_DESKTOP__===true,shell:!!s,main:!!main,body:body.slice(0,1200),bodyLength:body.length,styles:document.styleSheets.length,background:getComputedStyle(document.body).backgroundColor}})()";
  let state;
  const renderDeadline = Date.now() + 30000;
  while (Date.now() < renderDeadline) {
    const response = await cdp('Runtime.evaluate', {expression, returnByValue: true});
    state = response.result?.result?.value;
    if (state?.url?.startsWith('http://127.0.0.1:') && state.ready === 'complete' && state.shell && state.main && state.desktop && state.styles > 0 && state.bodyLength >= 40) break;
    await delay(400);
  }
  if (!state?.url?.startsWith('http://127.0.0.1:') || state.ready !== 'complete' || !state.shell || !state.main || !state.desktop || state.styles < 1 || state.bodyLength < 40) {
    const serviceLog = await readFile(join(dataDir, 'logs', 'desktop-service.log'), 'utf8').catch(() => '');
    throw new Error('The native window did not render the Foliquo workspace: ' + JSON.stringify({state, browserErrors: browserErrors.slice(-20), serviceLog: serviceLog.slice(-5000)}));
  }
  console.log('Windows WebView2 rendered the Foliquo workspace: ' + JSON.stringify(state));
} finally {
  try { socket?.close(); } catch {}
  await stopOwnedService();
  if (!exited) {
    if (child.pid) spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {stdio: 'ignore'});
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(10000)]);
  }
  await stopOwnedService();
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await rm(installDir, {recursive: true, force: true});
      await rm(dataDir, {recursive: true, force: true});
      break;
    } catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt === 7) throw error;
      await delay(500 * (attempt + 1));
    }
  }
}
