import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Workspace} from '../lib/workspace.mjs';
import {newUsageRequest} from '../lib/usage.mjs';
import {createApp} from '../server.mjs';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {createHash} from 'node:crypto';

async function start(t,provider,subject=null){
 const directory=await mkdtemp(join(tmpdir(),'foliquo-usage-')),workspace=await new Workspace(directory).init(),port=49000+Math.floor(Math.random()*1000),origin=`http://127.0.0.1:${port}`;
 const server=createApp({connection:{data:subject?{subject}:{},status:()=>({connected:true,planEnabled:true})},workspace,provider,port});await new Promise((resolve,reject)=>server.once('error',reject).listen(port,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});});
 const page=await fetch(origin),cookie=page.headers.get('set-cookie').split(';')[0],session=await fetch(origin+'/api/session',{headers:{cookie}}).then(response=>response.json());
 const post=(path,data)=>fetch(origin+path,{method:'POST',headers:{cookie,origin,'content-type':'application/json','x-foliquo-csrf':session.csrf},body:JSON.stringify(data)});
 const get=path=>fetch(origin+path,{headers:{cookie}});
 return {workspace,origin,post,get};
}
function fixtureProvider(){let call=0;return {id:'openai',selected:'openai',status:()=>({connected:true,planEnabled:true}),models:async()=>[{id:'fictional-model',name:'Fictional model'}],respond:async(request,signal,progress,onUsage)=>{signal.throwIfAborted();call++;onUsage({inputTokens:100,outputTokens:20},{complete:true,responseId:`response-${call}`});if(request.instructions.startsWith('Lies ausschließlich'))return JSON.stringify({documentType:'Fiktive Urkunde',fields:[{label:'Name',kind:'name',source:'Alex Example',translated:'Alex Example',fileIndex:0,page:1,box:null}],uncertainRegions:[]});return JSON.stringify({status:'ready',sourceLanguage:'English',documentType:'Fictional certificate',questions:[],text:'Name | Alex Example',fields:[],regions:[]});}};}
const turn=()=>new Promise(resolve=>setTimeout(resolve,10));
async function waitForJob(app,id,status){for(let i=0;i<200;i++){const data=await app.get('/api/jobs').then(response=>response.json()),job=data.jobs.find(item=>item.id===id);if(job?.status===status)return job;await turn();}throw new Error(`Job ${id} did not reach ${status}.`);}
async function waitForLearning(app,id,status){for(let i=0;i<200;i++){const data=await app.get('/api/learning').then(response=>response.json()),entry=data.entries.find(item=>item.id===id);if(entry?.status===status)return entry;await turn();}throw new Error(`Learning analysis ${id} did not reach ${status}.`);}
function jobProvider(modelId,onCall=()=>{}){let call=0;return {id:'openai',selected:'openai',status:()=>({connected:true,planEnabled:true}),models:async()=>[{id:modelId,name:modelId}],respond:async(request,signal,onProgress,onUsage)=>{signal.throwIfAborted();call++;onCall();onUsage({inputTokens:100,outputTokens:20},{complete:true,responseId:`response-${call}`});if(request.instructions.startsWith('Lies ausschließlich'))return JSON.stringify({documentType:'Fiktive Urkunde',fields:[{label:'Name',kind:'name',source:'Alex Example',translated:'Alex Example',fileIndex:0,page:1,box:null}],uncertainRegions:[]});return JSON.stringify({status:'ready',sourceLanguage:'English',documentType:'Fictional certificate',questions:[],text:'Name | Alex Example',fields:[],regions:[]});}};}

test('the local API records source extraction and translation usage without returning document text',async t=>{
 const app=await start(t,fixtureProvider()),file={name:'fictional-source.txt',type:'text/plain',data:Buffer.from('Fictional source document. Name: Alex Example.').toString('base64')};
 const result=await app.post('/api/translate',{provider:'openai',model:'fictional-model',files:[file],metadata:{targetLanguage:'Deutsch'}});assert.equal(result.status,200);
 const response=await app.get('/api/usage?days=30'),data=await response.json(),totals=data.summary.providers.find(item=>item.provider==='openai');
 assert.equal(response.status,200);assert.equal(totals.requests,2);assert.equal(totals.completeRequests,2);assert.equal(totals.inputTokens,200);assert.equal(totals.outputTokens,40);assert.equal(data.summary.operationsByProvider.find(item=>item.operation==='source_extraction').requests,1);assert.equal(data.summary.operationsByProvider.find(item=>item.operation==='translation').requests,1);assert.equal(JSON.stringify(data).includes('Alex Example'),false);assert.equal(data.chatgptRemaining.available,false);
});

