import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Workspace} from '../lib/workspace.mjs';
import {FoliChat,parseFoliReply} from '../lib/foli-chat.mjs';
import {reviewRuleProposal} from '../lib/personal-rules.mjs';
import {createApp} from '../server.mjs';
import {createServer} from 'node:net';

const definition={title:'Fictional spacing',effect:{kind:'layout',key:'lineHeight',value:'1,5'},scope:{targetLanguage:'Deutsch'}};
const reply=JSON.stringify({answer:'Review this spacing proposal before accepting it.',proposals:[{operation:'create',definition}]});
async function setup(t,respond){
 const directory=await mkdtemp(join(tmpdir(),'foliquo-fictional-foli-')),workspace=await new Workspace(directory).init();let calls=0;
 const engine={id:'fixture',models:async()=>[{id:'fictional-model'}]},chat=new FoliChat({workspace,providerFor:()=>engine,respond:async(...args)=>{calls++;return respond(...args);}});
 t.after(async()=>{await chat.close();await workspace.tail;await rm(directory,{recursive:true,force:true});});
 return {workspace,chat,calls:()=>calls};
}
function input(record,extra={}){return {requestId:randomUUID(),version:record.version,text:'Für deutsche Übersetzungen Zeilenabstand 1,5.',provider:'fixture',model:'fictional-model',locale:'de',...extra};}
async function settled(chat){await Promise.all([...chat.tasks.values()].map(task=>task.promise));}

test('Foli publishes a bounded reply and drafts atomically, requires approval and replays a request without another call',async t=>{
 let request;
 const {workspace,chat,calls}=await setup(t,async(engine,body,signal,options)=>{options.onStarted({id:'fictional-usage'});request=body;return reply;});
 const original=await workspace.conversations.create('owner'),turn=input(original);
 const first=await chat.send('owner',original.id,turn);assert.equal(first.conversation.turn.status,'queued');await settled(chat);
 const record=await workspace.conversations.read('owner',original.id);assert.equal(record.turn.status,'complete');assert.equal(record.turn.usageId,'fictional-usage');assert.equal(record.messages.length,2);assert.equal(workspace.data.personalRules.length,0);assert.equal(workspace.data.ruleProposals.length,1);
 const proposal=workspace.data.ruleProposals[0];assert.equal(proposal.definition.effect.value,1.5);assert.equal(proposal.definition.origins[0].id,record.messages[1].id);assert.deepEqual(record.messages[1].proposalIds,[proposal.id]);assert.equal(JSON.parse(request.input[0].content[0].text).locale,'de');assert.equal(request.input[0].content.some(part=>part.type==='input_file'),false);
 assert.equal((await chat.send('owner',original.id,turn)).replayed,true);assert.equal(calls(),1);
 await assert.rejects(chat.send('owner',original.id,{...turn,text:'Different'}),{code:'ERR_FOLI_STALE'});
 await workspace.save({ruleOperation:data=>reviewRuleProposal(data,proposal.id,{version:1,accept:true})});assert.equal(workspace.data.personalRules[0].effect.value,1.5);
 await workspace.conversations.remove('owner',record.id,record.version);assert.equal(workspace.data.personalRules.length,1);
});

test('cancellation and ambiguous failures require deliberate retry and cannot publish proposals',async t=>{
 let entered;const started=new Promise(resolve=>{entered=resolve;});
 const {workspace,chat,calls}=await setup(t,async(engine,body,signal,options)=>{options.onStarted({id:'fictional-usage'});entered();await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('abort'),{name:'AbortError'})),{once:true}));});
 const original=await workspace.conversations.create('owner'),turn=input(original);await chat.send('owner',original.id,turn);await started;
 const cancelled=await chat.cancel('owner',original.id,turn.requestId);assert.equal(cancelled.turn.status,'interrupted_unknown');assert.equal(workspace.data.ruleProposals.length,0);
 await assert.rejects(chat.send('owner',original.id,input(cancelled)),{code:'ERR_FOLI_RETRY_CONFIRM'});assert.equal(calls(),1);
 const restarted=await new Workspace(workspace.directory).init();assert.equal((await restarted.conversations.read('owner',original.id)).turn.status,'interrupted_unknown');assert.equal(calls(),1);
});

test('invalid replies and persistence failure leave no partial drafts or active rules',async t=>{
 let result='{"answer":"Unsupported","proposals":[{"operation":"create","definition":{"title":"Font","effect":{"kind":"layout","key":"fontFamily","value":"Comic Sans"},"scope":{}}}]}';
 const {workspace,chat}=await setup(t,async(engine,body,signal,options)=>{options.onStarted({id:'fictional-usage'});return result;});
 let record=await workspace.conversations.create('owner');await chat.send('owner',record.id,input(record));await settled(chat);record=await workspace.conversations.read('owner',record.id);assert.equal(record.turn.status,'failed');assert.equal(workspace.data.ruleProposals.length,0);assert.equal(workspace.data.personalRules.length,0);
 result=reply;const write=workspace.writeMetadata.bind(workspace);workspace.writeMetadata=async bytes=>{if(bytes.toString().includes('foli-')&&workspace.data.foliConversations[0]?.status==='running')throw Object.assign(new Error('fictional full disk'),{code:'ENOSPC'});return write(bytes);};
 await chat.send('owner',record.id,input(record));await settled(chat);workspace.writeMetadata=write;
 assert.equal(workspace.data.ruleProposals.length,0);assert.equal(workspace.data.personalRules.length,0);record=await workspace.conversations.read('owner',record.id);assert.notEqual(record.turn.status,'complete');
});

