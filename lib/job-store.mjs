import {createHash,randomUUID} from 'node:crypto';
import {SecureStore} from './secure-store.mjs';

const INDEX_ID='job-index-00000000000000000000000000000000';
const TERMINAL=new Set(['succeeded','failed','cancelled','expired']);

function summary(job){return {id:job.id,status:job.status,stage:job.stage||'',createdAt:job.createdAt||0,startedAt:job.startedAt||null,finishedAt:job.finishedAt||null,owner:job.owner||'',provider:job.provider||'chatgpt',model:job.model||'',targetLanguage:job.targetLanguage||'',names:Array.isArray(job.names)?job.names.slice(0,10):[],detected:job.detected?.documentType?{documentType:job.detected.documentType}:null,revision:job.review?.version||1,hasResult:Boolean(job.result),hasQuestions:Array.isArray(job.questions)&&job.questions.length>0};}
function plainObject(value){return value&&typeof value==='object'&&!Array.isArray(value);}
function serialize(job){return JSON.stringify(job);}
function fingerprint(serialized){return createHash('sha256').update(serialized).digest('hex');}

/** Versioned encrypted job records with an atomic encrypted summary index. */
export class JobStore {
 constructor(directory,key,{cacheBytes=32*1024*1024}={}){this.secure=new SecureStore(directory,key);this.cacheBytes=cacheBytes;this.index={schema:1,jobs:[]};this.cache=new Map();this.cacheSize=0;}
 async init(){
  try{
   const bytes=await this.secure.read(INDEX_ID,'record'),index=JSON.parse(bytes.toString());
   if(!plainObject(index)||index.schema!==1||!Array.isArray(index.jobs))throw new Error('Invalid job index.');
   const ids=new Set();
   for(const entry of index.jobs){if(!plainObject(entry)||typeof entry.id!=='string'||typeof entry.recordId!=='string'||!plainObject(entry.summary)||entry.summary.id!==entry.id||entry.fingerprint!==undefined&&!/^[a-f0-9]{64}$/.test(entry.fingerprint)||ids.has(entry.id))throw new Error('Invalid job index entry.');ids.add(entry.id);}
   this.index=index;
  }catch(error){if(error.code!=='ENOENT')throw error;await this.writeIndex(this.index);}
  return this;
 }
 async writeIndex(index){await this.secure.write(INDEX_ID,'record',Buffer.from(JSON.stringify(index)));}
 listSummaries({owner}={}){return this.index.jobs.filter(entry=>owner===undefined||entry.summary.owner===owner).map(entry=>structuredClone(entry.summary));}
 listSummariesPage({owner,offset=0,limit=50}={}){
  if(!Number.isSafeInteger(offset)||offset<0)throw new Error('Invalid job history offset.');
  if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('Invalid job history page size.');
  const summaries=this.index.jobs.filter(entry=>owner===undefined||entry.summary.owner===owner).map(entry=>entry.summary);
  summaries.sort((a,b)=>(b.finishedAt||b.createdAt||0)-(a.finishedAt||a.createdAt||0)||a.id.localeCompare(b.id));
  const jobs=summaries.slice(offset,offset+limit).map(({owner:_owner,...entry})=>structuredClone(entry));
  return {jobs,total:summaries.length,offset,limit,hasMore:offset+jobs.length<summaries.length};
 }
 cacheJob(job){const bytes=Buffer.byteLength(serialize(job));if(bytes>this.cacheBytes)return;const old=this.cache.get(job.id);if(old){this.cacheSize-=old.bytes;this.cache.delete(job.id);}while(this.cacheSize+bytes>this.cacheBytes&&this.cache.size){const [id,item]=this.cache.entries().next().value;this.cache.delete(id);this.cacheSize-=item.bytes;}this.cache.set(job.id,{job,bytes});this.cacheSize+=bytes;}
 async getJob(id){const cached=this.cache.get(id);if(cached){this.cache.delete(id);this.cache.set(id,cached);return cached.job;}const entry=this.index.jobs.find(item=>item.id===id);if(!entry)return null;const bytes=await this.secure.read(entry.recordId,'record');let job;try{job=JSON.parse(bytes.toString());}catch{throw new Error('Encrypted job record is invalid.');}if(job?.id!==id)throw new Error('Encrypted job record does not match its index.');if(entry.fingerprint&&fingerprint(serialize(job))!==entry.fingerprint)throw new Error('Encrypted job record does not match its index fingerprint.');this.cacheJob(job);return job;}
 async commitJob(job){if(!plainObject(job)||typeof job.id!=='string')throw new Error('A valid job record is required.');const serialized=serialize(job),recordId=randomUUID(),entry={id:job.id,recordId,fingerprint:fingerprint(serialized),summary:summary(job)},previous=this.index.jobs.find(item=>item.id===job.id),next={schema:1,jobs:this.index.jobs.filter(item=>item.id!==job.id).concat(entry)};await this.secure.write(recordId,'record',Buffer.from(serialized));try{await this.writeIndex(next);}catch(error){await this.secure.remove(recordId,'record').catch(()=>{});throw error;}this.index=next;this.cacheJob(job);if(previous)await this.secure.remove(previous.recordId,'record').catch(()=>{});return structuredClone(entry.summary);}
 /** Atomically publish a complete job collection, replacing only changed records. */
 async commitJobs(jobs){
  if(!Array.isArray(jobs))throw new Error('A complete job array is required.');
  const ids=new Set(),previousById=new Map(this.index.jobs.map(entry=>[entry.id,entry])),entries=[],staged=[],currentJobs=[];
  try{
   for(const job of jobs){
    if(!plainObject(job)||typeof job.id!=='string'||ids.has(job.id))throw new Error('Invalid or duplicate job record.');
    ids.add(job.id);const serialized=serialize(job),digest=fingerprint(serialized),previous=previousById.get(job.id);currentJobs.push(job);
    if(previous?.fingerprint===digest){entries.push(previous);continue;}
    const recordId=randomUUID(),entry={id:job.id,recordId,fingerprint:digest,summary:summary(job)};
    await this.secure.write(recordId,'record',Buffer.from(serialized));
    const verified=await this.secure.read(recordId,'record');if(!verified.equals(Buffer.from(serialized)))throw new Error('New encrypted job record failed verification.');
    staged.push(entry);entries.push(entry);
   }
   const next={schema:1,jobs:entries};await this.writeIndex(next);this.index=next;
  }catch(error){for(const entry of staged)await this.secure.remove(entry.recordId,'record').catch(()=>{});throw error;}
  const nextIds=new Set(ids);for(const job of currentJobs)if(this.cache.has(job.id))this.cacheJob(job);for(const id of [...this.cache.keys()])if(!nextIds.has(id))this.dropCache(id);
  for(const previous of previousById.values())if(!nextIds.has(previous.id)||staged.some(entry=>entry.id===previous.id))await this.secure.remove(previous.recordId,'record').catch(()=>{});
  return this.listSummaries();
 }
 async deleteJob(id){const previous=this.index.jobs.find(item=>item.id===id);if(!previous)return false;const next={schema:1,jobs:this.index.jobs.filter(item=>item.id!==id)};await this.writeIndex(next);this.index=next;this.dropCache(id);await this.secure.remove(previous.recordId,'record').catch(()=>{});return true;}
 dropCache(id){const old=this.cache.get(id);if(old){this.cache.delete(id);this.cacheSize-=old.bytes;}}
 async pruneExpired({now=Date.now(),retentionMs=30*86400000}={}){const expired=this.index.jobs.filter(entry=>TERMINAL.has(entry.summary.status)&&entry.summary.finishedAt&&now-entry.summary.finishedAt>retentionMs);if(!expired.length)return 0;const ids=new Set(expired.map(entry=>entry.id)),next={schema:1,jobs:this.index.jobs.filter(entry=>!ids.has(entry.id))};await this.writeIndex(next);this.index=next;for(const entry of expired){this.dropCache(entry.id);await this.secure.remove(entry.recordId,'record').catch(()=>{});}return expired.length;}
 async migrateFromLegacy(jobs){if(!Array.isArray(jobs))throw new Error('Legacy jobs must be an array.');if(this.index.jobs.length)throw new Error('Job store migration target is not empty.');const entries=[];try{for(const job of jobs){if(!plainObject(job)||typeof job.id!=='string'||entries.some(entry=>entry.id===job.id))throw new Error('Invalid or duplicate legacy job.');const serialized=serialize(job),recordId=randomUUID();await this.secure.write(recordId,'record',Buffer.from(serialized));entries.push({id:job.id,recordId,fingerprint:fingerprint(serialized),summary:summary(job)});}for(const entry of entries){const loaded=JSON.parse((await this.secure.read(entry.recordId,'record')).toString());if(serialize(loaded)!==serialize(jobs.find(job=>job.id===entry.id)))throw new Error('Legacy job verification failed.');}const next={schema:1,jobs:entries};await this.writeIndex(next);this.index=next;for(const job of jobs)this.cacheJob(job);return this.listSummaries();}catch(error){for(const entry of entries)await this.secure.remove(entry.recordId,'record').catch(()=>{});throw error;}}
 async loadAll(){const jobs=[];for(const entry of this.index.jobs)jobs.push(await this.getJob(entry.id));return jobs;}
}
