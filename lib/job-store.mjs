import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {SecureStore} from './secure-store.mjs';

const INDEX_ID='job-index-00000000000000000000000000000000';
const INDEX_JOURNAL_ID='job-transaction-000000000000000000000000000000';
const INDEX_SCHEMA=2;
const TERMINAL=new Set(['succeeded','failed','cancelled','expired']);

function summary(job){return {id:job.id,status:job.status,stage:job.stage||'',createdAt:job.createdAt||0,startedAt:job.startedAt||null,finishedAt:job.finishedAt||null,owner:job.owner||'',provider:job.provider||'chatgpt',model:job.model||'',targetLanguage:job.targetLanguage||'',names:Array.isArray(job.names)?job.names.slice(0,10):[],detected:job.detected?.documentType?{documentType:job.detected.documentType}:null,revision:job.review?.version||1,hasResult:Boolean(job.result),hasQuestions:Array.isArray(job.questions)&&job.questions.length>0,canRetry:job.status==='failed'&&Boolean(job.payload),interrupted:job.interrupted===true,retryAfterAt:job.retryAfterAt||null,budgetConsentRequired:job.budgetConsentRequired===true};}
export function jobDocumentGroup(job){const detected=job.detected?.documentType||'Dokumenttyp noch nicht erkannt';return /führerschein|driving licen[cs]e/i.test(detected)?'Führerscheine':/geburtsurkunde|birth certificate/i.test(detected)?'Geburtsurkunden':/(?:^|\s)pass(?:\s|$)|passport/i.test(detected)?'Pässe':detected;}
function plainObject(value){return value&&typeof value==='object'&&!Array.isArray(value);}
function corruptedStoreError(cause,message='Encrypted job-store data is damaged.'){const error=new Error(message,{cause});error.code='ERR_FOLIQUO_JOB_STORE_CORRUPT';return error;}
function isIntegrityError(error){return error?.code==='ENOENT'||/authentication failed|unsupported secure object format|secure object is incomplete|secure object header is invalid|secure object is not a regular file|invalid job index|encrypted job|job record references an unindexed secure object/i.test(error?.message||'');}
function validateIndex(index){
 if(!plainObject(index)||![1,INDEX_SCHEMA].includes(index.schema)||!Array.isArray(index.jobs))throw new Error('Invalid job index.');
 const ids=new Set();
 for(const entry of index.jobs)if(!plainObject(entry)||typeof entry.id!=='string'||typeof entry.recordId!=='string'||!plainObject(entry.summary)||entry.summary.id!==entry.id||entry.fingerprint!==undefined&&!/^[a-f0-9]{64}$/.test(entry.fingerprint)||entry.fingerprintVersion!==undefined&&entry.fingerprintVersion!==2||entry.recordFingerprint!==undefined&&!/^[a-f0-9]{64}$/.test(entry.recordFingerprint)||entry.objects!==undefined&&(!Array.isArray(entry.objects)||entry.objects.some(object=>!plainObject(object)||typeof object.id!=='string'||typeof object.type!=='string'||!['buffer','base64','utf8'].includes(object.encoding)||!Number.isSafeInteger(object.length)||object.length<0||typeof object.path!=='string'))||ids.has(entry.id))throw new Error('Invalid job index entry.');else ids.add(entry.id);
 return index;
}
function serialize(job){return JSON.stringify(job);}
function fingerprint(serialized){return createHash('sha256').update(serialized).digest('hex');}
const JSON_CHUNK=64*1024;
async function* jsonValue(value,seen=new WeakSet(),arrayItem=false,key='',skipToJSON=false){
 if(!skipToJSON&&value&&typeof value==='object'&&typeof value.toJSON==='function'){value=value.toJSON(key);skipToJSON=true;}
 if(typeof value==='string'){
  yield Buffer.from('"');for(let start=0;start<value.length;){let end=Math.min(value.length,start+JSON_CHUNK);if(end<value.length&&end>start){const before=value.charCodeAt(end-1),after=value.charCodeAt(end);if(before>=0xd800&&before<=0xdbff&&after>=0xdc00&&after<=0xdfff)end--;}yield Buffer.from(JSON.stringify(value.slice(start,end)).slice(1,-1));start=end;}yield Buffer.from('"');return;
 }
 if(value===null||typeof value==='boolean'){yield Buffer.from(JSON.stringify(value));return;}
 if(typeof value==='number'){yield Buffer.from(Number.isFinite(value)?JSON.stringify(value):'null');return;}
 if(typeof value==='bigint')throw new TypeError('BigInt job values cannot be persisted.');
 if(value===undefined||typeof value==='function'||typeof value==='symbol'){if(arrayItem)yield Buffer.from('null');return;}
 if(typeof value!=='object')return;
 if(seen.has(value))throw new TypeError('Circular job values cannot be persisted.');seen.add(value);
 if(Array.isArray(value)){
  yield Buffer.from('[');for(let index=0;index<value.length;index++){if(index)yield Buffer.from(',');yield* jsonValue(value[index],seen,true,String(index));}yield Buffer.from(']');
 }else{
  yield Buffer.from('{');let first=true;for(const childKey of Object.keys(value)){const item=value[childKey];if(item===undefined||typeof item==='function'||typeof item==='symbol')continue;if(!first)yield Buffer.from(',');first=false;yield Buffer.from(JSON.stringify(childKey));yield Buffer.from(':');yield* jsonValue(item,seen,false,childKey);}yield Buffer.from('}');
 }
 seen.delete(value);
}
async function verifyRecord(secure,id,expectedHash){
 let actualHash;await secure.withDecryptedObject(id,'record',async path=>{const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);actualHash=hash.digest('hex');});
 if(actualHash!==expectedHash)throw new Error('New encrypted job record failed verification.');
}
async function readRecord(secure,entry){
 let job,recordFingerprint;await secure.withDecryptedObject(entry.recordId,'record',async path=>{
  const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);recordFingerprint=hash.digest('hex');
  if(entry.recordFingerprint&&recordFingerprint!==entry.recordFingerprint)throw new Error('Encrypted job record does not match its index fingerprint.');
  job=JSON.parse(await readFile(path,'utf8'));
 });return {job,recordFingerprint};
}
async function writeRecord(secure,id,record){
 const hash=createHash('sha256'),source=(async function*(){for await(const chunk of jsonValue(record)){hash.update(chunk);yield chunk;}})();await secure.write(id,'record',source);const digest=hash.digest('hex');await verifyRecord(secure,id,digest);return digest;
}
function stateFingerprint(value){
 const hash=createHash('sha256'),active=new WeakSet();
 const length=value=>{const bytes=Buffer.allocUnsafe(8);bytes.writeBigUInt64BE(BigInt(value));hash.update(bytes);};
 const text=value=>{hash.update('s');length(Buffer.byteLength(value));hash.update(value);};
 const binary=value=>{hash.update('b');length(value.length);if(Buffer.isBuffer(value)||value instanceof Uint8Array){hash.update(value);return;}for(let offset=0;offset<value.length;offset+=64*1024){const end=Math.min(value.length,offset+64*1024),chunk=Buffer.allocUnsafe(end-offset);for(let i=offset;i<end;i++)chunk[i-offset]=value[i];hash.update(chunk);}};
 const visit=(item,inArray=false)=>{
  if(item===null||item===undefined||typeof item==='function'||typeof item==='symbol'){hash.update(inArray?'n':'u');return;}
  if(typeof item==='string'){text(item);return;}
  if(typeof item==='boolean'){hash.update(item?'t':'f');return;}
  if(typeof item==='number'){if(!Number.isFinite(item)){hash.update('n');return;}hash.update('d');text(Object.is(item,-0)?'0':String(item));return;}
  if(typeof item==='bigint')throw new TypeError('BigInt job values cannot be persisted.');
  if(Buffer.isBuffer(item)||item instanceof Uint8Array){binary(item);return;}
  if(item instanceof Date){text(item.toJSON());return;}
  if(active.has(item))throw new TypeError('Circular job values cannot be persisted.');active.add(item);
  if(Array.isArray(item)){hash.update('a');length(item.length);for(let i=0;i<item.length;i++)visit(item[i],true);hash.update('A');active.delete(item);return;}
  if(item.type==='Buffer'&&Array.isArray(item.data)&&item.data.every(byte=>Number.isInteger(byte)&&byte>=0&&byte<=255)){binary(item.data);active.delete(item);return;}
  const keys=Object.keys(item).filter(key=>item[key]!==undefined&&typeof item[key]!=='function'&&typeof item[key]!=='symbol');hash.update('o');length(keys.length);for(const key of keys){text(key);visit(item[key]);}hash.update('O');active.delete(item);
 };
 visit(value);return hash.digest('hex');
}
function cacheWeight(value,seen=new WeakSet()){
 if(value===null||value===undefined)return 8;
 if(typeof value==='string')return value.length*2+48;
 if(typeof value==='number'||typeof value==='boolean')return 8;
 if(typeof value!=='object')return 0;
 if(Buffer.isBuffer(value)||value instanceof Uint8Array)return value.byteLength+64;
 if(seen.has(value))return 0;seen.add(value);
 if(Array.isArray(value)){let size=48+value.length*8;for(const item of value)size+=cacheWeight(item,seen);return size;}
 let size=64;for(const [key,item]of Object.entries(value))size+=key.length*2+16+cacheWeight(item,seen);return size;
}
const OBJECT_REF='__foliquoSecureObject';
function externalBase64(path){return path.length===2&&path[0]==='result'&&['pdf','word'].includes(path[1])||path.length===4&&path[0]==='result'&&['previews','originalPreviews'].includes(path[1])&&/^\d+$/.test(path[2])&&path[3]==='data';}
async function* decodeBase64(value){const step=64*1024;for(let offset=0;offset<value.length;offset+=step)yield Buffer.from(value.slice(offset,offset+step),'base64');}
async function* encodeUtf8(value){for(let start=0;start<value.length;){let end=Math.min(value.length,start+JSON_CHUNK);if(end<value.length&&end>start){const before=value.charCodeAt(end-1),after=value.charCodeAt(end);if(before>=0xd800&&before<=0xdbff&&after>=0xdc00&&after<=0xdfff)end--;}yield Buffer.from(value.slice(start,end),'utf8');start=end;}}
function decodedLength(value){const padding=value.endsWith('==')?2:value.endsWith('=')?1:0;return Math.floor(value.length*3/4)-padding;}
function isBase64(value){if(value.length%4!==0)return false;let dataLength=value.length;while(dataLength>0&&value[dataLength-1]==='=')dataLength--;const padding=value.length-dataLength;if(padding>2||padding===2&&dataLength%4!==2||padding===1&&dataLength%4!==3||padding===0&&dataLength%4!==0)return false;for(let offset=0;offset<dataLength;offset+=64*1024)if(!/^[A-Za-z0-9+/]*$/.test(value.slice(offset,Math.min(dataLength,offset+64*1024))))return false;return true;}
async function externalizeValue(value,secure,objects,path){
 if(Buffer.isBuffer(value)||value instanceof Uint8Array){const id=randomUUID(),type='original',encoding='buffer',length=value.length;await secure.write(id,type,value);objects.push({id,type,encoding,length,path:JSON.stringify(path)});return {[OBJECT_REF]:{id,type,encoding}};}
 if(typeof value==='string'&&externalBase64(path)&&isBase64(value)){const id=randomUUID(),type='export',encoding='base64',length=decodedLength(value);await secure.write(id,type,decodeBase64(value));objects.push({id,type,encoding,length,path:JSON.stringify(path)});return {[OBJECT_REF]:{id,type,encoding}};}
 if(typeof value==='string'&&path[0]==='result'&&Buffer.byteLength(value)>1024*1024){const id=randomUUID(),type='working',encoding='utf8',length=Buffer.byteLength(value);await secure.write(id,type,encodeUtf8(value));objects.push({id,type,encoding,length,path:JSON.stringify(path)});return {[OBJECT_REF]:{id,type,encoding}};}
 if(Array.isArray(value)){const result=[];for(let i=0;i<value.length;i++)result.push(await externalizeValue(value[i],secure,objects,[...path,String(i)]));return result;}
 if(value&&typeof value==='object'){
  if(value.type==='Buffer'&&Array.isArray(value.data)&&value.data.every(byte=>Number.isInteger(byte)&&byte>=0&&byte<=255)){const bytes=Buffer.from(value.data);return externalizeValue(bytes,secure,objects,path);}
  const result={};for(const [key,item]of Object.entries(value))result[key]=await externalizeValue(item,secure,objects,[...path,key]);return result;
 }
 return value;
}
async function externalize(value,secure,objects){try{return await externalizeValue(value,secure,objects,[]);}catch(error){await removeObjects(secure,objects);objects.length=0;throw error;}}
async function hydrateObjects(value,secure,allowed){
 if(Array.isArray(value)){const result=[];for(const item of value)result.push(await hydrateObjects(item,secure,allowed));return result;}
 if(value&&typeof value==='object'){
  const ref=value[OBJECT_REF];
  if(ref&&Object.keys(value).length===1){if(typeof ref.id!=='string'||typeof ref.type!=='string'||!allowed.has(`${ref.type}:${ref.id}`))throw new Error('Job record references an unindexed secure object.');if(ref.encoding==='utf8')return secure.withDecryptedObject(ref.id,ref.type,path=>readFile(path,'utf8'));const bytes=await secure.read(ref.id,ref.type);if(ref.encoding==='base64')return bytes.toString('base64');if(ref.encoding==='buffer')return bytes;throw new Error('Job record secure object encoding is invalid.');}
  const result={};for(const [key,item]of Object.entries(value))result[key]=await hydrateObjects(item,secure,allowed);return result;
 }
 return value;
}
async function hydrateTextObjects(value,secure,allowed){
 if(Array.isArray(value)){const result=[];for(const item of value)result.push(await hydrateTextObjects(item,secure,allowed));return result;}
 if(value&&typeof value==='object'){
  const ref=value[OBJECT_REF];if(ref&&Object.keys(value).length===1){if(ref.encoding!=='utf8')return value;if(typeof ref.id!=='string'||typeof ref.type!=='string'||!allowed.has(`${ref.type}:${ref.id}`))throw new Error('Job record references an unindexed secure object.');return secure.withDecryptedObject(ref.id,ref.type,path=>readFile(path,'utf8'));}
  const result={};for(const [key,item]of Object.entries(value))result[key]=await hydrateTextObjects(item,secure,allowed);return result;
 }
 return value;
}
async function removeObjects(secure,objects=[]){for(const object of objects)await secure.remove(object.id,object.type).catch(()=>{});}

