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
 assert.equal((await call('/api/personal-rules?targetLanguage=English')).data.total,0);
 assert.equal((await call('/api/personal-rules/clear-reviewed',{confirm:true})).status,200);assert.equal(workspace.data.ruleProposals.length,0);assert.equal(workspace.data.personalRules[0].status,'inactive');
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
test('adjusting a pending proposal supersedes it atomically and selected proposals can be approved together',async t=>{
 const {workspace,call,requests}=await setup(t),original=(await call('/api/personal-rules/proposals',{requestId:randomUUID(),definition})).data.proposal;
 const adjustment={requestId:randomUUID(),definition:{...definition,title:'Adjusted fictional spacing',effect:{kind:'layout',key:'lineHeight',value:1.2}},supersedes:{id:original.id,version:original.version}};
 const changed=await call('/api/personal-rules/proposals',adjustment);assert.equal(changed.status,201);assert.equal(workspace.data.personalRules.length,0);assert.equal(workspace.data.ruleProposals.find(item=>item.id===original.id).status,'rejected');
 assert.equal((await call('/api/personal-rules/proposals',adjustment)).data.replayed,true);
 const before=structuredClone(workspace.data.ruleProposals);assert.equal((await call('/api/personal-rules/proposals',{...adjustment,requestId:randomUUID()})).status,409);assert.deepEqual(workspace.data.ruleProposals,before);
 const second=(await call('/api/personal-rules/proposals',{requestId:randomUUID(),definition:{...definition,title:'Fictional margins',effect:{kind:'layout',key:'margin',value:22}}})).data.proposal;
 const accepted=await call('/api/personal-rules/review',{items:[changed.data.proposal,second].map(item=>({id:item.id,version:item.version,accept:true}))});assert.equal(accepted.status,200);assert.equal(workspace.data.personalRules.length,2);
 assert.equal((await call('/api/personal-rules/clear-reviewed',{confirm:false})).status,400);assert.equal((await call('/api/personal-rules/clear-reviewed',{confirm:true})).status,200);assert.equal(workspace.data.ruleProposals.length,0);assert.equal(workspace.data.personalRules.length,2);assert.equal(requests(),0);
});

