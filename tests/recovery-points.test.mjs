import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {Workspace} from '../lib/workspace.mjs';
import {createApp} from '../server.mjs';

async function workspace(t){const directory=await mkdtemp(join(tmpdir(),'foliquo-recovery-')),value=await new Workspace(directory).init();t.after(async()=>{await value.tail.catch(()=>{});await rm(directory,{recursive:true,force:true});});return value;}

test('daily and forced recovery points contain only encrypted committed files and remain capped',async t=>{
 const value=await workspace(t);value.put('glossary',{name:'Fictional term',source:'fictional source phrase',target:'fictional target phrase'});await value.save();
 const directory=join(value.directory,'.recovery-points'),entries=await readdir(directory),point=entries.find(name=>/^\d{13}-/.test(name));assert.ok(point);const encrypted=await readFile(join(directory,point,'state.enc'));assert.equal(encrypted.includes(Buffer.from('fictional source phrase')),false);assert.equal(encrypted.includes(Buffer.from('fictional target phrase')),false);
 const forced=[];for(let index=0;index<8;index++){const created=await value.createRecoveryPoint({reason:'manual',now:Date.now()+index*1000});forced.push(created);}
 assert.ok(forced.every(Boolean));assert.equal((await value.recoveryPoints.list()).length,7);assert.equal(await value.createRecoveryPoint({reason:'daily'}),null,'daily snapshots are limited to one per 24 hours');
});

test('an ENOSPC during recovery-manifest writing removes only the incomplete point',async t=>{
 const value=await workspace(t);value.put('glossary',{name:'Fictional preserved recovery',source:'fictional source',target:'saved value'});await value.save();const before=await value.recoveryPoints.list(),writeFile=value.recoveryPoints.writeFile;
 value.recoveryPoints.writeFile=async(path,bytes,options)=>{await writeFile(path,bytes.subarray(0,Math.min(bytes.length,12)),options);const error=new Error('injected full disk');error.code='ENOSPC';throw error;};
 await assert.rejects(()=>value.createRecoveryPoint({reason:'manual'}),{code:'ENOSPC'});assert.deepEqual(await value.recoveryPoints.list(),before);assert.equal((await readdir(value.recoveryPoints.directory)).some(name=>name.startsWith('.pending-')),false);
});

test('EACCES while preparing a restore leaves the active generation untouched and permits a later retry',async t=>{
 const value=await workspace(t);value.put('glossary',{name:'Fictional permission recovery',source:'fictional source',target:'committed target'});await value.save();const indexPath=join(value.directory,'record','job-index-00000000000000000000000000000000.enc'),indexBefore=await readFile(indexPath),manifestPath=join(value.directory,'workspace.enc');await rm(manifestPath);await writeFile(manifestPath,Buffer.from('damaged active manifest'));
 const originalWriter=value.recoveryPoints.writeFile;value.recoveryPoints.writeFile=async(path,...args)=>{if(path.includes('.recovery-restore-state.tmp-'))throw Object.assign(new Error('injected denied restore marker'),{code:'EACCES'});return originalWriter(path,...args);};
 assert.equal(await value.recoveryPoints.restoreLatest(),null);assert.equal((await readFile(manifestPath)).toString(),'damaged active manifest');assert.deepEqual(await readFile(indexPath),indexBefore);assert.equal((await readdir(value.directory)).some(name=>name==='.recovery-restore.pending'),false);assert.equal((await readdir(value.directory)).some(name=>name.startsWith('.recovery-restore-')),false);
 value.recoveryPoints.writeFile=originalWriter;assert.ok(await value.recoveryPoints.restoreLatest());const reopened=await new Workspace(value.directory).init();assert.equal(reopened.data.glossary[0].target,'committed target');
});