/** Versioned encrypted job records with an atomic encrypted summary index. */
export class JobStore {
 constructor(directory,key,{cacheBytes=32*1024*1024}={}){this.secure=new SecureStore(directory,key);this.cacheBytes=cacheBytes;this.index={schema:INDEX_SCHEMA,jobs:[]};this.cache=new Map();this.cacheSize=0;}
 async init({workspaceGeneration}={}){
  await this.secure.cleanupInterruptedWrites();
  let journalBytes;
  try{journalBytes=await this.secure.read(INDEX_JOURNAL_ID,'recovery');}
  catch(error){if(error.code!=='ENOENT'){if(isIntegrityError(error))throw corruptedStoreError(error);throw error;}}
  if(journalBytes){
   let journal;try{journal=JSON.parse(journalBytes.toString());}catch(error){throw corruptedStoreError(error);}
   if(!plainObject(journal)||journal.schema!==1||typeof journal.transactionId!=='string'||!/^[a-f0-9-]{36}$/.test(journal.transactionId))throw corruptedStoreError(new Error('Invalid job-store recovery journal.'));
   try{validateIndex(journal.priorIndex);validateIndex(journal.nextIndex);}catch(error){throw corruptedStoreError(error);}
   const committed=workspaceGeneration===journal.transactionId;
   await this.writeIndex(committed?journal.nextIndex:journal.priorIndex);
   await this.secure.remove(INDEX_JOURNAL_ID,'recovery');
  }
  try{
   const bytes=await this.secure.read(INDEX_ID,'record'),index=JSON.parse(bytes.toString());
   this.index=validateIndex(index);
  }catch(error){if(error.code==='ENOENT'){if(workspaceGeneration)throw corruptedStoreError(new Error('The committed job index is missing.'));await this.writeIndex(this.index);}else if(isIntegrityError(error)||error instanceof SyntaxError)throw corruptedStoreError(error);else throw error;}
  return this;
 }
 async writeIndex(index){await this.secure.write(INDEX_ID,'record',Buffer.from(JSON.stringify(index)));}
 listSummaries({owner}={}){return this.index.jobs.filter(entry=>owner===undefined||entry.summary.owner===owner).map(entry=>structuredClone(entry.summary));}
 async loadByStatuses(statuses){
  if(!Array.isArray(statuses)||statuses.some(status=>typeof status!=='string'))throw new Error('Job statuses must be a string array.');
  const allowed=new Set(statuses);return Promise.all(this.index.jobs.filter(entry=>allowed.has(entry.summary.status)).map(entry=>this.getJob(entry.id)));
 }
 listSummariesPage({owner,offset=0,limit=50,query='',type=''}={}){
  if(!Number.isSafeInteger(offset)||offset<0)throw new Error('Invalid job history offset.');
  if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('Invalid job history page size.');
  if(typeof query!=='string'||query.length>160||typeof type!=='string'||type.length>120)throw new Error('Invalid job history filter.');
  const owned=this.index.jobs.filter(entry=>owner===undefined||entry.summary.owner===owner).map(entry=>entry.summary);
  const types=[...new Set(owned.map(jobDocumentGroup))].sort((a,b)=>a.localeCompare(b));
  const needle=query.trim().normalize('NFKC').toLocaleLowerCase();
  const summaries=owned.filter(entry=>(!type||jobDocumentGroup(entry)===type)&&(!needle||[...(entry.names||[]),entry.detected?.documentType||''].join(' ').normalize('NFKC').toLocaleLowerCase().includes(needle)));
  summaries.sort((a,b)=>(b.finishedAt||b.createdAt||0)-(a.finishedAt||a.createdAt||0)||a.id.localeCompare(b.id));
  const jobs=summaries.slice(offset,offset+limit).map(({owner:_owner,...entry})=>structuredClone(entry));
  return {jobs,total:summaries.length,offset,limit,hasMore:offset+jobs.length<summaries.length,types};
 }
 cacheJob(job){const bytes=cacheWeight(job);if(bytes>this.cacheBytes)return;const old=this.cache.get(job.id);if(old){this.cacheSize-=old.bytes;this.cache.delete(job.id);}while(this.cacheSize+bytes>this.cacheBytes&&this.cache.size){const [id,item]=this.cache.entries().next().value;this.cache.delete(id);this.cacheSize-=item.bytes;}this.cache.set(job.id,{job,bytes});this.cacheSize+=bytes;}
 async getJobMetadata(id,owner){const entry=this.index.jobs.find(item=>item.id===id&&item.summary.owner===owner);if(!entry)return null;let job;try{const parsed=await readRecord(this.secure,entry);entry.recordFingerprint||=parsed.recordFingerprint;job=parsed.job;}catch(error){if(isIntegrityError(error)||error instanceof SyntaxError)throw corruptedStoreError(error,'Encrypted job record is invalid.');throw error;}if(job?.id!==id||job?.owner!==owner)throw corruptedStoreError(new Error('Encrypted job record does not match its index.'),'Encrypted job record is invalid.');const objects=new Map((entry.objects||[]).map(object=>[object.path,object])),seen=new Set();const validate=(value,path=[])=>{if(Array.isArray(value)){for(let index=0;index<value.length;index++)validate(value[index],[...path,String(index)]);return;}if(!value||typeof value!=='object')return;const ref=value[OBJECT_REF];if(ref&&Object.keys(value).length===1){const key=JSON.stringify(path),stored=objects.get(key);if(!stored||stored.id!==ref.id||stored.type!==ref.type||stored.encoding!==ref.encoding)throw new Error('Encrypted job object reference does not match its index.');seen.add(key);return;}for(const [key,item]of Object.entries(value))validate(item,[...path,key]);};try{validate(job);if(seen.size!==objects.size)throw new Error('Encrypted job index contains an unreferenced object.');job=await hydrateTextObjects(job,this.secure,new Set((entry.objects||[]).map(object=>`${object.type}:${object.id}`)));}catch(error){if(error.code&&!isIntegrityError(error))throw error;throw corruptedStoreError(error,'Encrypted job record is invalid.');}return job;}
 async getJob(id){const cached=this.cache.get(id);if(cached){this.cache.delete(id);this.cache.set(id,cached);return cached.job;}const entry=this.index.jobs.find(item=>item.id===id);if(!entry)return null;let parsed;try{parsed=await readRecord(this.secure,entry);}catch(error){if(isIntegrityError(error)||error instanceof SyntaxError)throw corruptedStoreError(error,'Encrypted job record is invalid.');throw error;}let job;try{job=await hydrateObjects(parsed.job,this.secure,new Set((entry.objects||[]).map(object=>`${object.type}:${object.id}`)));}catch(error){if(error.message==='Job record references an unindexed secure object.'||isIntegrityError(error))throw corruptedStoreError(error,'Encrypted job record is invalid.');throw new Error('Encrypted job record is invalid.',{cause:error});}if(job?.id!==id)throw corruptedStoreError(new Error('Encrypted job record does not match its index.'),'Encrypted job record is invalid.');if(entry.fingerprintVersion!==2){if(!entry.recordFingerprint&&entry.fingerprint&&fingerprint(serialize(job))!==entry.fingerprint)throw corruptedStoreError(new Error('Encrypted job record does not match its index fingerprint.'),'Encrypted job record is invalid.');entry.recordFingerprint||=parsed.recordFingerprint;entry.fingerprint=stateFingerprint(job);entry.fingerprintVersion=2;}this.cacheJob(job);return job;}
 getObjectInfo(id,path,owner){const entry=this.index.jobs.find(item=>item.id===id&&item.summary.owner===owner);if(!entry)return null;const stored=(entry.objects||[]).find(object=>object.path===JSON.stringify(path));return stored?{type:stored.type,encoding:stored.encoding,size:stored.length}:null;}
 async withJobObject(id,path,owner,consume){
  if(!Array.isArray(path)||path.length<2||path.length>8||path.some(part=>typeof part!=='string'&&(!Number.isSafeInteger(part)||part<0)))throw new Error('Invalid job object path.');
  const entry=this.index.jobs.find(item=>item.id===id&&item.summary.owner===owner);if(!entry)throw new Error('Auftrag nicht gefunden.');
  const stored=(entry.objects||[]).find(object=>object.path===JSON.stringify(path));if(!stored)return false;
  try{let record;try{record=(await readRecord(this.secure,entry)).job;}catch(error){if(isIntegrityError(error)||error instanceof SyntaxError)throw corruptedStoreError(error,'Encrypted job record is invalid.');throw error;}
   let value=record;for(const part of path)value=value?.[part];const ref=value?.[OBJECT_REF];if(!ref||ref.id!==stored.id||ref.type!==stored.type||ref.encoding!==stored.encoding)throw corruptedStoreError(new Error('Encrypted job object reference does not match its index.'),'Encrypted job record is invalid.');
   await this.secure.withDecryptedObject(stored.id,stored.type,tempPath=>consume({tempPath,size:stored.length,encoding:stored.encoding}));return true;
  }catch(error){if(error.code==='ERR_FOLIQUO_JOB_STORE_CORRUPT')throw error;if(isIntegrityError(error))throw corruptedStoreError(error,'Encrypted job object is invalid.');throw error;}
 }
 async commitJob(job){if(!plainObject(job)||typeof job.id!=='string')throw new Error('A valid job record is required.');const digest=stateFingerprint(job),recordId=randomUUID(),objects=[];let record;try{record=await externalize(job,this.secure,objects);const recordFingerprint=await writeRecord(this.secure,recordId,record);const entry={id:job.id,recordId,fingerprint:digest,fingerprintVersion:2,recordFingerprint,objects,summary:summary(job)},previous=this.index.jobs.find(item=>item.id===job.id),next={schema:INDEX_SCHEMA,jobs:this.index.jobs.filter(item=>item.id!==job.id).concat(entry)};await this.writeIndex(next);this.index=next;this.cacheJob(job);if(previous){await this.secure.remove(previous.recordId,'record').catch(()=>{});await removeObjects(this.secure,previous.objects);}return structuredClone(entry.summary);}catch(error){await this.secure.remove(recordId,'record').catch(()=>{});await removeObjects(this.secure,objects);throw error;}}
 /** Atomically publish a complete job collection, replacing only changed records. */
 async commitJobs(jobs,{replace=true,deferCleanup=false,transactionId=randomUUID()}={}){
  if(!Array.isArray(jobs)&&typeof jobs?.[Symbol.asyncIterator]!=='function')throw new Error('A complete job array or async job stream is required.');
  if(typeof replace!=='boolean'||typeof deferCleanup!=='boolean')throw new Error('Job commit mode must be explicit.');
  if(deferCleanup&&(typeof transactionId!=='string'||!/^[a-f0-9-]{36}$/.test(transactionId)))throw new Error('A workspace transaction id is required for deferred job commits.');
  const priorIndex=this.index,ids=new Set(),previousById=new Map(priorIndex.jobs.map(entry=>[entry.id,entry])),entriesById=new Map(replace?[]:priorIndex.jobs.map(entry=>[entry.id,entry])),staged=[],replacedIds=new Set(),currentJobs=Array.isArray(jobs)?[]:null;
  try{
   for await(const job of jobs){
    if(!plainObject(job)||typeof job.id!=='string'||ids.has(job.id))throw new Error('Invalid or duplicate job record.');
    ids.add(job.id);const digest=stateFingerprint(job),previous=previousById.get(job.id);currentJobs?.push(job);
    const unchanged=Boolean(previous)&&(previous.fingerprintVersion===2?previous.fingerprint===digest:previous.fingerprint===fingerprint(serialize(job)));
    if(unchanged){entriesById.set(job.id,previous);continue;}
    const recordId=randomUUID(),objects=[],record=await externalize(job,this.secure,objects),entry={id:job.id,recordId,fingerprint:digest,fingerprintVersion:2,objects,summary:summary(job)};
    staged.push(entry);entry.recordFingerprint=await writeRecord(this.secure,recordId,record);
    entriesById.set(job.id,entry);if(previous)replacedIds.add(job.id);
   }
   const next={schema:INDEX_SCHEMA,jobs:[...entriesById.values()]};
   if(deferCleanup)await this.secure.write(INDEX_JOURNAL_ID,'recovery',Buffer.from(JSON.stringify({schema:1,transactionId,priorIndex,nextIndex:next})));
   await this.writeIndex(next);this.index=next;
  }catch(error){let restoredIndex=false;if(deferCleanup)try{await this.secure.write(INDEX_ID,'record',Buffer.from(JSON.stringify(priorIndex)));restoredIndex=true;}catch{}for(const entry of staged){await this.secure.remove(entry.recordId,'record').catch(()=>{});await removeObjects(this.secure,entry.objects);}if(deferCleanup&&restoredIndex)await this.secure.remove(INDEX_JOURNAL_ID,'recovery').catch(()=>{});throw error;}
  const nextIds=new Set(entriesById.keys());
  const finalize=async()=>{for(const job of currentJobs||[])this.cacheJob(job);if(!currentJobs)for(const id of replacedIds)this.dropCache(id);if(replace)for(const id of [...this.cache.keys()])if(!nextIds.has(id))this.dropCache(id);for(const previous of previousById.values())if(!nextIds.has(previous.id)||replacedIds.has(previous.id)){await this.secure.remove(previous.recordId,'record').catch(()=>{});await removeObjects(this.secure,previous.objects);}};
  if(!deferCleanup){await finalize();return this.listSummaries();}
  let settled=false;
  return {summaries:this.listSummaries(),commit:async()=>{if(settled)return;await finalize();await this.secure.remove(INDEX_JOURNAL_ID,'recovery');settled=true;},rollback:async()=>{if(settled)return;await this.writeIndex(priorIndex);this.index=priorIndex;this.cache.clear();this.cacheSize=0;for(const entry of staged){await this.secure.remove(entry.recordId,'record').catch(()=>{});await removeObjects(this.secure,entry.objects);}await this.secure.remove(INDEX_JOURNAL_ID,'recovery');settled=true;}};
 }
 async commitSubset(jobs){return this.commitJobs(jobs,{replace:false});}
 async deleteJob(id){const previous=this.index.jobs.find(item=>item.id===id);if(!previous)return false;const next={schema:INDEX_SCHEMA,jobs:this.index.jobs.filter(item=>item.id!==id)};await this.writeIndex(next);this.index=next;this.dropCache(id);await this.secure.remove(previous.recordId,'record').catch(()=>{});await removeObjects(this.secure,previous.objects);return true;}
 dropCache(id){const old=this.cache.get(id);if(old){this.cache.delete(id);this.cacheSize-=old.bytes;}}
 async pruneExpired({now=Date.now(),retentionMs=30*86400000}={}){const expired=this.index.jobs.filter(entry=>TERMINAL.has(entry.summary.status)&&entry.summary.finishedAt&&now-entry.summary.finishedAt>retentionMs);if(!expired.length)return 0;const ids=new Set(expired.map(entry=>entry.id)),next={schema:INDEX_SCHEMA,jobs:this.index.jobs.filter(entry=>!ids.has(entry.id))};await this.writeIndex(next);this.index=next;for(const entry of expired){this.dropCache(entry.id);await this.secure.remove(entry.recordId,'record').catch(()=>{});await removeObjects(this.secure,entry.objects);}return expired.length;}
 async migrateFromLegacy(jobs){if(!Array.isArray(jobs))throw new Error('Legacy jobs must be an array.');if(this.index.jobs.length)throw new Error('Job store migration target is not empty.');const entries=[];try{for(const job of jobs){if(!plainObject(job)||typeof job.id!=='string'||entries.some(entry=>entry.id===job.id))throw new Error('Invalid or duplicate legacy job.');const digest=stateFingerprint(job),recordId=randomUUID(),objects=[],record=await externalize(job,this.secure,objects),entry={id:job.id,recordId,fingerprint:digest,fingerprintVersion:2,objects,summary:summary(job)};entries.push(entry);entry.recordFingerprint=await writeRecord(this.secure,recordId,record);}for(const entry of entries){const loaded=await hydrateObjects(JSON.parse((await this.secure.read(entry.recordId,'record')).toString()),this.secure,new Set((entry.objects||[]).map(object=>`${object.type}:${object.id}`)));if(stateFingerprint(loaded)!==entry.fingerprint)throw new Error('Legacy job verification failed.');}const next={schema:INDEX_SCHEMA,jobs:entries};await this.writeIndex(next);this.index=next;for(const job of jobs)this.cacheJob(job);return this.listSummaries();}catch(error){for(const entry of entries){await this.secure.remove(entry.recordId,'record').catch(()=>{});await removeObjects(this.secure,entry.objects);}throw error;}}
 async loadAll(){const jobs=[];for(const entry of this.index.jobs)jobs.push(await this.getJob(entry.id));return jobs;}
 async *iterateJobs({owner}={}){for(const entry of this.index.jobs){if(owner!==undefined&&entry.summary.owner!==owner)continue;const job=await this.getJob(entry.id);if(job)yield job;}}
}
