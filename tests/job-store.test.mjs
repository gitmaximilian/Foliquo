import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {JobStore} from '../lib/job-store.mjs';

const fictionalJob=(id,finishedAt=1000)=>({id,owner:'fictional-owner',status:'succeeded',stage:'done',createdAt:100,finishedAt,provider:'chatgpt',model:'fictional-model',targetLanguage:'Deutsch',names:['fictional.pdf'],result:{text:'fictional result',pdf:'FAKE'},questions:[],review:{version:1}});
async function fixture(t){const directory=await mkdtemp(join(tmpdir(),'foliquo-job-store-')),store=await new JobStore(directory,randomBytes(32)).init();t.after(()=>rm(directory,{recursive:true,force:true}));return {directory,store};}

test('job records commit atomically and the library index exposes bounded summaries only',async t=>{
 const {directory,store}=await fixture(t),first=fictionalJob('fictional-job-0001');await store.commitJob(first);
 const summaries=store.listSummaries({owner:'fictional-owner'});assert.equal(summaries.length,1);assert.equal(summaries[0].hasResult,true);assert.equal(JSON.stringify(summaries).includes('fictional result'),false);assert.equal(JSON.stringify(summaries).includes('FAKE'),false);
 const reopened=await new JobStore(directory,store.secure.key).init(),loaded=await reopened.getJob(first.id);assert.equal(loaded.result.text,'fictional result');loaded.result.text='revised fictional result';loaded.review.version=2;await reopened.commitJob(loaded);
 const afterRestart=await new JobStore(directory,store.secure.key).init();assert.equal((await afterRestart.getJob(first.id)).review.version,2);assert.equal(await afterRestart.deleteJob(first.id),true);assert.deepEqual(afterRestart.listSummaries(),[]);assert.equal(await afterRestart.deleteJob(first.id),false);
});

test('legacy migration verifies every record before publishing its index and prunes only expired terminal jobs',async t=>{
 const {directory,store}=await fixture(t),jobs=[fictionalJob('fictional-job-0002',1),fictionalJob('fictional-job-0003',Date.now())];
 await assert.rejects(()=>store.migrateFromLegacy([jobs[0],jobs[0]]),/duplicate/);assert.deepEqual(store.listSummaries(),[]);
 await store.migrateFromLegacy(jobs);assert.equal(store.listSummaries().length,2);assert.equal(await store.pruneExpired({now:100000,retentionMs:1000}),1);assert.equal(store.listSummaries().length,1);
 const reopened=await new JobStore(directory,store.secure.key).init();assert.equal((await reopened.getJob(jobs[1].id)).status,'succeeded');
});

test('failed index commits keep the previous record and do not expose a partial replacement',async t=>{
 const {directory,store}=await fixture(t),job=fictionalJob('fictional-job-0004');await store.commitJob(job);const oldRecordId=store.index.jobs[0].recordId,oldWrite=store.writeIndex.bind(store);
 store.writeIndex=async()=>{throw new Error('simulated manifest write failure');};const changed={...job,result:{text:'new fictional data'}};
 await assert.rejects(()=>store.commitJob(changed),/manifest write failure/);store.writeIndex=oldWrite;
 const reopened=await new JobStore(directory,store.secure.key).init();assert.equal((await reopened.getJob(job.id)).result.text,'fictional result');assert.equal(reopened.index.jobs[0].recordId,oldRecordId);
});

test('whole-collection commits reuse unchanged records and roll back staged updates on index failure',async t=>{
 const {directory,store}=await fixture(t),first=fictionalJob('fictional-job-0005'),second=fictionalJob('fictional-job-0006');
 await store.commitJobs([first,second]);const before=store.index.jobs.map(entry=>({id:entry.id,recordId:entry.recordId}));
 const changed={...first,result:{...first.result,text:'changed fictional result'}};await store.commitJobs([changed,second]);
 const after=store.index.jobs;assert.notEqual(after.find(entry=>entry.id===first.id).recordId,before.find(entry=>entry.id===first.id).recordId);assert.equal(after.find(entry=>entry.id===second.id).recordId,before.find(entry=>entry.id===second.id).recordId);
 const oldWrite=store.writeIndex.bind(store);store.writeIndex=async()=>{throw new Error('simulated batch index failure');};await assert.rejects(()=>store.commitJobs([{...changed,result:{text:'uncommitted'}}]),/batch index failure/);store.writeIndex=oldWrite;
 const reopened=await new JobStore(directory,store.secure.key).init();assert.deepEqual(reopened.listSummaries().map(item=>item.id),[first.id,second.id]);assert.equal((await reopened.getJob(first.id)).result.text,'changed fictional result');assert.equal((await reopened.getJob(second.id)).result.text,'fictional result');
});

test('job history summaries are owner-scoped, newest-first and paginated without result data',async t=>{
 const {store}=await fixture(t),jobs=Array.from({length:5},(_,index)=>({...fictionalJob(`fictional-page-${index}`,1000+index),owner:index===4?'another-fictional-owner':'fictional-owner',createdAt:100+index}));
 await store.commitJobs(jobs);
 const first=store.listSummariesPage({owner:'fictional-owner',offset:0,limit:2});
 assert.equal(first.total,4);assert.equal(first.jobs.length,2);assert.equal(first.jobs[0].id,'fictional-page-3');assert.equal(first.jobs[1].id,'fictional-page-2');assert.equal(first.hasMore,true);assert.equal(JSON.stringify(first).includes('fictional result'),false);assert.equal('owner' in first.jobs[0],false);
 const second=store.listSummariesPage({owner:'fictional-owner',offset:2,limit:2});assert.deepEqual(second.jobs.map(job=>job.id),['fictional-page-1','fictional-page-0']);assert.equal(second.hasMore,false);
 assert.throws(()=>store.listSummariesPage({offset:-1}),/offset/);assert.throws(()=>store.listSummariesPage({limit:101}),/page size/);
});