test('structured replies cannot target absent versions, create actions or broaden unsupported fields',()=>{
 const context={rules:[{id:'known',version:2}],profiles:[],glossary:[]},origin={kind:'chat',id:randomUUID()},data={personalRules:[]};
 for(const proposals of [[{operation:'delete',targetId:'known',targetVersion:1}],[{operation:'execute',definition}],[{operation:'create',definition:{...definition,origins:[{kind:'manual',id:'fake'}]}}],[{operation:'create',definition:{...definition,effect:{kind:'terminology',glossaryId:'absent'}}}]])assert.throws(()=>parseFoliReply(JSON.stringify({answer:'draft',proposals}),{context,origin,data}));
 assert.equal(parseFoliReply(JSON.stringify({answer:'Which spacing do you mean?',proposals:[]}),{context,origin,data}).proposals.length,0);
});

test('Foli HTTP uses the existing session, CSRF, metered provider and owner checks',async t=>{
 const {workspace}=await setup(t,async()=>reply),probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));let calls=0;
 const provider={id:'fixture',selected:'fixture',status:()=>({connected:true,planEnabled:true}),models:async()=>[{id:'fictional-model'}],respond:async(request,signal,progress,usage)=>{calls++;usage({inputTokens:120,outputTokens:30},{complete:true});return reply;}};
 const app=createApp({workspace,port,provider,connection:{data:{}}});await new Promise(resolve=>app.listen(port,'127.0.0.1',resolve));t.after(async()=>{await app.flushWorkspace();await new Promise(resolve=>app.close(resolve));});
 const origin=`http://127.0.0.1:${port}`,cookie=(await fetch(origin)).headers.get('set-cookie').split(';')[0],session=await fetch(origin+'/api/session',{headers:{cookie}}).then(res=>res.json());
 async function call(path,data,headers={}){const res=await fetch(origin+path,{method:data===undefined?'GET':'POST',headers:{cookie,origin,'content-type':'application/json','x-foliquo-csrf':session.csrf,...headers},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:res.status,data:await res.json()};}
 const created=await call('/api/foli/conversations',{});assert.equal(created.status,201);assert.equal(created.data.conversation.owner,undefined);const record=created.data.conversation;
 assert.equal((await call(`/api/foli/conversations/${record.id}/messages`,input(record),{'x-foliquo-csrf':'wrong'})).status,403);
 const turn=input(record);assert.equal((await call(`/api/foli/conversations/${record.id}/messages`,turn)).status,202);
 let current;for(let attempt=0;attempt<100;attempt++){current=(await call(`/api/foli/conversations/${record.id}`)).data.conversation;if(!['queued','running'].includes(current.turn.status))break;await new Promise(resolve=>setTimeout(resolve,10));}
 assert.equal(current.turn.status,'complete');assert.equal(calls,1);assert.equal(workspace.data.usage[0].operation,'foli_chat');assert.equal(workspace.data.usage[0].inputTokens,120);assert.equal(workspace.data.personalRules.length,0);
 assert.equal((await call(`/api/foli/conversations/${record.id}/messages`,turn)).data.replayed,true);assert.equal(calls,1);
 const otherCookie=(await fetch(origin)).headers.get('set-cookie').split(';')[0];assert.equal((await call(`/api/foli/conversations/${record.id}`,undefined,{cookie:otherCookie})).status,404);
 // Reuse the actual budget guard and consent endpoint for an unpriced API model.
 provider.id='openai';workspace.data.settings.apiBudgetUSDMonthly=5;
 const budgetChat=(await call('/api/foli/conversations',{})).data.conversation;
 await call(`/api/foli/conversations/${budgetChat.id}/messages`,input(budgetChat,{provider:'openai'}));
 let stopped;for(let attempt=0;attempt<100;attempt++){stopped=(await call(`/api/foli/conversations/${budgetChat.id}`)).data.conversation;if(stopped.turn.status==='failed')break;await new Promise(resolve=>setTimeout(resolve,10));}
 assert.equal(stopped.turn.errorCode,'BUDGET_UNKNOWN_ESTIMATE');assert.equal(calls,1);
 const approvedTurn=input(stopped,{provider:'openai'});assert.equal((await call('/api/usage/consent-once',{confirm:true,provider:'openai',model:'fictional-model',scopeId:`foli-${approvedTurn.requestId}`})).status,200);
 await call(`/api/foli/conversations/${budgetChat.id}/messages`,approvedTurn);
 let completed;for(let attempt=0;attempt<100;attempt++){completed=(await call(`/api/foli/conversations/${budgetChat.id}`)).data.conversation;if(completed.turn.status==='complete')break;await new Promise(resolve=>setTimeout(resolve,10));}
 assert.equal(completed.turn.status,'complete');assert.equal(calls,2);assert.equal(workspace.data.personalRules.length,0);

});
