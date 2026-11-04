import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {JobStore} from '../lib/job-store.mjs';

if(typeof globalThis.gc!=='function')throw new Error('Run this measurement with --expose-gc.');
const measure=async count=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-storage-memory-'));
 try{
  let jobs=Array.from({length:count},(_,index)=>({id:`fictional-memory-${String(index).padStart(4,'0')}`,owner:'fictional-memory-owner',status:'succeeded',createdAt:index+1,finishedAt:index+2,names:[`fictional-${index}.pdf`],detected:{documentType:'Fictional certificate'},result:{text:`Fictional archived result ${index}`},questions:[]}));
  const key=randomBytes(32);
  let store=await new JobStore(directory,key,{cacheBytes:1}).init();
  await store.commitJobs(jobs);
  for(const job of jobs)store.dropCache(job.id);
  jobs=null;
  store=null;
  globalThis.gc();
  store=await new JobStore(directory,key,{cacheBytes:1}).init();
  assert.equal(store.listSummaries({owner:'fictional-memory-owner'}).length,count);
  globalThis.gc();
  const {heapUsed,rss}=process.memoryUsage();
  store=null;
  globalThis.gc();
  return {records:count,heapUsed,rss};
 }finally{await rm(directory,{recursive:true,force:true});}
};

globalThis.gc();
const baseline=process.memoryUsage();
const small=await measure(100);
globalThis.gc();
const large=await measure(1000);
const heapDelta=large.heapUsed-small.heapUsed;
const rssDelta=large.rss-small.rss;
assert.ok(heapDelta<=64*1024*1024,`The 1,000-record heap increase (${heapDelta} bytes) exceeded 64 MiB.`);
assert.ok(rssDelta<=64*1024*1024,`The 1,000-record RSS increase (${rssDelta} bytes) exceeded 64 MiB.`);
console.log(JSON.stringify({mode:'idle-archive-index-memory',baseline:{heapUsed:baseline.heapUsed,rss:baseline.rss},small,large,heapDelta,rssDelta,budgetBytes:64*1024*1024}));