test('new terminology stays a draft until rule and glossary commit together, including adjustment and restore',async t=>{
 const {workspace,call,requests}=await setup(t),glossaryDraft={source:'Date of issue',target:'Ausstellungsdatum',note:'Fictional reusable term'};
 const created=await call('/api/personal-rules/proposals',{requestId:randomUUID(),definition:{title:'Fictional terminology',effect:{kind:'terminology',glossaryId:'new'},scope:{targetLanguage:'Deutsch'}},glossaryDraft});
 assert.equal(created.status,201);const first=created.data.proposal;assert.equal(workspace.data.glossary.length,0);assert.equal(workspace.data.personalRules.length,0);
 const adjusted=await call('/api/personal-rules/proposals',{requestId:randomUUID(),definition:{...first.definition,title:'Reviewed fictional terminology'},glossaryDraft:{...glossaryDraft,target:'Datum der Ausstellung'},supersedes:{id:first.id,version:first.version}});assert.equal(adjusted.status,201);
 const current=adjusted.data.proposal,followed=await call('/api/personal-rules/proposals?status=all&ids='+first.id);assert.equal(followed.data.items[0].id,current.id);assert.equal(followed.data.items[0].requestedId,first.id);
 const write=workspace.writeMetadata.bind(workspace);workspace.writeMetadata=async()=>{throw Object.assign(new Error('Fictional full disk'),{code:'ENOSPC'});};
 assert.equal((await call('/api/personal-rules/review',{id:current.id,version:current.version,accept:true})).status,400);assert.equal(workspace.data.glossary.length,0);assert.equal(workspace.data.personalRules.length,0);assert.equal(workspace.data.ruleProposals.find(item=>item.id===current.id).status,'pending');
 workspace.writeMetadata=write;assert.equal((await call('/api/personal-rules/review',{id:current.id,version:current.version,accept:true})).status,200);
 assert.equal(workspace.data.glossary.length,1);assert.equal(workspace.data.glossary[0].target,'Datum der Ausstellung');assert.equal(workspace.data.glossary[0].ruleManaged,true);assert.equal(workspace.data.personalRules[0].effect.glossaryId,workspace.data.glossary[0].id);
 const restarted=await new Workspace(workspace.directory).init();assert.equal(restarted.data.glossary[0].id,workspace.data.glossary[0].id);
 const {createContextLibrarySnapshot,resolveContextSnapshot}=await import('../lib/context.mjs');const meta={targetLanguage:'Deutsch',sourceLanguage:'English',documentType:'Fictional certificate'};
 const resolved=resolveContextSnapshot(createContextLibrarySnapshot(restarted,meta,'fictional-job','owner'),meta);assert.equal(resolved.terms[0].target,'Datum der Ausstellung');
 const excluded={...meta,excludedRuleIds:[workspace.data.personalRules[0].id]},without=resolveContextSnapshot(createContextLibrarySnapshot(restarted,excluded,'fictional-job','owner'),excluded);assert.equal(without.terms.length,0);
 const archive=workspace.backup('fictional-test-passphrase'),restored=await new Workspace(workspace.directory+'-restore').init();t.after(()=>rm(restored.directory,{recursive:true,force:true}));restored.restore(archive,'fictional-test-passphrase');await restored.save();assert.equal(restored.data.personalRules[0].id,workspace.data.personalRules[0].id);assert.equal(restored.data.glossary[0].id,workspace.data.glossary[0].id);assert.equal(requests(),0);
});

test('source removal requires a reviewed choice and a failed save preserves the sample and its rules',async t=>{
 const {workspace,call}=await setup(t),id=randomUUID();workspace.data.learning.push({id,name:'Fictional source',canonicalRules:true,version:1,status:'pending_review',active:false,documentType:'Fictional certificate',targetLanguage:'German',rules:[],fieldLabels:[],sources:[{name:'fictional.txt',type:'text/plain',data:Buffer.from('Fictional private sample').toString('base64')}],analysis:{complete:true,pageCount:1,profileVersion:1,sourceLanguage:'English',layout:{lineHeight:1.5},observations:[],terminology:[]}});await workspace.save();const proposal=workspace.data.ruleProposals[0];assert.equal((await call('/api/personal-rules/review',{id:proposal.id,version:1,accept:true})).status,200);
 const impact=await call('/api/learning/source-impact?id='+id);assert.equal(impact.data.rules.length,1);assert.equal(impact.data.rules[0].soleDependent,true);assert.equal((await call('/api/learning/update',{id,remove:true})).status,400);assert.equal(workspace.data.learning.length,1);
 const request={id,remove:true,confirm:true,ruleChoice:'independent',ruleVersions:impact.data.rules.map(({id,version})=>({id,version}))},write=workspace.writeMetadata.bind(workspace);workspace.writeMetadata=async()=>{throw Object.assign(new Error('Fictional full disk'),{code:'ENOSPC'});};assert.equal((await call('/api/learning/update',request)).status,400);assert.equal(workspace.data.learning.length,1);assert.equal(workspace.data.personalRules[0].independent,false);workspace.writeMetadata=write;
 assert.equal((await call('/api/learning/update',request)).status,200);assert.equal(workspace.data.learning.length,0);assert.equal(workspace.data.personalRules[0].independent,true);assert.deepEqual(workspace.data.personalRules[0].profileIds,[]);const reopened=await new Workspace(workspace.directory).init();assert.equal(reopened.data.learning.length,0);assert.equal(reopened.data.personalRules[0].origins[0].id,id);assert.equal(reopened.data.sampleProposalHistory.length,0);
});