test('a committed save remains available and reports an ENOSPC recovery-point failure',async t=>{
 const value=await workspace(t),writeFile=value.recoveryPoints.writeFile;value.recoveryPoints.writeFile=async(path,bytes,options)=>{await writeFile(path,bytes.subarray(0,Math.min(bytes.length,12)),options);const error=new Error('injected full disk');error.code='ENOSPC';throw error;};
 value.put('glossary',{name:'Fictional saved despite checkpoint failure',source:'fictional source',target:'committed value'});await value.save();assert.equal(value.library().recovery.errorCode,'ENOSPC');
 const reopened=await new Workspace(value.directory).init();assert.equal(reopened.data.glossary[0].target,'committed value');
});

test('a corrupt active manifest recovers the latest authenticated workspace generation',async t=>{
 const value=await workspace(t);value.put('glossary',{name:'Fictional recovery term',source:'fictional recovery source',target:'saved target'});await value.save();await value.createRecoveryPoint({reason:'manual'});
 value.put('glossary',{name:'Fictional recovery term',source:'fictional recovery source',target:'newer unsaved state'});await value.save();await rm(join(value.directory,'workspace.enc'));await writeFile(join(value.directory,'workspace.enc'),Buffer.from('corrupted active manifest'));
 const recovered=await new Workspace(value.directory).init();assert.equal(recovered.data.glossary[0].target,'saved target');assert.equal(recovered.jobStore.listSummaries().length,0);assert.equal(recovered.data.settings.apiProviders.openai,undefined);
});

test('a missing active manifest recovers instead of initializing an empty workspace',async t=>{
 const value=await workspace(t);value.put('glossary',{name:'Fictional missing manifest',source:'fictional source phrase',target:'saved translation'});await value.save();await value.createRecoveryPoint({reason:'manual'});await rm(join(value.directory,'workspace.enc'));
 const reopened=await new Workspace(value.directory).init();assert.equal(reopened.data.glossary[0].target,'saved translation');assert.ok(reopened.recoveredFrom);assert.ok((await readFile(join(value.directory,'workspace.enc'))).length>33);
});

test('a damaged authenticated job index restores its complete committed generation',async t=>{
 const value=await workspace(t),now=Date.now();value.data.jobs.push({id:'fictional-index-recovery-job',owner:'fictional-owner',status:'succeeded',createdAt:now,finishedAt:now,result:{text:'Preserved fictional translation'},questions:[]});await value.save();
 const indexPath=join(value.directory,'record','job-index-00000000000000000000000000000000.enc');await rm(indexPath);await writeFile(indexPath,Buffer.from('damaged encrypted index'));
 const reopened=await new Workspace(value.directory).init();assert.equal(reopened.data.jobs[0].result.text,'Preserved fictional translation');assert.equal(reopened.recoveredFrom.reason,'daily');
});

test('a missing authenticated sidecar object restores the complete committed generation',async t=>{
 const value=await workspace(t),now=Date.now();value.data.jobs.push({id:'fictional-object-recovery-job',owner:'fictional-owner',status:'succeeded',createdAt:now,finishedAt:now,payload:{files:[{name:'fictional-source.bin',bytes:Buffer.from('FICTIONAL SOURCE BYTES')}]},result:{text:'Preserved fictional translation'},questions:[]});await value.save();
 const object=value.jobStore.index.jobs[0].objects[0],objectPath=join(value.directory,object.type,`${object.id}.enc`);await rm(objectPath);
 const reopened=await new Workspace(value.directory).init();assert.equal(reopened.data.jobs[0].result.text,'Preserved fictional translation');assert.equal(reopened.data.jobs[0].payload.files[0].bytes.toString(),'FICTIONAL SOURCE BYTES');assert.ok(reopened.recoveredFrom);
});

