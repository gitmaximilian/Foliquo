import test from 'node:test';
import assert from 'node:assert/strict';
import {TranslationQueue} from '../lib/queue.mjs';
const payload={files:[{name:'sample.pdf',bytes:Buffer.from('%PDF-')}],metadata:{targetLanguage:'Deutsch'},model:'test'};
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const add=(queue,name='one',owner='owner')=>queue.add({owner,clientId:'browser',requestId:name,payload});
async function settle(queue){for(let i=0;i<30&&queue.busy;i++)await turn();}
test('FIFO serializes execution, preserves snapshots and avoids duplicate submissions',async()=>{
 const order=[],releases=[];let active=0,max=0;
 const q=new TranslationQueue(async p=>{active++;max=Math.max(active,max);order.push(p.metadata.targetLanguage);await new Promise(resolve=>releases.push(resolve));active--;return {text:'OK',pdf:'PDF'};});
 const a=add(q);assert.equal(add(q).id,a.id);const b=q.add({owner:'owner',clientId:'browser',requestId:'two',payload:{...payload,metadata:{targetLanguage:'Englisch'}}});await turn();assert.equal(q.snapshot('owner').jobs.find(j=>j.id===b.id).status,'queued');assert.equal(q.snapshot('other').jobs.length,0);releases.shift()();await turn();releases.shift()();await settle(q);assert.equal(max,1);assert.deepEqual(order,['Deutsch','Englisch']);assert.equal(q.find(a.id,'owner').status,'succeeded');assert.throws(()=>q.find(a.id,'other'));
});
test('Queued and running jobs cancel without producing a successful PDF',async()=>{
 const q=new TranslationQueue(async(p,signal)=>{await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError')),{once:true}));return {pdf:'Never'};});
 const a=add(q),b=add(q,'two');await turn();q.cancel(b.id,'owner');assert.equal(b.status,'cancelled');q.cancel(a.id,'owner');assert.equal(a.status,'cancelling');await settle(q);assert.equal(a.status,'cancelled');assert.equal(a.result,null);assert.equal(b.payload,null);
});
test('Pause waits for resume; availability failures pause following work and can retry',async()=>{
 let fail=true,calls=0;const q=new TranslationQueue(async()=>{calls++;if(fail){const e=new Error('Limit');e.pauseQueue=true;throw e;}return {pdf:'ok'};});q.pause();const a=add(q),b=add(q,'two');await turn();assert.equal(calls,0);q.resume();await turn();assert.equal(a.status,'failed');assert.equal(b.status,'queued');assert.equal(q.paused,true);fail=false;q.retry(a.id,'owner');q.resume();await settle(q);assert.equal(a.status,'succeeded');assert.equal(b.status,'succeeded');assert.equal(calls,3);
});
test('Retry-After is retained and retry is blocked until its deadline',async()=>{
 let now=1000,calls=0;const q=new TranslationQueue(async()=>{calls++;if(calls===1){const error=new Error('rate limited');error.retryAfterMs=5000;throw error;}return {pdf:'ok'};},{now:()=>now});const job=add(q);await settle(q);assert.equal(job.status,'failed');assert.equal(job.retryAfterAt,6000);assert.throws(()=>q.retry(job.id,'owner'),/warten/);assert.equal(calls,1);now=6000;q.retry(job.id,'owner');q.resume();await settle(q);assert.equal(job.status,'succeeded');assert.equal(job.retryAfterAt,null);assert.equal(calls,2);
});
test('Progress and remaining time are estimates and do not report completion early',async()=>{
 let now=1000,release;const q=new TranslationQueue(async(p,s,phase)=>{phase('translating',{units:2});await new Promise(resolve=>release=resolve);phase('pdf');return {pdf:'ok'};},{now:()=>now});const a=add(q);await turn();now+=5000;let snapshot=q.snapshot('owner').jobs[0];assert.ok(snapshot.progress>0&&snapshot.progress<100);assert.ok(snapshot.remainingSeconds>0);now+=1000000;snapshot=q.snapshot('owner').jobs[0];assert.equal(snapshot.remainingSeconds,null);assert.ok(snapshot.progress<100);release();await settle(q);assert.equal(q.snapshot('owner').jobs[0].progress,100);assert.equal(q.find(a.id,'owner').payload,null);
});
test('Limits bound pending work and results expire without exposing payloads',async()=>{
 let now=1000;const q=new TranslationQueue(async()=>({pdf:'ok'}),{now:()=>now,maxPending:1});q.pause();const a=add(q);assert.throws(()=>add(q,'two'));q.resume();await settle(q);const serialized=JSON.stringify(q.snapshot('owner'));assert.equal(serialized.includes('%PDF-'),false);assert.equal(serialized.includes('"payload"'),false);now+=3600001;q.cleanup();assert.equal(a.status,'expired');assert.equal(a.result,null);
});
test('Memory pressure never expires or removes a successful result before retention',async()=>{
 const q=new TranslationQueue(async()=>({pdf:'fictional-result'}));const job=add(q);await settle(q);job.resultBytes=161*1024*1024;assert.equal(q.trimMemory(),false);assert.equal(job.status,'succeeded');assert.equal(job.result.pdf,'fictional-result');assert.equal(job.finishedAt>0,true);
});
test('job count alone never removes retained terminal records',()=>{
 const now=Date.now(),q=new TranslationQueue(async()=>({}),{now:()=>now,retentionMs:30*86400000});
 q.jobs=Array.from({length:1001},(_,index)=>({id:`fictional-${index}`,status:'succeeded',finishedAt:now,createdAt:now,result:{text:'retained fictional result'},resultBytes:64}));
 q.cleanup();assert.equal(q.jobs.length,1001);assert.ok(q.jobs.every(job=>job.status==='succeeded'&&job.result?.text==='retained fictional result'));
});
test('durable checkpoints are awaited before execution and surfaced in job status',async()=>{
 let writes=0;const q=new TranslationQueue(async(payload,signal,stage,save)=>{assert.equal(writes,1,'the running job must be saved before model work starts');payload.checkpoints={translation:{phase:'translation',status:'complete',finishedAt:Date.now()}};await save();return {pdf:'ok'};},{onCheckpoint:async()=>{await new Promise(resolve=>setImmediate(resolve));writes++;}});const job=add(q);await settle(q);assert.equal(job.status,'succeeded');assert.equal(writes,2);assert.equal(job.lastCheckpoint.phase,'translation');assert.equal(q.snapshot('owner').jobs[0].checkpoint.status,'complete');
});
