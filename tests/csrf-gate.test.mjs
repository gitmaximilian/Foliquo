import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createServer as createNetServer} from 'node:net';
import {join} from 'node:path';
import {Workspace} from '../lib/workspace.mjs';
import {createApp} from '../server.mjs';

async function availablePort(){const server=createNetServer();await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));const {port}=server.address();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));return port;}

async function start(t){
 const directory=await mkdtemp(join(tmpdir(),'foliquo-csrf-')),workspace=await new Workspace(directory).init(),port=await availablePort(),origin=`http://127.0.0.1:${port}`;
 const server=createApp({connection:{data:{},status:()=>({connected:false,planEnabled:false})},workspace,port});await new Promise((resolve,reject)=>server.once('error',reject).listen(port,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});});
 const page=await fetch(origin),cookie=page.headers.get('set-cookie').split(';')[0],session=await fetch(origin+'/api/session',{headers:{cookie}}).then(response=>response.json());
 assert.match(String(session.csrf),/^.{16,}$/);return {workspace,origin,cookie,csrf:session.csrf};
}

// Every state-changing route must require the same-origin header and the session CSRF token,
// including routes that are matched before the general POST handler.
const routes=[
 ['POST','/api/dossiers',{name:'Fictional dossier'}],
 ['POST','/api/import-batches/preview',{files:[]}],
 ['POST','/api/import-batches',{files:[]}],
 ['POST','/api/import-batches/12345678-1234-4234-8234-123456789abc/pause',{}],
 ['POST','/api/usage/consent-once',{confirm:true,provider:'openai',model:'fictional-model',scopeId:'fictional'}],
 ['POST','/api/dossiers/12345678-1234-4234-8234-123456789abc/entities',{name:'Alex Example'}],
 ['POST','/api/dossiers/12345678-1234-4234-8234-123456789abc/facts',{key:'name',value:'Alex Example'}],
 ['DELETE','/api/dossiers/12345678-1234-4234-8234-123456789abc',{confirm:true}],
 ['POST','/api/settings',{retentionDays:30}],
];

test('state-changing routes reject requests without origin and CSRF token',async t=>{
 const {workspace,origin,cookie,csrf}=await start(t);
 const variants=[
  ['no origin, no token',{cookie,'content-type':'text/plain'}],
  ['foreign origin with token',{cookie,origin:'http://127.0.0.1:1','content-type':'application/json','x-foliquo-csrf':csrf}],
  ['same origin without token',{cookie,origin,'content-type':'application/json'}],
  ['same origin with wrong token',{cookie,origin,'content-type':'application/json','x-foliquo-csrf':'wrong'}],
 ];
 for(const [method,path,payload] of routes)for(const [label,headers] of variants){
  const response=await fetch(origin+path,{method,headers,body:JSON.stringify(payload)});
  assert.equal(response.status,403,`${method} ${path} (${label})`);
 }
 assert.equal(workspace.data.dossiers.length,0);
 assert.equal(workspace.data.settings.usageBudgetConsentOnce,undefined);
});

test('state-changing routes still accept same-origin requests with the session token',async t=>{
 const {workspace,origin,cookie,csrf}=await start(t);
 const response=await fetch(origin+'/api/dossiers',{method:'POST',headers:{cookie,origin,'content-type':'application/json','x-foliquo-csrf':csrf},body:JSON.stringify({name:'Fictional dossier'})});
 assert.equal(response.status,200);
 assert.equal(workspace.data.dossiers.length,1);
});
