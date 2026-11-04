import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {probeService} from '../lib/launcher.mjs';

test('launcher refuses an unrelated server on the selected port',async t=>{
 const server=http.createServer((req,res)=>res.end('unrelated service'));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 await assert.rejects(probeService(server.address().port),/another application/);
});
test('launcher tolerates a slow first health response from a cold local service',async t=>{
 const server=http.createServer((req,res)=>setTimeout(()=>res.end(JSON.stringify({application:'foliquo',protocol:1})),1300));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 assert.deepEqual(await probeService(server.address().port),{application:'foliquo',protocol:1});
});
test('installed CLI starts from another working directory, reuses the service and stops with authorization',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-launch-test-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const portServer=http.createServer();await new Promise(resolve=>portServer.listen(0,'127.0.0.1',resolve));const port=portServer.address().port;await new Promise(resolve=>portServer.close(resolve));
 const cli=fileURLToPath(new URL('../bin/foliquo.mjs',import.meta.url)),env={...process.env,FOLIQUO_DATA_DIR:directory,FOLIQUO_PORT:String(port),FOLIQUO_NO_BROWSER:'1'};
 const child=spawn(process.execPath,[cli],{cwd:tmpdir(),env,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);t.after(()=>child.kill());
 let health;for(let i=0;i<600;i++){health=await probeService(port);if(health)break;if(child.exitCode!==null)throw new Error(output);await delay(100);}
 assert.equal(health?.application,'foliquo',output);
 assert.equal((await fetch(`http://127.0.0.1:${port}/api/lifecycle/stop`,{method:'POST'})).status,403);
 const run=args=>new Promise((resolve,reject)=>{const p=spawn(process.execPath,[cli,...args],{cwd:tmpdir(),env});let out='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>out+=b);p.on('error',reject);p.on('close',code=>resolve({code,out}));});
 const repeated=await run([]);assert.equal(repeated.code,0,repeated.out);assert.match(repeated.out,/already running/);
 const other=await run(['--data-dir',join(directory,'other')]);assert.equal(other.code,1);assert.match(other.out,/another workspace/);
 const stopped=await run(['stop']);assert.equal(stopped.code,0,stopped.out);
 await new Promise(resolve=>child.exitCode!==null?resolve():child.once('close',resolve));
 assert.equal(await probeService(port),null);assert.ok((await readFile(join(directory,'workspace.enc'))).length>32);
});