test('a server-reported ChatGPT plan limit is recorded as Foliquo-scoped and leaves usage unknown',async t=>{
 const provider={id:'chatgpt',selected:'chatgpt',status:()=>({connected:true,planEnabled:true}),models:async()=>[{id:'fictional-model',name:'Fictional model'}],respond:async()=>{const error=new Error('limited');error.code='subscription_sharing_usage_limit_exceeded';error.pauseQueue=true;throw error;}};
 const app=await start(t,provider),file={name:'fictional-source.txt',type:'text/plain',data:Buffer.from('Fictional source document.').toString('base64')};
 const result=await app.post('/api/translate',{provider:'chatgpt',model:'fictional-model',files:[file],metadata:{targetLanguage:'Deutsch'}});assert.equal(result.status,400);
 const session=await app.get('/api/session').then(response=>response.json()),usage=await app.get('/api/usage').then(response=>response.json());assert.equal(session.usageLimitState.state,'limit_reached');assert.equal(session.usageLimitState.scope,'Foliquo request');assert.equal(usage.summary.totals.unknownRequests,1);assert.equal(usage.summary.totals.totalTokens,0);assert.equal(usage.summary.totals.tokenTotalsPartial,true);
});

test('an interrupted job is marked uncertain and is never replayed automatically on startup',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-recovery-')),workspace=await new Workspace(directory).init(),port=49700+Math.floor(Math.random()*100),origin=`http://127.0.0.1:${port}`,sessionId='fictional-session',csrf='fictional-csrf',jobId='00000000-0000-4000-8000-000000000001',startedAt=Date.now()-5000,usage=newUsageRequest({provider:'openai',model:'fictional-model',operation:'translation',jobId},startedAt);let calls=0;
 workspace.data.sessions=[[sessionId,{id:sessionId,csrf,expiresAt:Date.now()+86400000}]];workspace.data.usage=[usage];workspace.data.jobs=[{id:jobId,owner:sessionId,clientId:'fictional-client',requestId:'fictional-request',payload:{provider:'openai',model:'fictional-model',metadata:{jobId,targetLanguage:'Deutsch'},files:[{name:'fictional.txt',type:'text/plain',bytes:Buffer.from('fictional source')}],checkpoints:{translation:{phase:'translation',fingerprint:'a'.repeat(64),status:'in_flight',startedAt,attempts:[{usageId:usage.id,startedAt,status:'in_flight'}]}}},provider:'openai',stage:'translation',status:'running',createdAt:startedAt,startedAt,finishedAt:null,stageStartedAt:startedAt,units:1,estimatedSeconds:20,targetLanguage:'Deutsch',names:['fictional.txt'],events:[]}];
 const provider={id:'openai',selected:'openai',status:()=>({connected:true,planEnabled:true}),models:async()=>[{id:'fictional-model',name:'Fictional model'}],respond:async()=>{calls++;return 'never automatically sent';}},server=createApp({connection:{status:()=>({connected:true,planEnabled:true})},workspace,provider,port});await new Promise((resolve,reject)=>server.once('error',reject).listen(port,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});});
 const cookie=`urkundenklar=${sessionId}`,jobs=await fetch(origin+'/api/jobs',{headers:{cookie}}).then(response=>response.json()),usageView=await fetch(origin+'/api/usage?provider=openai',{headers:{cookie}}).then(response=>response.json()),job=jobs.jobs.find(item=>item.id===jobId);
 assert.equal(job.status,'failed');assert.equal(job.interrupted,true);assert.equal(job.checkpoint.phase,'translation');assert.equal(job.checkpoint.status,'interrupted');assert.match(job.error,/erneut Verbrauch/);assert.equal(usageView.summary.totals.unknownRequests,1);assert.equal(calls,0);
});

test('the local API budget stops a known-cost request before provider work starts',async t=>{
 let calls=0;const app=await start(t,jobProvider('gpt-6.1-sol',()=>calls++));const saved=await app.post('/api/settings',{apiBudgetUSDMonthly:0.01});assert.equal(saved.status,200);assert.equal((await saved.json()).settings.apiBudgetUSDMonthly,0.01);
 const file={name:'source.txt',type:'text/plain',data:Buffer.from('A short fictional record.').toString('base64')},created=await app.post('/api/jobs',{provider:'openai',model:'gpt-6.1-sol',clientId:'budget-test',requestId:'budget-request-1',files:[file],metadata:{targetLanguage:'Deutsch'}}).then(response=>response.json()),job=await waitForJob(app,created.id,'failed');
 assert.equal(calls,0);assert.match(job.error,/API-Ausgabengrenze/);assert.equal(job.budgetConsentRequired,false);const usage=await app.get('/api/usage').then(response=>response.json());assert.equal(usage.apiBudgetUSDMonthly,0.01);assert.equal(usage.apiBudgetStatus.reservedUSDHigh,0);
});

