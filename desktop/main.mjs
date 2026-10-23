import { app, BrowserWindow, dialog, shell } from 'electron';
import { createServer as createProbe } from 'node:net';
import { join, resolve } from 'node:path';
import { ChatGPTConnection } from '../lib/chatgpt.mjs';
import { Workspace } from '../lib/workspace.mjs';
import { createApp } from '../server.mjs';

app.setName('TranslateOCR');
app.setPath('userData', process.env.TRANSLATEOCR_DESKTOP_DATA_DIR
  ? resolve(process.env.TRANSLATEOCR_DESKTOP_DATA_DIR)
  : join(app.getPath('appData'), 'TranslateOCR'));
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let window = null;
let service = null;
let workspace = null;
let connection = null;
let baseUrl = '';
let connectionWasOpen = false;
let closing = false;

function available(port) {
  return new Promise(resolve => {
    const probe = createProbe();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}

async function choosePort() {
  for (let port = 4318; port <= 4330; port++) if (await available(port)) return port;
  throw new Error('Kein freier TranslateOCR-Port gefunden. Bitte andere lokale Anwendungen schließen.');
}

function openExternal(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') void shell.openExternal(parsed.href);
  } catch { /* Ignore malformed or non-web targets. */ }
}

async function makeWindow() {
  if (!service) {
    const port = await choosePort();
    const dataDirectory = join(app.getPath('userData'), '.local');
    connection = await new ChatGPTConnection(dataDirectory).init();
    workspace = await new Workspace(dataDirectory).init();
    service = createApp({ connection, workspace, port, allowExternalOAuthCallback: true });
    service.requestTimeout = 300000;
    await new Promise((resolve, reject) => {
      service.once('error', reject);
      service.listen(port, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${port}/`;
    connectionWasOpen = connection.connected;
  }

  window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 820,
    minHeight: 620,
    title: 'TranslateOCR',
    autoHideMenuBar: true,
    backgroundColor: '#f7f8f6',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  window.webContents.on('will-navigate', (event, target) => {
    if (target !== baseUrl && !target.startsWith(baseUrl)) {
      event.preventDefault();
      openExternal(target);
    }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  window.on('closed', () => { window = null; });
  await window.loadURL(baseUrl);

  const poll = setInterval(() => {
    if (!window || window.isDestroyed()) { clearInterval(poll); return; }
    if (!connectionWasOpen && connection.connected) {
      connectionWasOpen = true;
      window.webContents.reload();
      window.show();
      window.focus();
    }
  }, 1000);
  poll.unref?.();
}

if (gotLock) {
  app.on('second-instance', () => {
    if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); }
  });

  app.whenReady().then(async () => {
    try { await makeWindow(); }
    catch (error) {
      await dialog.showMessageBox({ type: 'error', title: 'TranslateOCR konnte nicht starten', message: error.message || 'Der lokale Dienst konnte nicht gestartet werden.' });
      app.quit();
    }
  });

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void makeWindow(); });
  app.on('before-quit', event => {
    if (closing || !service) return;
    event.preventDefault();
    closing = true;
    service.close(async () => {
      try { await workspace?.tail; } catch { /* Preserve the user's workspace; report on next start if needed. */ }
      app.exit(0);
    });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
