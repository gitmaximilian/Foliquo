import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as createNetServer} from 'node:net';
import {Workspace} from '../lib/workspace.mjs';
import {createApp,APP_CSP} from '../server.mjs';

async function availablePort(){const server=createNetServer();await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));const {port}=server.address();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));return port;}

test('local HTML pages carry a restrictive content security policy',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-csp-')),workspace=await new Workspace(directory).init(),port=await availablePort(),origin=`http://127.0.0.1:${port}`;
 const server=createApp({connection:{data:{},status:()=>({connected:false,planEnabled:false})},workspace,port});await new Promise((resolve,reject)=>server.once('error',reject).listen(port,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});});
 for(const path of ['/','/demo/']){const response=await fetch(origin+path);assert.equal(response.status,200,path);assert.equal(response.headers.get('content-security-policy'),APP_CSP,path);}
 const script=await fetch(origin+'/app.js');assert.equal(script.headers.get('content-security-policy'),null);
 for(const directive of ["default-src 'self'","script-src 'self' 'wasm-unsafe-eval'","object-src 'none'","base-uri 'none'","frame-ancestors 'none'"])assert.ok(APP_CSP.includes(directive),directive);
 assert.doesNotMatch(APP_CSP,/script-src[^;]*'unsafe-inline'|script-src[^;]*'unsafe-eval'|https?:/);
});

test('the app and demo pages need no inline scripts or inline event handlers',async()=>{
 for(const file of ['dist/index.html','dist/demo/index.html']){const html=await readFile(new URL(`../${file}`,import.meta.url),'utf8');assert.doesNotMatch(html,/<script(?![^>]*\bsrc=)[^>]*>/,file);assert.doesNotMatch(html,/\son[a-z]+="/,file);}
});

test('local OCR loads the bundled engine explicitly',async()=>{
 const source=await readFile(new URL('../dist/source-text.js',import.meta.url),'utf8');
 assert.match(source,/module\.createWorker\|\|module\.default\?\.createWorker/);
 const core=source.match(/tesseract\/core\/([a-z-]+\.wasm\.js)/)?.[1];assert.ok(core);
 await access(new URL(`../dist/vendor/tesseract/core/${core}`,import.meta.url));await access(new URL(`../dist/vendor/tesseract/core/${core.replace(/\.js$/,'')}`,import.meta.url));
});
