import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Workspace} from '../lib/workspace.mjs';
import {PDFDocument} from 'pdf-lib';
import {createApp} from '../server.mjs';

async function start(t,provider){
 const directory=await mkdtemp(join(tmpdir(),'foliquo-import-batches-')),workspace=await new Workspace(directory).init(),port=47500+Math.floor(Math.random()*1000),origin=`http://127.0.0.1:${port}`,server=createApp({connection:{status:()=>({connected:true,planEnabled:true})},workspace,provider,port});
 await new Promise((resolve,reject)=>server.once('error',reject).listen(port,'127.0.0.1',resolve));t.after(async()=>{await new Promise(resolve=>server.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});});
 const page=await fetch(origin),cookie=page.headers.get('set-cookie').split(';')[0],session=await fetch(origin+'/api/session',{headers:{cookie}}).then(response=>response.json());
 const post=(path,data)=>fetch(origin+path,{method:'POST',headers:{cookie,origin,'content-type':'application/json','x-foliquo-csrf':session.csrf},body:JSON.stringify(data)});
 const get=path=>fetch(origin+path,{headers:{cookie}});
 return {directory,workspace,origin,server,post,get};
}
function provider(){return {id:'openai',selected:'openai',status:()=>({connected:true,planEnabled:true}),models:async()=>[{id:'fictional-model',name:'Fictional model'}],respond:async(request,signal)=>{signal.throwIfAborted();if(request.instructions.startsWith('Lies ausschließlich'))return JSON.stringify({documentType:'Fictional document',fields:[],uncertainRegions:[]});return JSON.stringify({status:'ready',sourceLanguage:'English',documentType:'Fictional document',questions:[],text:'Fictional translation',fields:[],regions:[]});}};}
const files=count=>Array.from({length:count},(_,index)=>({name:`fictional-${index+1}.txt`,type:'text/plain',data:Buffer.from(`Fictional source ${index+1}`).toString('base64')}));
const groups=count=>Array.from({length:count},(_,index)=>({name:`Document ${index+1}`,fileIndexes:[index]}));
const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const JOB_COMPLETION_TIMEOUT_MS=90_000;

test('batch API creates separate jobs, reports state without file contents, and persists its manifest',async t=>{
 const app=await start(t,provider()),request={provider:'openai',model:'fictional-model',clientId:'fictional-client',requestId:'fictional-batch-request',files:files(3),groups:groups(3),metadata:{targetLanguage:'Deutsch'}},response=await app.post('/api/import-batches',request);assert.equal(response.status,202);const created=await response.json();assert.equal(created.added,3);assert.equal(created.totalGroups,3);assert.equal(created.remainingGroups,0);
 const duplicate=await app.post('/api/import-batches',request).then(result=>result.json());assert.equal(duplicate.id,created.id);assert.equal(duplicate.idempotent,true);assert.equal((await app.get('/api/jobs').then(result=>result.json())).jobs.length,3);
 const visible=await app.get('/api/jobs').then(result=>result.json());assert.equal(visible.batches.length,1);assert.equal(visible.batches[0].createdGroups,3);assert.equal(JSON.stringify(visible.batches).includes('Fictional source'),false);assert.equal(JSON.stringify(visible.batches).includes('data'),false);
 let completed=false;const deadline=Date.now()+JOB_COMPLETION_TIMEOUT_MS;while(Date.now()<deadline){const state=await app.get('/api/jobs').then(result=>result.json());if(state.jobs.length===3&&state.jobs.every(job=>job.status==='succeeded')&&!state.activeId){completed=true;break;}await wait(50);}assert.ok(completed,`batch jobs should finish within ${JOB_COMPLETION_TIMEOUT_MS/1000} seconds before workspace cleanup`);
 await app.workspace.tail;const restored=await new Workspace(app.directory).init();assert.equal(restored.data.importBatches[0].groups.length,3);assert.ok(restored.data.importBatches[0].sources.every(source=>source.data===''));
});

