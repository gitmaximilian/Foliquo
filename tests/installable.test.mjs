import {CURRENT_VERSION} from '../lib/version.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createApp} from '../server.mjs';

const source=path=>readFile(new URL(path,import.meta.url),'utf8');
test('the user interface is browser-only and provides a clean localized work path',async()=>{
 const html=await source('../dist/index.html'),pkg=JSON.parse(await source('../package.json'));
 for(const view of ['studio','documents','review','workspace','guide'])assert.ok(html.includes(`<section id="${view}-view"`),`missing ${view} view`);
 assert.doesNotMatch(html,/dossiers-view|data-view="dossiers"|manifest\.webmanifest|service-worker|install-app|Private workspace|Dein privater Workflow|DEINE FASSUNG · DEIN FEINSCHLIFF/);
 assert.match(html,/Bildausschnitt auswählen/);assert.match(html,/id="scan-crop-stage"/);assert.match(html,/id="update-check"/);assert.match(html,/id="update-download"/);
 assert.equal(pkg.main,undefined);assert.equal(pkg.build,undefined);assert.equal(pkg.devDependencies,undefined);
 assert.ok(!Object.keys(pkg.scripts).some(k=>k.startsWith('desktop:')));
});

test('one-click setup and browser launchers exist for the three desktop operating systems',async()=>{
 for(const path of ['../Setup-Foliquo.cmd','../Setup-Foliquo.command','../Setup-Foliquo.sh','../Start-Foliquo.cmd','../Start-Foliquo.command','../Start-Foliquo.sh','../scripts/start-browser.mjs'])assert.ok((await stat(new URL(path,import.meta.url))).isFile(),`missing ${path}`);
 const script=await source('../scripts/start-browser.mjs');assert.match(script,/http:\/\/127\.0\.0\.1/);assert.match(script,/process\.platform==='darwin'/);assert.match(script,/xdg-open/);
 for(const path of ['../Setup-Foliquo.cmd','../Setup-Foliquo.command','../Setup-Foliquo.sh'])assert.match(await source(path),/scripts[\\/]start-browser\.mjs/,`${path} should open Foliquo when setup finishes`);
});

test('setup page explains browser-only use and keeps local workspace during manual updates',async()=>{
 const html=await source('../dist/index.html'),readme=await source('../README.md');assert.match(html,/Foliquo aktualisieren/);assert.match(html,/\.local/);assert.match(readme,/browser-based workspace/);assert.match(readme,/Keep the hidden `\.local` folder/);
 assert.match(readme,/Setup prepares the required tools.*then opens Foliquo in your browser/);assert.match(readme,/You do not need to enter commands/);
});

test('update check reports a newer GitHub release without exposing any workspace data',async t=>{
 const port=15982,connection={data:{},status:()=>({connected:false})};const app=createApp({connection,port,fetcher:async()=>new Response(JSON.stringify({tag_name:'v99.0.0',published_at:'2026-10-24T00:00:00Z'}),{status:200,headers:{'content-type':'application/json'}})});
 await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});t.after(()=>new Promise(resolve=>app.close(resolve)));
 const base=`http://127.0.0.1:${port}`,root=await fetch(base),cookie=root.headers.get('set-cookie').split(';')[0],result=await fetch(`${base}/api/update-check`,{headers:{cookie}}).then(r=>r.json());
 assert.equal(result.current,CURRENT_VERSION);assert.equal(result.latest,'99.0.0');assert.equal(result.updateAvailable,true);assert.equal(result.url,'https://github.com/gitmaximilian/Foliquo/archive/refs/tags/v99.0.0.zip');assert.equal(Object.hasOwn(result,'documents'),false);
});

test('browser service no longer exposes native-app or PWA install endpoints',async t=>{
 const port=15983,app=createApp({connection:{data:{},status:()=>({connected:false})},port});await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});t.after(()=>new Promise(resolve=>app.close(resolve)));
 const base=`http://127.0.0.1:${port}`,root=await fetch(base),cookie=root.headers.get('set-cookie').split(';')[0];for(const path of ['/manifest.webmanifest','/service-worker.js','/install.js'])assert.equal((await fetch(`${base}${path}`,{headers:{cookie}})).status,404,path);
});
