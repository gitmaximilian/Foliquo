import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {JobStore} from '../lib/job-store.mjs';

const fictionalJob=(id,finishedAt=1000)=>({id,owner:'fictional-owner',status:'succeeded',stage:'done',createdAt:100,finishedAt,provider:'chatgpt',model:'fictional-model',targetLanguage:'Deutsch',names:['fictional.pdf'],result:{text:'fictional result',pdf:'FAKE'},questions:[],review:{version:1}});
async function fixture(t){const directory=await mkdtemp(join(tmpdir(),'foliquo-job-store-')),store=await new JobStore(directory,randomBytes(32)).init();t.after(()=>rm(directory,{recursive:true,force:true}));return {directory,store};}

test('job records commit atomically and the library index exposes bounded summaries only',async t=>{
 const {directory,store}=await fixture(t),first=fictionalJob('fictional-job-0001');await store.commitJob(first);
 const summaries=store.listSummaries({owner:'fictional-owner'});assert.equal(summaries.length,1);assert.equal(summaries[0].hasResult,true);assert.equal(JSON.stringify(summaries).includes('fictional result'),false);assert.equal(JSON.stringify(summaries).includes('FAKE'),false);
 const reopened=await new JobStore(directory,store.secure.key).init(),loaded=await reopened.getJob(first.id);assert.equal(loaded.result.text,'fictional result');loaded.result.text='revised fictional result';loaded.review.version=2;await reopened.commitJob(loaded);
 const afterRestart=await new JobStore(directory,store.secure.key).init();assert.equal((await afterRestart.getJob(first.id)).review.version,2);assert.equal(await afterRestart.deleteJob(first.id),true);assert.deepEqual(afterRestart.listSummaries(),[]);assert.equal(await afterRestart.deleteJob(first.id),false);
});

test('large archived jobs verify a compact record digest without JSON-stringifying hydrated payloads',async t=>{
 const {directory,store}=await fixture(t),bytes=Buffer.alloc(256*1024,0x5a),job={...fictionalJob('fictional-large-record'),payload:{files:[{name:'fictional-large.pdf',bytes}]}};store.cacheBytes=8*1024*1024;await store.commitJob(job);
 const entry=store.index.jobs[0];assert.match(entry.recordFingerprint,/^[a-f0-9]{64}$/);const persisted=await store.secure.read(entry.recordId,'record');assert.equal(createHash('sha256').update(persisted).digest('hex'),entry.recordFingerprint);
 const originalStringify=JSON.stringify;JSON.stringify=function(value,...args){if(value?.id===job.id&&Buffer.isBuffer(value.payload?.files?.[0]?.bytes))throw new Error('whole archived job was serialized');return originalStringify.call(this,value,...args);};
 let loaded;try{store.dropCache(job.id);loaded=await store.getJob(job.id);}finally{JSON.stringify=originalStringify;}
 assert.ok(Buffer.isBuffer(loaded.payload.files[0].bytes));assert.equal(loaded.payload.files[0].bytes.length,bytes.length);assert.ok(store.cache.has(job.id),'the heap-weighted cache estimate permits this bounded record');
 const digest=entry.recordFingerprint;entry.recordFingerprint='0'.repeat(64);store.dropCache(job.id);await assert.rejects(()=>store.getJob(job.id),/Encrypted job record is invalid/);entry.recordFingerprint=digest;
});

test('large binary job writes and unchanged-record detection avoid Buffer JSON expansion',async t=>{
 const {store}=await fixture(t),bytes=Buffer.alloc(1024*1024,0x31),job={...fictionalJob('fictional-buffer-fingerprint'),payload:{files:[{name:'fictional-source.bin',bytes}]}};let wrote=false;const originalStringify=JSON.stringify;
 JSON.stringify=function(value,...args){if(value?.id===job.id&&Buffer.isBuffer(value.payload?.files?.[0]?.bytes))throw new Error('raw binary job was JSON-stringified');return originalStringify.call(this,value,...args);};
 try{await store.commitJobs([job]);wrote=true;}finally{JSON.stringify=originalStringify;}
 assert.ok(wrote);const first=store.index.jobs[0];assert.equal(first.fingerprintVersion,2);assert.equal(store.getObjectInfo(job.id,['payload','files','0','bytes'],'fictional-owner').size,bytes.length);
 const unchanged={...job,payload:{files:[{name:'fictional-source.bin',bytes:Buffer.from(bytes)}]}};await store.commitJobs([unchanged]);assert.equal(store.index.jobs[0].recordId,first.recordId,'equivalent Buffer content reuses the encrypted record');
 const changedBytes=Buffer.from(bytes);changedBytes[changedBytes.length-1]^=0xff;const changed={...unchanged,payload:{files:[{name:'fictional-source.bin',bytes:changedBytes}]}};await store.commitJobs([changed]);assert.notEqual(store.index.jobs[0].recordId,first.recordId,'a changed source byte creates a new encrypted record');
});