test('lazy archived sidecar corruption restores a verified point and reloads the job in the running workspace',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-lazy-recovery-')),value=await new Workspace(directory,{lazyJobs:true}).init();t.after(async()=>{await value.tail.catch(()=>{});await rm(directory,{recursive:true,force:true});});
 const id='fictional-lazy-recovery-job',now=Date.now();value.data.jobs.push({id,owner:'fictional-owner',status:'succeeded',createdAt:now,finishedAt:now,payload:{files:[{name:'fictional-source.bin',bytes:Buffer.from('FICTIONAL SOURCE BYTES')}]},result:{text:'Preserved fictional translation'},questions:[]});await value.save();
 const object=value.jobStore.index.jobs[0].objects[0],objectPath=join(value.directory,object.type,`${object.id}.enc`);await rm(objectPath);value.jobStore.cache.clear();value.jobStore.cacheSize=0;
 await assert.rejects(()=>value.jobStore.getJob(id),{code:'ERR_FOLIQUO_JOB_STORE_CORRUPT'});
 const recovered=await value.recoverFromLatest();assert.ok(recovered);const job=await value.jobStore.getJob(id);assert.equal(job.result.text,'Preserved fictional translation');assert.equal(job.payload.files[0].bytes.toString(),'FICTIONAL SOURCE BYTES');assert.equal(value.recoveredFrom.id,recovered.id);
});

test('opening a corrupted lazy archive through HTTP restores its local point and returns the recovered review',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-http-lazy-recovery-')),value=await new Workspace(directory,{lazyJobs:true}).init(),port=46000+Math.floor(Math.random()*1000);let app,runtime;
 t.after(async()=>{if(app?.listening)await new Promise(resolve=>app.close(resolve));await Promise.all([value.tail.catch(()=>{}),runtime?.tail.catch(()=>{})]);await rm(directory,{recursive:true,force:true});});
 const sessionId='fictional-recovery-session',jobId='f1c710ca-3ba0-4d83-9b1a-87e567d81234',now=Date.now();value.data.sessions=[[sessionId,{id:sessionId,csrf:'fictional-csrf',expiresAt:now+60_000}]];value.data.jobs.push({id:jobId,owner:sessionId,status:'succeeded',createdAt:now,finishedAt:now,names:['Fictional.pdf'],payload:{files:[{name:'Fictional.pdf',bytes:Buffer.from('FICTIONAL SOURCE BYTES')}]},result:{text:'Fictional reviewed translation',word:'RkFLRQ==',context:{},checks:[],fields:[],regions:[],references:[]},questions:[]});await value.save();
 runtime=await new Workspace(directory,{lazyJobs:true}).init();app=createApp({workspace:runtime,port,connection:{status:()=>({connected:false,planEnabled:false})}});await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});
 const localSession=await fetch(`http://127.0.0.1:${port}/api/session`,{headers:{cookie:`urkundenklar=${sessionId}`}}).then(response=>response.json());assert.equal(localSession.csrf,'fictional-csrf');
 await runtime.tail;assert.deepEqual(runtime.jobStore.listSummaries({owner:sessionId}).map(job=>job.id),[jobId]);assert.equal(runtime.data.jobs.length,0);const object=runtime.jobStore.index.jobs[0].objects[0];await rm(join(runtime.directory,object.type,`${object.id}.enc`));runtime.jobStore.cache.clear();runtime.jobStore.cacheSize=0;
 const response=await fetch(`http://127.0.0.1:${port}/api/jobs/${jobId}/review`,{headers:{cookie:`urkundenklar=${sessionId}`}}),snapshot=await response.json();assert.equal(response.status,200,JSON.stringify({snapshot,recoveredFrom:runtime.recoveredFrom}));assert.equal(snapshot.jobId,jobId);assert.equal(snapshot.version,1);assert.equal(runtime.recoveredFrom.reason,'daily');
 const recovered=await runtime.jobStore.getJob(jobId);assert.equal(recovered.result.text,'Fictional reviewed translation');assert.equal(recovered.payload.files[0].bytes.toString(),'FICTIONAL SOURCE BYTES');
 const wordObject=runtime.jobStore.index.jobs[0].objects.find(item=>item.path===JSON.stringify(['result','word']));assert.ok(wordObject);await rm(join(runtime.directory,wordObject.type,`${wordObject.id}.enc`));runtime.jobStore.cache.clear();runtime.jobStore.cacheSize=0;
 const download=await fetch(`http://127.0.0.1:${port}/api/jobs/${jobId}/download/word`,{headers:{cookie:`urkundenklar=${sessionId}`}});assert.equal(download.status,200);assert.equal(Buffer.from(await download.arrayBuffer()).toString(),'FAKE');
});

