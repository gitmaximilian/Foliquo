import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,readdir,rename,rm,stat,lstat,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {Workspace} from '../lib/workspace.mjs';

const MIB=1024*1024,fixtureMiB=Number(process.env.FOLIQUO_RECOVERY_PROFILE_MIB||128),owner='fictional-recovery-profile-owner',jobId='fictional-recovery-profile-job';
if(!Number.isInteger(fixtureMiB)||fixtureMiB<64||fixtureMiB>512)throw new Error('FOLIQUO_RECOVERY_PROFILE_MIB must be an integer from 64 through 512.');
const worker=process.argv.includes('--restore-worker');

if(worker){
 const directory=process.env.FOLIQUO_RECOVERY_PROFILE_DIR;
 process.send({event:'ready'});
 process.on('message',async message=>{
  if(message?.event!=='restore')return;
  try{const {RecoveryPointStore}=await import('../lib/recovery-points.mjs'),startedAt=performance.now(),point=await new RecoveryPointStore(directory).restoreLatest();if(!point)throw new Error('No verified recovery point was restored.');process.send({event:'restored',point,durationMs:performance.now()-startedAt},()=>process.exit(0));}
  catch(error){process.send({event:'error',message:error.message},()=>process.exit(1));}
 });
}else{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-recovery-profile-')),script=fileURLToPath(import.meta.url),expected=Buffer.alloc(fixtureMiB*MIB,0x5a),expectedHash=createHash('sha256').update(expected).digest('hex');let child,timer,stderr='';
 try{
  const workspace=await new Workspace(directory,{lazyJobs:true}).init();
  workspace.data.jobs.push({id:jobId,owner,status:'succeeded',createdAt:Date.now()-1000,finishedAt:Date.now()-500,names:['fictional-recovery-profile.bin'],payload:{files:[{name:'fictional-recovery-profile.bin',type:'application/octet-stream',bytes:expected}]},result:{text:'Fictional recovery profile'},questions:[]});
  await workspace.save();await workspace.tail;workspace.jobStore.dropCache(jobId);workspace.data.jobs=[];expected.fill(0);globalThis.gc?.();
  const points=await workspace.recoveryPoints.list();assert.ok(points.length,'A committed save should create a daily recovery point.');const point=points[0];
  const rootInodes=new Set();
  const collect=async(path,skipRecovery=false)=>{for(const name of await readdir(path,{withFileTypes:true})){if(skipRecovery&&name.name==='.recovery-points')continue;const item=join(path,name.name);if(name.isDirectory()){await collect(item,skipRecovery);}else if(name.isFile()){const info=await stat(item);rootInodes.add(`${info.dev}:${info.ino}`);}}};
  await collect(directory,true);
  const pointRoot=join(directory,'.recovery-points',point.id),pointFiles=[];
  const visit=async(path)=>{for(const name of await readdir(path,{withFileTypes:true})){const item=join(path,name.name);if(name.isDirectory())await visit(item);else if(name.isFile()){const info=await lstat(item);pointFiles.push({bytes:info.size,inode:`${info.dev}:${info.ino}`});}}};
  await visit(pointRoot);const logicalBytes=pointFiles.reduce((sum,file)=>sum+file.bytes,0),additionalUniqueBytes=pointFiles.filter(file=>!rootInodes.has(file.inode)).reduce((sum,file)=>sum+file.bytes,0);
  const manifest=join(directory,'workspace.enc'),damaged=join(directory,`.workspace-profile-damaged-${process.pid}`);await writeFile(damaged,Buffer.from('fictional damaged active manifest'),{mode:0o600,flag:'wx'});await rename(damaged,manifest);
  child=spawn(process.execPath,['--expose-gc',script,'--restore-worker'],{stdio:['ignore','ignore','pipe','ipc'],env:{...process.env,FOLIQUO_RECOVERY_PROFILE_DIR:directory}});child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>stderr+=chunk);
  const exited=once(child,'exit');let readyResolve,doneResolve,doneReject;const ready=new Promise(resolve=>readyResolve=resolve),done=new Promise((resolve,reject)=>{doneResolve=resolve;doneReject=reject;});
  child.on('message',message=>{if(message.event==='ready')readyResolve();else if(message.event==='restored')doneResolve(message);else if(message.event==='error')doneReject(new Error(message.message));});
  await ready;const sample=()=>{try{const output=process.platform==='win32'?execFileSync('powershell.exe',['-NoProfile','-Command',`(Get-Process -Id ${child.pid}).WorkingSet64`],{encoding:'utf8'}):execFileSync('/bin/ps',['-o','rss=','-p',String(child.pid)],{encoding:'utf8'});return Number(output.trim())*(process.platform==='win32'?1:1024);}catch{return 0;}};
  const baselineRss=sample();assert.ok(baselineRss>0,'Could not measure the restore process RSS.');let peakRss=baselineRss;timer=setInterval(()=>{peakRss=Math.max(peakRss,sample());},10);child.send({event:'restore'});const restored=await done;clearInterval(timer);timer=null;peakRss=Math.max(peakRss,sample());await exited;
  const verifier=await new Workspace(directory,{lazyJobs:true}).init();assert.equal(verifier.jobStore.listSummaries({owner}).some(job=>job.id===jobId),true,'Recovered archive should retain the fictional job.');
  const entry=verifier.jobStore.index.jobs.find(job=>job.id===jobId),object=entry.objects.find(value=>value.path===JSON.stringify(['payload','files','0','bytes']));assert.ok(object,'Recovered source object reference should remain present.');
  let integrity;assert.equal(await verifier.jobStore.withJobObject(jobId,['payload','files','0','bytes'],owner,async({tempPath,size})=>{const hash=createHash('sha256');for await(const chunk of createReadStream(tempPath))hash.update(chunk);integrity={size,sha256:hash.digest('hex')};}),true);assert.equal(integrity.size,fixtureMiB*MIB);assert.equal(integrity.sha256,expectedHash);
  const peakDeltaBytes=peakRss-baselineRss,peakBudgetBytes=64*MIB;
  assert.ok(peakDeltaBytes<=peakBudgetBytes,`Recovery restore added ${(peakDeltaBytes/MIB).toFixed(2)} MiB peak RSS; budget is ${peakBudgetBytes/MIB} MiB.`);
  console.log(JSON.stringify({mode:'local-recovery-point-footprint-and-restore-rss',platform:`${process.platform}/${process.arch}`,fixtureMiB,jobId,pointId:restored.point.id,restoreMs:Number(restored.durationMs.toFixed(1)),recoveryPointFiles:point.files,recoveryPointLogicalBytes:logicalBytes,recoveryPointAdditionalUniqueBytes:additionalUniqueBytes,copyFallbackLogicalBytes:logicalBytes,baselineRssBytes:baselineRss,peakRssBytes:peakRss,peakDeltaBytes,peakDeltaMiB:Number((peakDeltaBytes/MIB).toFixed(2)),peakBudgetBytes,digestVerified:true,temporaryWorkspace:true}));
 }finally{if(timer)clearInterval(timer);if(child&&child.exitCode===null){child.kill();await once(child,'exit').catch(()=>{});}await rm(directory,{recursive:true,force:true});}
}