test('streamed job-record JSON preserves escaping and surrogate pairs across chunk boundaries',async t=>{
 const {store}=await fixture(t),boundary=64*1024-1,text=`${'x'.repeat(boundary)}😀\n\\"${'y'.repeat(64*1024+17)}`,job={...fictionalJob('fictional-streamed-json'),result:{text,meta:{quote:'"',slash:'\\',line:'first\nsecond'}}};await store.commitJob(job);
 const bytes=await store.secure.read(store.index.jobs[0].recordId,'record');assert.deepEqual(bytes,Buffer.from(JSON.stringify(job)));assert.equal((await store.getJob(job.id)).result.text,text);
});

test('large translation text is stored as an authenticated sidecar and metadata reads do not hydrate export binaries',async t=>{
 const {directory,store}=await fixture(t),text=`${'Fictional translated paragraph. '.repeat(70000)}😀`,job={...fictionalJob('fictional-large-text'),result:{text,pdf:Buffer.from('fictional pdf').toString('base64'),word:Buffer.from('fictional word').toString('base64')}};await store.commitJob(job);
 const entry=store.index.jobs[0],textObject=entry.objects.find(object=>object.path==='["result","text"]');assert.ok(textObject);assert.equal(textObject.encoding,'utf8');assert.equal(textObject.length,Buffer.byteLength(text));assert.ok((await store.secure.read(entry.recordId,'record')).length<2048);
 const reopened=await new JobStore(directory,store.secure.key).init(),metadata=await reopened.getJobMetadata(job.id,'fictional-owner');assert.equal(metadata.result.text,text);assert.equal(metadata.result.pdf.__foliquoSecureObject.encoding,'base64');assert.equal(metadata.result.word.__foliquoSecureObject.encoding,'base64');
 const deferred=await reopened.getJobMetadata(job.id,'fictional-owner',{deferText:true});assert.equal(typeof deferred.result.text,'object');assert.equal(reopened.getObjectInfo(job.id,['result','text'],'fictional-owner').encoding,'utf8');let streamedText='';assert.equal(await reopened.withJobObject(job.id,['result','text'],'fictional-owner',async({tempPath,encoding,size})=>{assert.equal(encoding,'utf8');assert.equal(size,Buffer.byteLength(text));streamedText=await readFile(tempPath,'utf8');}),true);assert.equal(streamedText,text);
 const full=await reopened.getJob(job.id);assert.equal(full.result.text,text);assert.equal(Buffer.from(full.result.pdf,'base64').toString(),'fictional pdf');assert.equal(Buffer.from(full.result.word,'base64').toString(),'fictional word');assert.deepEqual(full,job);const recordId=entry.recordId;await reopened.commitJobs([full]);assert.equal(reopened.index.jobs[0].recordId,recordId,'chunked fingerprinting preserves unchanged large-text records');
});

test('large segmented review checkpoints stay encrypted and are deferred during metadata polling',async t=>{
 const {directory,store}=await fixture(t),text=`${'Fictional revision response '.repeat(50000)}😀`,phase='revision-seg-fictional-0',job=fictionalJob('fictional-revision-checkpoint');job.review.segmentedRevision={status:'interrupted',checkpoints:{[phase]:{status:'complete',result:text}}};await store.commitJob(job);
 const object=store.index.jobs[0].objects.find(item=>item.path===JSON.stringify(['review','segmentedRevision','checkpoints',phase,'result']));assert.ok(object);assert.equal(object.encoding,'utf8');assert.equal(object.length,Buffer.byteLength(text));const metadata=await store.getJobMetadata(job.id,'fictional-owner');assert.equal(typeof metadata.review.segmentedRevision.checkpoints[phase].result,'object');assert.equal(JSON.stringify(metadata).includes('Fictional revision response'),false);assert.equal(await store.getJobMetadata(job.id,'other-owner'),null);
 const reopened=await new JobStore(directory,store.secure.key).init(),loaded=await reopened.getJob(job.id);assert.equal(loaded.review.segmentedRevision.checkpoints[phase].result,text);
});

