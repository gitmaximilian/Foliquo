import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {seedInstalledLegacy,localClient,verifyLegacy,seedPersonalState,verifyPersonalState,verifyStoredPersonal,seedConversationMessages} from '../scripts/upgrade-fixtures.mjs';
import {Workspace} from '../lib/workspace.mjs';
import {createApp} from '../server.mjs';

test('installer fixtures exercise real encrypted stores, API contracts, retained owner and usage without provider calls',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-fictional-upgrade-fixtures-')),service=join(directory,'fixture-service'),data=join(directory,'data');await mkdir(join(service,'lib'),{recursive:true});
 // These wrappers exercise the fixture contract locally. Only the Windows
 // installer gate imports the actual old installed 0.12.0 runtime.
 for(const name of ['workspace','usage','data-directory'])await writeFile(join(service,'lib',name+'.mjs'),`export * from ${JSON.stringify(new URL('../lib/'+name+'.mjs',import.meta.url).href)};`);
 const legacy=seedInstalledLegacy(service,data,{node:process.execPath}),key=await readFile(join(data,'workspace.key'));let app,workspace,calls=0;
 const start=async()=>{workspace=await new Workspace(data).init();const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));app=createApp({workspace,port,connection:{data:{}},provider:{id:'fixture',selected:'fixture',status:()=>({connected:false,planEnabled:false}),models:async()=>[],respond:async()=>{calls++;throw new Error('No fixture provider requests');}}});await new Promise(resolve=>app.listen(port,'127.0.0.1',resolve));return `http://127.0.0.1:${port}`;};
 const stop=async()=>{await app.flushWorkspace();app.closeAllConnections();await new Promise(resolve=>app.close(resolve));app=null;};
 t.after(async()=>{if(app)await stop();await rm(directory,{recursive:true,force:true});});
 const client=await localClient(await start()),profile=await verifyLegacy(client,legacy),state=await seedPersonalState(client);assert.equal(state.rule.status,'active');await stop();seedConversationMessages(service,data,client,state,{node:process.execPath});const restarted=await localClient(await start(),client.cookie);assert.deepEqual(await verifyLegacy(restarted,legacy),profile);const retained=await verifyPersonalState(restarted,state);assert.equal(retained.ruleId,state.rule.id);assert.deepEqual(await readFile(join(data,'workspace.key')),key);assert.equal(calls,0);await stop();assert.equal(verifyStoredPersonal(service,data,client,state,{node:process.execPath}).dataPaths,true);
});
