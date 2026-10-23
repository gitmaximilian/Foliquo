import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {createApp} from '../server.mjs';
import {readFile as readUtf8} from 'node:fs/promises';

test('PWA manifest has standalone launch metadata and valid install icons',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../dist/manifest.webmanifest',import.meta.url),'utf8'));
  assert.equal(manifest.name,'TranslateOCR');assert.equal(manifest.start_url,'/');assert.equal(manifest.display,'standalone');
  for(const [file,size] of [['icon-192.png',192],['icon-512.png',512]]){
    assert.ok(manifest.icons.some(icon=>icon.src.endsWith(file)&&icon.sizes===`${size}x${size}`));
    const metadata=await sharp(fileURLToPath(new URL(`../dist/icons/${file}`,import.meta.url))).metadata();assert.equal(metadata.width,size);assert.equal(metadata.height,size);
  }
});

test('PWA offline cache is an explicit static allowlist with no document, session, or API caching',async()=>{
  const worker=await readFile(new URL('../dist/service-worker.js',import.meta.url),'utf8');
  assert.match(worker,/const STATIC = \[/);assert.match(worker,/url\.pathname\.startsWith\('\/api\/'\)/);assert.match(worker,/url\.pathname\.startsWith\('\/auth\/'\)/);
  assert.doesNotMatch(worker,/\/api\/translate|\/api\/preview|\/api\/session|index\.html|workspace\.enc/);
  for(const path of ['/style.css','/app.js','/install.js','/manifest.webmanifest'])assert.ok(worker.includes(`'${path}'`));
});

test('macOS and Linux one-click launcher entry points exist in the release',async()=>{
  const launcher=await readFile(new URL('../scripts/launch-desktop.mjs',import.meta.url),'utf8');
  const installer=await readFile(new URL('../scripts/install-desktop.mjs',import.meta.url),'utf8');
  const command=await stat(new URL('../Install-Desktop.command',import.meta.url));
  assert.match(launcher,/detached:true/);assert.match(launcher,/127\.0\.0\.1/);assert.match(installer,/process\.platform==='darwin'/);assert.match(installer,/process\.platform==='linux'/);if(process.platform!=='win32')assert.ok(command.mode&0o111);
});

test('Desktop packaging builds private local windows for Windows, macOS and Linux',async()=>{
  const pkg=JSON.parse(await readUtf8(new URL('../package.json',import.meta.url),'utf8'));
  const main=await readUtf8(new URL('../desktop/main.mjs',import.meta.url),'utf8');
  const release=await readUtf8(new URL('../.github/workflows/desktop-release.yml',import.meta.url),'utf8');
  const ico=await readUtf8(new URL('../desktop/icons/TranslateOCR.ico',import.meta.url));
  const icns=await readUtf8(new URL('../desktop/icons/TranslateOCR.icns',import.meta.url));
  assert.equal(pkg.main,'desktop/main.mjs');assert.equal(pkg.build.win.target[0],'nsis');assert.ok(pkg.build.mac.target.includes('dmg'));assert.ok(pkg.build.linux.target.includes('deb'));
  assert.equal(ico.readUInt16LE(2),1);assert.equal(icns.toString('ascii',0,4),'icns');
  assert.match(main,/nodeIntegration:\s*false/);assert.match(main,/contextIsolation:\s*true/);assert.match(main,/sandbox:\s*true/);assert.match(main,/allowExternalOAuthCallback:\s*true/);assert.match(main,/127\.0\.0\.1/);
  assert.match(release,/windows-latest/);assert.match(release,/macos-latest/);assert.match(release,/macos-15-intel/);assert.match(release,/ubuntu-latest/);assert.match(release,/gh release create/);
});

test('local server serves the install manifest and icons without creating sessions for static assets',async t=>{
  const port=15592,connection={data:{},status:()=>({connected:false})},app=createApp({connection,port});
  await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});
  t.after(()=>new Promise(resolve=>app.close(resolve)));
  const base=`http://127.0.0.1:${port}`;
  const root=await fetch(base);assert.ok(root.headers.get('set-cookie'));
  const manifest=await fetch(`${base}/manifest.webmanifest`);assert.match(manifest.headers.get('content-type'),/application\/manifest\+json/);assert.equal(manifest.headers.get('set-cookie'),null);assert.equal((await manifest.json()).display,'standalone');
  const icon=await fetch(`${base}/icons/icon-192.png`);assert.match(icon.headers.get('content-type'),/image\/png/);assert.equal(Buffer.from(await icon.arrayBuffer()).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const worker=await fetch(`${base}/service-worker.js`);assert.match(worker.headers.get('content-type'),/javascript/);assert.equal(worker.headers.get('service-worker-allowed'),'/');
});
