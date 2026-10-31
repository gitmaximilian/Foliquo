import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fork} from 'node:child_process';
import {mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {Workspace} from '../lib/workspace.mjs';

const MIB=1024*1024,fixtureMiB=Number(process.env.FOLIQUO_LEGACY_BACKUP_PROFILE_MIB||64),jobCount=16,jobMiB=fixtureMiB/jobCount;
if(!Number.isInteger(fixtureMiB)||fixtureMiB<48||fixtureMiB>128)throw new Error('FOLIQUO_LEGACY_BACKUP_PROFILE_MIB must be an integer from 48 through 128.');
if(!Number.isInteger(jobMiB))throw new Error('FOLIQUO_LEGACY_BACKUP_PROFILE_MIB must be divisible by 16.');
const passphrase='fictional legacy backup profile passphrase',owner='fictional-legacy-profile-owner',jobId=index=>`fictional-legacy-profile-job-${String(index).padStart(2,'0')}`;
const digest=text=>createHash('sha256').update(text).digest('hex');

if(!isMainThread){
 const workspace=await new Workspace(workerData.directory,{lazyJobs:true}).init();
 try{
  if(workerData.mode==='buffer')workspace.restore(await readFile(workerData.archive),passphrase);
  else await workspace.restoreStream(createReadStream(workerData.archive),passphrase,{owner});
  await workspace.save();
  for(let index=0;index<jobCount;index++){const job=await workspace.jobStore.getJob(jobId(index));if(job?.result?.text.length!==jobMiB*MIB||digest(job.result.text)!==workerData.expectedHash)throw new Error(`Restored legacy backup job ${index} failed its length or digest check.`);}
  parentPort.postMessage({ok:true});parentPort.close();
 }catch(error){parentPort.postMessage({ok:false,error:error.message});parentPort.close();}
}else if(process.argv.includes('--restore-worker')){
 const {directory,archive,mode}=process.env;
 let worker,peakRss=process.memoryUsage.rss(),baselineRss=peakRss;
 const sample=setInterval(()=>{peakRss=Math.max(peakRss,process.memoryUsage.rss());},5);
  worker=new Worker(new URL(import.meta.url),{workerData:{directory,archive,mode,expectedHash:process.env.FOLIQUO_LEGACY_PROFILE_HASH}});
 worker.once('message',message=>{peakRss=Math.max(peakRss,process.memoryUsage.rss());clearInterval(sample);const result=!message.ok?{error:message.error}:{mode,baselineRss,peakRss,peakDeltaBytes:peakRss-baselineRss};process.send(result,()=>{if(!message.ok)process.exitCode=1;process.disconnect();});});
 worker.once('error',error=>{clearInterval(sample);process.send({error:error.message},()=>{process.exitCode=1;process.disconnect();});});
}else{
 const root=await mkdtemp(join(tmpdir(),'foliquo-legacy-backup-profile-')),archive=join(root,'fictional-tocrback1.enc'),script=fileURLToPath(import.meta.url),text='F'.repeat(jobMiB*MIB),expectedHash=digest(text);
 try{
  const source=await new Workspace(join(root,'source')).init();
  source.data.jobs=Array.from({length:jobCount},(_,index)=>({id:jobId(index),owner,status:'succeeded',createdAt:Date.now(),finishedAt:Date.now(),result:{text},questions:[]}));
  const bytes=source.backup(passphrase);await writeFile(archive,bytes,{mode:0o600,flag:'wx'});bytes.fill(0);
  const archiveBytes=(await stat(archive)).size;assert.ok(archiveBytes<256*MIB+58,`TOCRBACK1 fixture must remain within compatibility cap; got ${archiveBytes} bytes.`);
  const results=[];
  for(const mode of ['buffer','stream']){
   const directory=join(root,mode);const child=fork(script,['--restore-worker'],{stdio:['ignore','ignore','pipe','ipc'],env:{...process.env,directory,archive,mode,FOLIQUO_LEGACY_PROFILE_HASH:expectedHash}});let stderr='';child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>stderr+=chunk);
   const result=await new Promise((resolve,reject)=>{child.once('message',message=>message.error?reject(new Error(message.error)):resolve(message));child.once('error',reject);child.once('exit',code=>{if(code!==0)reject(new Error(`Legacy backup ${mode} profile exited ${code}: ${stderr}`));});});
   assert.ok(result.baselineRss>0&&result.peakRss>=result.baselineRss,`${mode} RSS measurements are invalid.`);results.push(result);
  }
  const [buffered,streamed]=results;
  console.log(JSON.stringify({mode:'legacy-tocrback1-restore-memory-comparison',platform:`${process.platform}/${process.arch}`,fixtureMiB,jobCount,jobMiB,archiveBytes,baselineRssBytes:buffered.baselineRss,bufferRestorePeakDeltaMiB:Number((buffered.peakDeltaBytes/MIB).toFixed(2)),streamRestorePeakDeltaMiB:Number((streamed.peakDeltaBytes/MIB).toFixed(2)),streamDeltaReductionMiB:Number(((buffered.peakDeltaBytes-streamed.peakDeltaBytes)/MIB).toFixed(2)),sha256:expectedHash,temporaryWorkspaces:true,providerRequests:0}));
 }finally{await rm(root,{recursive:true,force:true});}
}