test('ten-job batches start in bounded waves and require an explicit continuation',async t=>{
 const app=await start(t,provider());await app.post('/api/queue/pause',{});
 const response=await app.post('/api/import-batches',{provider:'openai',model:'fictional-model',clientId:'fictional-client',requestId:'fictional-ten-batch',files:files(10),groups:groups(10),metadata:{targetLanguage:'Deutsch'}});assert.equal(response.status,202);const created=await response.json();assert.equal(created.added,8);assert.equal(created.createdGroups,8);assert.equal(created.remainingGroups,2);
 let state=await app.get('/api/jobs').then(result=>result.json());assert.equal(state.jobs.length,8);assert.equal(state.batches[0].remainingGroups,2);
 const noSlots=await app.post(`/api/import-batches/${created.id}/continue`,{}).then(result=>result.json());assert.equal(noSlots.added,0);assert.equal(noSlots.remainingGroups,2);
 for(const job of state.jobs)await app.post(`/api/jobs/${job.id}/cancel`,{});
 const continued=await app.post(`/api/import-batches/${created.id}/continue`,{}).then(result=>result.json());assert.equal(continued.added,2);assert.equal(continued.remainingGroups,0);assert.equal(new Set(continued.groups.map(group=>group.jobId)).size,10);
 for(const job of (await app.get('/api/jobs').then(result=>result.json())).jobs.filter(job=>job.status==='queued'))await app.post(`/api/jobs/${job.id}/cancel`,{});
 await app.workspace.tail;const restored=await new Workspace(app.directory).init();assert.equal(restored.data.importBatches[0].nextGroup,10);assert.equal(restored.data.importBatches[0].sources[0].data,'');
});


test('PDF range batch preserves selected page order, scan crops, and original-page scope',async t=>{
 const app=await start(t,provider());await app.post('/api/queue/pause',{});const pdf=await PDFDocument.create();for(const size of [100,200,300,400])pdf.addPage([size,size]);const bytes=Buffer.from(await pdf.save());const response=await app.post('/api/import-batches',{provider:'openai',model:'fictional-model',clientId:'fictional-pdf-client',requestId:'fictional-pdf-range-request',files:[{name:'collection.pdf',type:'application/pdf',data:bytes.toString('base64')}],groups:[{name:'Odd pages',items:[{fileIndex:0,pages:[1,3]}]},{name:'Even pages',items:[{fileIndex:0,pages:[2,4]}]}],metadata:{targetLanguage:'Deutsch',fileRoles:['auto'],scanCorrections:[{fileIndex:0,rotation:90,pageOrder:[3,2,1,4],crops:{1:[0,0,0.5,0.5],3:[0.25,0.25,0.5,0.5]}}]}});assert.equal(response.status,202,await response.clone().text());const result=await response.json();assert.equal(result.added,2);const jobs=app.workspace.data.jobs.filter(job=>job.importBatch?.id===result.id);assert.equal(jobs.length,2);const firstCorrection=jobs[0].payload.metadata.scanCorrections[0];assert.deepEqual(firstCorrection.pageOrder,[2,1]);assert.deepEqual(firstCorrection.crops,{1:[0,0,0.5,0.5],2:[0.25,0.25,0.5,0.5]});const rawSubset=await PDFDocument.load(jobs[0].payload.files[0].bytes);assert.deepEqual(rawSubset.getPages().map(page=>page.getWidth()),[100,300]);const source=await app.get(`/api/jobs/${jobs[0].id}/source`).then(res=>res.json());const subset=await PDFDocument.load(Buffer.from(source.files[0].data,'base64'));assert.deepEqual(subset.getPages().map(page=>page.getWidth()),[300,100]);for(const job of jobs)await app.post(`/api/jobs/${job.id}/cancel`,{});await app.workspace.tail;
});