test('legacy JSON fingerprints are verified once then upgraded to compact state fingerprints',async t=>{
 const {directory,store}=await fixture(t),job=fictionalJob('fictional-legacy-fingerprint');await store.commitJob(job);const entry=store.index.jobs[0],recordId=entry.recordId;entry.fingerprint=createHash('sha256').update(JSON.stringify(job)).digest('hex');delete entry.fingerprintVersion;delete entry.recordFingerprint;await store.writeIndex(store.index);
 const reopened=await new JobStore(directory,store.secure.key).init(),loaded=await reopened.getJob(job.id),upgraded=reopened.index.jobs[0];assert.equal(loaded.result.text,job.result.text);assert.equal(upgraded.fingerprintVersion,2);assert.match(upgraded.recordFingerprint,/^[a-f0-9]{64}$/);assert.equal(upgraded.recordId,recordId);await reopened.commitJobs([loaded]);assert.equal(reopened.index.jobs[0].recordId,recordId,'an unchanged legacy record remains reusable after its one-time upgrade');
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

test('process exits at JobStore commit boundaries reopen as a complete old or new job',async t=>{
 const moduleUrl=new URL('../lib/job-store.mjs',import.meta.url).href,indexId='job-index-00000000000000000000000000000000';
 const child=`import {JobStore} from ${JSON.stringify(moduleUrl)};
const directory=process.argv[1],key=Buffer.from(process.argv[2],'base64'),point=process.argv[3],store=await new JobStore(directory,key).init(),write=store.secure.write.bind(store.secure);
if(point==='during-plaintext-staging')await store.secure.withDecryptedObject(process.argv[4],'original',async()=>process.exit(74));
store.secure.write=async(id,type,source)=>{if(point==='during-object-write'&&type==='original'){async function* partial(){yield Buffer.from('partial encrypted fixture');process.exit(70);}return await write(id,type,partial());}const result=await write(id,type,source);if(point==='after-object'&&type==='original')process.exit(71);if(point==='after-record'&&type==='record'&&id!==${JSON.stringify(indexId)})process.exit(72);if(point==='after-index'&&id===${JSON.stringify(indexId)})process.exit(73);return result;};
await store.commitJob({id:'fictional-crash-job',owner:'fictional-owner',status:'succeeded',createdAt:1,finishedAt:2,payload:{files:[{name:'fictional.bin',bytes:Buffer.from('new-payload')}]},result:{text:'new-state'},questions:[]});`;
 for(const [point,exitCode,expectedText,expectedBytes]of [['during-object-write',70,'old-state','old-payload'],['after-object',71,'old-state','old-payload'],['after-record',72,'old-state','old-payload'],['after-index',73,'new-state','new-payload'],['during-plaintext-staging',74,'old-state','old-payload']]){
  const {directory,store}=await fixture(t),job={id:'fictional-crash-job',owner:'fictional-owner',status:'succeeded',createdAt:1,finishedAt:2,payload:{files:[{name:'fictional.bin',bytes:Buffer.from('old-payload')}]},result:{text:'old-state'},questions:[]};
  await store.commitJob(job);const objectId=store.index.jobs[0].objects[0].id,result=spawnSync(process.execPath,['--input-type=module','-e',child,directory,store.secure.key.toString('base64'),point,objectId],{encoding:'utf8'});
  assert.equal(result.status,exitCode,result.stderr||result.stdout);const reopened=await new JobStore(directory,store.secure.key).init(),loaded=await reopened.getJob(job.id);
  assert.equal(loaded.result.text,expectedText,`${point} must retain either the full committed old or full committed new record`);
  assert.equal(loaded.payload.files[0].bytes.toString(),expectedBytes,`${point} must not mix data from different record generations`);
  if(point==='during-object-write')assert.deepEqual((await readdir(join(directory,'original'))).filter(name=>name.endsWith('.tmp')),[],'restart removes a partially written ciphertext temp');
  if(point==='during-plaintext-staging')assert.deepEqual(await readdir(join(directory,'staging')),[],'restart removes the plaintext staging file left by abrupt process exit');
 }
});

test('whole-collection commits reuse unchanged records and roll back staged updates on index failure',async t=>{
 const {directory,store}=await fixture(t),first=fictionalJob('fictional-job-0005'),second=fictionalJob('fictional-job-0006');
 await store.commitJobs([first,second]);const before=store.index.jobs.map(entry=>({id:entry.id,recordId:entry.recordId}));
 const changed={...first,result:{...first.result,text:'changed fictional result'}};await store.commitJobs([changed,second]);
 const after=store.index.jobs;assert.notEqual(after.find(entry=>entry.id===first.id).recordId,before.find(entry=>entry.id===first.id).recordId);assert.equal(after.find(entry=>entry.id===second.id).recordId,before.find(entry=>entry.id===second.id).recordId);
 const oldWrite=store.writeIndex.bind(store);store.writeIndex=async()=>{throw new Error('simulated batch index failure');};await assert.rejects(()=>store.commitJobs([{...changed,result:{text:'uncommitted'}}]),/batch index failure/);store.writeIndex=oldWrite;
 const reopened=await new JobStore(directory,store.secure.key).init();assert.deepEqual(reopened.listSummaries().map(item=>item.id),[first.id,second.id]);assert.equal((await reopened.getJob(first.id)).result.text,'changed fictional result');assert.equal((await reopened.getJob(second.id)).result.text,'fictional result');
});

test('streaming job replacement rolls back staged records when the source stream fails',async t=>{
 const {directory,store}=await fixture(t),now=Date.now(),existing={...fictionalJob('fictional-stream-existing'),createdAt:now,finishedAt:now};await store.commitJobs([existing]);const before=structuredClone(store.index),recordsBefore=(await readdir(join(directory,'record'))).sort();
 const incoming=(async function*(){yield {...fictionalJob('fictional-stream-new'),createdAt:now,finishedAt:now,result:{text:'staged fictional result',pdf:'RkFLRQ=='}};throw new Error('fictional archive stream failed');})();
 await assert.rejects(()=>store.commitJobs(incoming,{replace:true,deferCleanup:true}),/fictional archive stream failed/);assert.deepEqual(store.index,before);assert.deepEqual((await readdir(join(directory,'record'))).sort(),recordsBefore);assert.equal((await store.getJob(existing.id)).result.text,'fictional result');assert.equal(await store.getJob('fictional-stream-new'),null);
});

test('job history summaries are owner-scoped, newest-first and paginated without result data',async t=>{
 const {store}=await fixture(t),jobs=Array.from({length:5},(_,index)=>({...fictionalJob(`fictional-page-${index}`,1000+index),owner:index===4?'another-fictional-owner':'fictional-owner',createdAt:100+index}));
 await store.commitJobs(jobs);
 const first=store.listSummariesPage({owner:'fictional-owner',offset:0,limit:2});
 assert.equal(first.total,4);assert.equal(first.jobs.length,2);assert.equal(first.jobs[0].id,'fictional-page-3');assert.equal(first.jobs[1].id,'fictional-page-2');assert.equal(first.hasMore,true);assert.equal(JSON.stringify(first).includes('fictional result'),false);assert.equal('owner' in first.jobs[0],false);
 const second=store.listSummariesPage({owner:'fictional-owner',offset:2,limit:2});assert.deepEqual(second.jobs.map(job=>job.id),['fictional-page-1','fictional-page-0']);assert.equal(second.hasMore,false);
 assert.throws(()=>store.listSummariesPage({offset:-1}),/offset/);assert.throws(()=>store.listSummariesPage({limit:101}),/page size/);
});

test('owner-scoped job metadata keeps sidecar objects as references without hydrating payload bytes',async t=>{
 const {store}=await fixture(t),job=fictionalJob('fictional-metadata-only');await store.commitJob(job);
 const metadata=await store.getJobMetadata(job.id,'fictional-owner');assert.equal(metadata.id,job.id);assert.equal(metadata.result.text,'fictional result');assert.equal(typeof metadata.result.pdf,'object');assert.equal(JSON.stringify(metadata).includes('FAKE'),false);
 assert.equal(store.getObjectInfo(job.id,['result','pdf'],'fictional-owner').size,3);assert.equal(await store.getJobMetadata(job.id,'another-owner'),null);
});

test('metadata and streamed object integrity failures carry the recoverable corruption code',async t=>{
 const {directory,store}=await fixture(t);store.cacheBytes=0;const job={...fictionalJob('fictional-corrupt-metadata'),payload:{files:[{name:'fictional-source.bin',bytes:Buffer.from('FICTIONAL SOURCE')}]},result:{text:'F'.repeat(1024*1024+1),word:'RkFLRQ=='}};await store.commitJob(job);
 const entry=store.index.jobs[0],word=entry.objects.find(object=>object.path===JSON.stringify(['result','word'])),text=entry.objects.find(object=>object.path===JSON.stringify(['result','text']));assert.ok(word);assert.ok(text);
 await rm(join(directory,word.type,`${word.id}.enc`));await assert.rejects(()=>store.withJobObject(job.id,['result','word'],'fictional-owner',async()=>{}),{code:'ERR_FOLIQUO_JOB_STORE_CORRUPT'});
 await rm(join(directory,text.type,`${text.id}.enc`));await assert.rejects(()=>store.getJob(job.id),{code:'ERR_FOLIQUO_JOB_STORE_CORRUPT'});
 await rm(join(directory,'record',`${entry.recordId}.enc`));await assert.rejects(()=>store.getJobMetadata(job.id,'fictional-owner'),{code:'ERR_FOLIQUO_JOB_STORE_CORRUPT'});
});

test('history search and document-type filters run across the complete owner index before paging',async t=>{
 const {store}=await fixture(t),records=[fictionalJob('fictional-filter-1'),fictionalJob('fictional-filter-2'),{...fictionalJob('fictional-filter-birth',5000),createdAt:4000,names:['older-birth-record.pdf'],detected:{sourceLanguage:'English',documentType:'Birth certificate'}}];
 await store.commitJobs(records);
 const result=store.listSummariesPage({owner:'fictional-owner',offset:0,limit:1,query:'OLDER-BIRTH',type:'Geburtsurkunden'});
 assert.equal(result.total,1);assert.equal(result.hasMore,false);assert.equal(result.jobs[0].id,'fictional-filter-birth');assert.ok(result.types.includes('Geburtsurkunden'));
 assert.equal(store.listSummariesPage({owner:'fictional-owner',query:'older-birth',type:'Führerscheine'}).total,0);
});

test('subset commits update loaded jobs without dropping unloaded encrypted history',async t=>{
 const {store}=await fixture(t),older=fictionalJob('fictional-retained-history',5000),loaded=fictionalJob('fictional-loaded-open',1000);
 await store.commitJobs([older,loaded]);loaded.status='failed';loaded.error='Fictional interruption';await store.commitSubset([loaded]);
 assert.deepEqual(store.listSummaries().map(item=>item.id),[older.id,loaded.id]);
 assert.equal((await store.getJob(older.id)).result.text,'fictional result');assert.equal((await store.getJob(loaded.id)).status,'failed');
});

test('status loading reads only requested encrypted job records',async t=>{
 const {store}=await fixture(t),queued=fictionalJob('fictional-queued');queued.status='queued';const complete=fictionalJob('fictional-complete');
 await store.commitJobs([queued,complete]);const loaded=await store.loadByStatuses(['queued']);
 assert.deepEqual(loaded.map(job=>job.id),[queued.id]);assert.equal(store.listSummaries().length,2);
});

test('failed-job summaries retain only the metadata needed for safe retry actions',async t=>{
 const {store}=await fixture(t),failed=fictionalJob('fictional-retryable');failed.status='failed';failed.payload={files:[{name:'fictional.pdf'}]};failed.interrupted=true;failed.retryAfterAt=123456;failed.budgetConsentRequired=true;
 await store.commitJob(failed);const [summary]=store.listSummaries();
 assert.equal(summary.canRetry,true);assert.equal(summary.interrupted,true);assert.equal(summary.retryAfterAt,123456);assert.equal(summary.budgetConsentRequired,true);
 assert.equal(JSON.stringify(summary).includes('payload'),false);assert.equal(JSON.stringify(summary).includes('fictional result'),false);
});

test('job iteration reads owner-scoped archive records one at a time',async t=>{
 const {store}=await fixture(t),first=fictionalJob('fictional-iterated-one'),privateJob={...fictionalJob('fictional-iterated-other'),owner:'other-owner'},last=fictionalJob('fictional-iterated-two');
 await store.commitJobs([first,privateJob,last]);const visited=[];for await(const job of store.iterateJobs({owner:'fictional-owner'}))visited.push(job.id);
 assert.deepEqual(visited,[first.id,last.id]);assert.equal(store.cacheSize<=store.cacheBytes,true);
});