test('queued jobs keep the library context version selected when the job was created',async t=>{
 const app=await start(t,jobProvider('fictional-model'));const template=app.workspace.put('templates',{name:'Pinned licence',confirmed:true,documentType:'Fictional certificate',fields:['Original field'],layout:{margin:23}});await app.workspace.save();
 await app.post('/api/queue/pause',{});const file={name:'source.txt',type:'text/plain',data:Buffer.from('A short fictional record.').toString('base64')},created=await app.post('/api/jobs',{provider:'openai',model:'fictional-model',clientId:'context-test',requestId:'context-request-1',files:[file],metadata:{targetLanguage:'Deutsch',templateId:template.id}}).then(response=>response.json());
 app.workspace.put('templates',{id:template.id,name:'Pinned licence',confirmed:true,documentType:'Fictional certificate',fields:['Changed field'],layout:{margin:31}});await app.workspace.save();await app.post('/api/queue/resume',{});
 const job=await waitForJob(app,created.id,'succeeded'),review=await app.get(`/api/jobs/${created.id}/review?preview=1`).then(response=>response.json());assert.equal(job.status,'succeeded');assert.equal(review.result.context.template.version,1);assert.deepEqual(review.result.context.template.fields,['Original field']);assert.equal(review.result.context.layout.margin,23);assert.equal(review.result.context.contextVersion.length,32);
});

test('unknown API estimates require a deliberate, job-scoped approval',async t=>{
 let calls=0;const app=await start(t,jobProvider('unlisted-model',()=>calls++));await app.post('/api/settings',{apiBudgetUSDMonthly:0.5});const file={name:'source.txt',type:'text/plain',data:Buffer.from('A short fictional record.').toString('base64')},created=await app.post('/api/jobs',{provider:'openai',model:'unlisted-model',clientId:'budget-test',requestId:'budget-request-2',files:[file],metadata:{targetLanguage:'Deutsch'}}).then(response=>response.json()),failed=await waitForJob(app,created.id,'failed');
 assert.equal(calls,0);assert.equal(failed.budgetConsentRequired,true);const denied=await app.post('/api/usage/consent-once',{provider:'openai',model:'unlisted-model',confirm:true});assert.equal(denied.status,400);
 const approved=await app.post('/api/usage/consent-once',{provider:'openai',model:'unlisted-model',scopeId:created.id,confirm:true});assert.equal(approved.status,200);await app.post(`/api/jobs/${created.id}/retry`,{});await app.post('/api/queue/resume',{});const succeeded=await waitForJob(app,created.id,'succeeded');assert.equal(succeeded.status,'succeeded');assert.equal(calls,2);
});

test('learning analysis asks for explicit approval when its API estimate is unknown',async t=>{
 let calls=0;const app=await start(t,jobProvider('unlisted-model',()=>calls++));await app.post('/api/settings',{apiBudgetUSDMonthly:0.5});const pdf=await PDFDocument.create(),page=pdf.addPage([595,842]),font=await pdf.embedFont(StandardFonts.Helvetica);page.drawText('Fictional certificate · Name: Alex Example',{x:50,y:790,font,size:12});const data=Buffer.from(await pdf.save()).toString('base64'),file={name:'fictional-learning.pdf',type:'application/pdf',data};
 const uploaded=await app.post('/api/learning/upload',{provider:'openai',model:'unlisted-model',files:[file],confirmed:true}).then(response=>response.json()),entry=await waitForLearning(app,uploaded.entry.id,'interrupted');assert.equal(calls,0);assert.equal(entry.budgetConsentRequired,true);
 const refused=await app.post(`/api/learning/${entry.id}/resume`,{confirmed:true});assert.equal(refused.status,400);const resumed=await app.post(`/api/learning/${entry.id}/resume`,{confirmed:true,allowUnknownCost:true});assert.equal(resumed.status,202);const completed=await waitForLearning(app,entry.id,'pending_review');assert.equal(completed.analysis.complete,true);assert.equal(calls,1);
});

test('ChatGPT usage history is scoped to the currently connected account',async t=>{
 const subject='fictional-current-account',scope=createHash('sha256').update(subject).digest('hex').slice(0,16),app=await start(t,fixtureProvider(),subject),now=Date.now(),current=newUsageRequest({provider:'chatgpt',model:'current-model',operation:'translation',accountScope:scope},now),previous=newUsageRequest({provider:'chatgpt',model:'previous-model',operation:'translation',accountScope:'b'.repeat(16)},now+1);
 const {mergeUsageRequest}=await import('../lib/usage.mjs');mergeUsageRequest([current,previous],current.id,{inputTokens:50,outputTokens:10},{complete:true},now+2);mergeUsageRequest([current,previous],previous.id,{inputTokens:900,outputTokens:800},{complete:true},now+3);app.workspace.data.usage=[current,previous];await app.workspace.save();
 const response=await app.get('/api/usage?provider=chatgpt'),data=await response.json();assert.equal(data.summary.totals.requests,1);assert.equal(data.summary.totals.totalTokens,60);assert.equal(data.summary.records[0].model,'current-model');assert.equal(JSON.stringify(data).includes(scope),false);
});