test('a missing or invalid local workspace key is recovered from the encrypted point',async t=>{
 for(const damage of ['missing','invalid']){
  const value=await workspace(t);value.put('glossary',{name:`Fictional ${damage} key`,source:'fictional source',target:'preserved target'});await value.save();const keyPath=join(value.directory,'workspace.key');await rm(keyPath);if(damage==='invalid')await writeFile(keyPath,Buffer.from('wrong key'));
  const reopened=await new Workspace(value.directory).init();assert.equal(reopened.data.glossary[0].target,'preserved target');assert.equal(reopened.data.settings.locale,'en');
 }
});

test('an interrupted local recovery resumes from its verified point before staging cleanup',async t=>{
 const value=await workspace(t);value.put('glossary',{name:'Fictional interrupted recovery',source:'fictional source',target:'committed target'});await value.save();await value.createRecoveryPoint({reason:'manual'});
 value.put('glossary',{name:'Fictional interrupted recovery',source:'fictional source',target:'newer target'});await value.save();await rm(join(value.directory,'workspace.enc'));await writeFile(join(value.directory,'workspace.enc'),Buffer.from('partial recovery manifest'));
 const staleStage=join(value.directory,'.recovery-restore-12345678-1234-4234-8234-123456789abc');await mkdir(staleStage,{mode:0o700});await writeFile(join(value.directory,'.recovery-restore.pending'),JSON.stringify({schema:1,startedAt:Date.now()}),{mode:0o600});
 const reopened=await new Workspace(value.directory).init();assert.equal(reopened.data.glossary[0].target,'committed target');assert.equal((await readdir(value.directory)).includes('.recovery-restore.pending'),false);assert.equal((await readdir(value.directory)).includes('.recovery-restore-12345678-1234-4234-8234-123456789abc'),false);
});

test('a changed or truncated snapshot is rejected and an older valid point is used',async t=>{
 const value=await workspace(t);value.put('glossary',{name:'Fictional recovery term',source:'fictional source',target:'older target'});await value.save();
 value.put('glossary',{name:'Fictional recovery term',source:'fictional source',target:'new target'});await value.save();await value.createRecoveryPoint({reason:'manual'});
 const points=await value.recoveryPoints.list(),latest=points[0],pointPath=join(value.directory,'.recovery-points',latest.id,'workspace.enc');await rm(pointPath);await writeFile(pointPath,Buffer.from('tampered snapshot file'));
 await rm(join(value.directory,'workspace.enc'));await writeFile(join(value.directory,'workspace.enc'),Buffer.from('broken manifest'));
 const reopened=await new Workspace(value.directory).init();assert.equal(reopened.data.glossary[0].target,'older target');
});

test('backup restore preserves a local recovery point of the workspace it replaces',async t=>{
 const current=await workspace(t),incoming=await workspace(t);current.put('glossary',{name:'Existing fictional term',source:'old source',target:'old target'});incoming.put('glossary',{name:'Incoming fictional term',source:'new source',target:'new target'});await current.save();await incoming.save();const chunks=[];for await(const chunk of incoming.backupStream('fictional recovery password'))chunks.push(Buffer.from(chunk));
 await current.restoreStream(Readable.from(chunks),'fictional recovery password',{owner:'fictional-owner'});const snapshots=await current.recoveryPoints.list();assert.ok(snapshots.some(point=>point.reason==='restore'));await current.save();assert.equal(current.data.glossary[0].target,'new target');
});
