import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {Workspace} from '../lib/workspace.mjs';
import {createApp} from '../server.mjs';

async function setup(t){
 const directory=await mkdtemp(join(tmpdir(),'foliquo-fictional-rule-api-')),workspace=await new Workspace(directory).init();
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 let requests=0;const provider={id:'fixture',selected:'fixture',status:()=>({connected:false,planEnabled:false}),models:async()=>[],respond:async()=>{requests++;throw new Error('Rule management must not call a provider.');}};
 const app=createApp({workspace,port,provider,connection:{data:{}}});await new Promise(resolve=>app.listen(port,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>app.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});});
 const origin=`http://127.0.0.1:${port}`,home=await fetch(origin),cookie=home.headers.get('set-cookie').split(';')[0],session=await fetch(origin+'/api/session',{headers:{cookie}}).then(response=>response.json());
 const call=async(path,input,extra={})=>{const response=await fetch(origin+path,{method:input===undefined?'GET':'POST',headers:{cookie,origin,'content-type':'application/json','x-foliquo-csrf':session.csrf,...extra},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:response.status,data:await response.json()};};
 return {workspace,call,requests:()=>requests};
}
const definition={title:'Fictional spacing',effect:{kind:'layout',key:'lineHeight',value:'1,5'},scope:{targetLanguage:'Deutsch'}};
test('rule HTTP flow requires approval, preserves request identity and previews job exclusions without a provider',async t=>{
 const {workspace,call,requests}=await setup(t);
 const input={requestId:randomUUID(),definition},created=await call('/api/personal-rules/proposals',input);assert.equal(created.status,201);assert.equal(workspace.data.personalRules.length,0);
 assert.equal((await call('/api/personal-rules/proposals',input)).data.replayed,true);
 assert.equal((await call('/api/personal-rules/proposals',{...input,definition:{...definition,title:'Different request'}})).status,409);
 const proposal=created.data.proposal,accepted=await call('/api/personal-rules/review',{id:proposal.id,version:proposal.version,accept:true});assert.equal(accepted.status,200);assert.equal(accepted.data.results[0].rule.effect.value,1.5);
 assert.equal((await call('/api/personal-rules/review',{id:proposal.id,version:proposal.version,accept:true})).data.results[0].replayed,true);
 const rules=(await call('/api/personal-rules?kind=layout&q=spacing')).data;assert.equal(rules.total,1);const rule=rules.items[0];
 assert.equal((await new Workspace(workspace.directory).init()).data.personalRules[0].id,rule.id);
 const preview=await call('/api/personal-rules/preview',{metadata:{targetLanguage:'Deutsch',sourceLanguage:'Englisch'}});assert.equal(preview.status,200);assert.equal(preview.data.layoutPatch.lineHeight,1.5);
 const excluded=await call('/api/personal-rules/preview',{metadata:{targetLanguage:'Deutsch',excludedRuleIds:[rule.id]}});assert.equal(excluded.status,200);assert.equal(excluded.data.layoutPatch.lineHeight,undefined);assert.equal(excluded.data.decisions[0].state,'excluded');assert.equal(workspace.data.personalRules[0].status,'active');
 const disabled=await call('/api/personal-rules/proposals',{requestId:randomUUID(),operation:'disable',targetId:rule.id,targetVersion:rule.version});assert.equal(disabled.status,201);
 assert.equal((await call('/api/personal-rules/review',{id:disabled.data.proposal.id,version:1,accept:true})).status,200);
 assert.equal((await call('/api/personal-rules?status=inactive')).data.total,1);assert.equal((await call('/api/personal-rules/preview',{metadata:{targetLanguage:'Deutsch'}})).data.appliedRules.length,0);
 assert.equal((await call('/api/personal-rules/proposals',{requestId:randomUUID(),definition},{'x-foliquo-csrf':'invalid'})).status,403);assert.equal(requests(),0);
});
test('stale batch decisions and failed writes cannot partially publish a rule',async t=>{
 const {workspace,call}=await setup(t),first=await call('/api/personal-rules/proposals',{requestId:randomUUID(),definition});
 const failedBatch=await call('/api/personal-rules/review',{items:[{id:first.data.proposal.id,version:1,accept:true},{id:'missing-proposal',version:1,accept:true}]});assert.equal(failedBatch.status,400);assert.equal(workspace.data.personalRules.length,0);assert.equal(workspace.data.ruleProposals[0].status,'pending');
 const write=workspace.writeMetadata.bind(workspace);workspace.writeMetadata=async()=>{throw Object.assign(new Error('Fictional disk full'),{code:'ENOSPC'});};
 const failed=await call('/api/personal-rules/review',{id:first.data.proposal.id,version:1,accept:true});assert.equal(failed.status,400);assert.equal(workspace.data.personalRules.length,0);assert.equal(workspace.data.ruleProposals[0].status,'pending');
 workspace.writeMetadata=write;assert.equal((await call('/api/personal-rules/review',{id:first.data.proposal.id,version:1,accept:true})).status,200);
 const rule=workspace.data.personalRules[0],stale=await call('/api/personal-rules/proposals',{requestId:randomUUID(),operation:'disable',targetId:rule.id,targetVersion:rule.version+1});
 assert.equal((await call('/api/personal-rules/review',{id:stale.data.proposal.id,version:1,accept:true})).status,409);assert.equal(workspace.data.personalRules[0].status,'active');
 assert.equal((await call('/api/session')).data.storageError,null,'a stale decision is not a storage failure');
});
