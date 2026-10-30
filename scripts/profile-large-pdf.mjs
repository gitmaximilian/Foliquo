import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {PDFDocument} from 'pdf-lib';
import {createApp} from '../server.mjs';
import {Workspace} from '../lib/workspace.mjs';

const worker=process.argv.includes('--worker');
if(worker){
 if(typeof globalThis.gc!=='function')throw new Error('Run with node --expose-gc.');
 const directory=process.env.FOLIQUO_PROFILE_DIR,port=Number(process.env.FOLIQUO_PROFILE_PORT),owner='fictional-large-profile-session';
 const workspace=await new Workspace(directory,{lazyJobs:true}).init();
 assert.equal(workspace.jobStore.listSummaries()[0]?.owner,owner,'The archived job must retain the test-session owner.');
 const app=createApp({connection:{status:()=>({connected:false})},port,workspace});
 try{
  await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});
  globalThis.gc();await new Promise(resolve=>setTimeout(resolve,100));globalThis.gc();
  await new Promise(resolve=>process.once('SIGTERM',resolve));
 }finally{await new Promise(resolve=>app.close(resolve));await workspace.tail;}
}else{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-large-pdf-profile-')),port=21000+Math.floor(Math.random()*15000),owner='fictional-large-profile-session',artifactBytes=161*1024*1024,peakDeltaBudget=192*1024*1024;
 let child,childExit,workspace,sampleTimer,peakRss=0,stderr='';
 try{
  workspace=await new Workspace(directory,{lazyJobs:true}).init();
  const pdf=await PDFDocument.create();pdf.addPage();const base=Buffer.from(await pdf.save()),bytes=Buffer.alloc(artifactBytes,0x20);base.copy(bytes);const digest=createHash('sha256').update(bytes).digest('hex');
  workspace.data.sessions=[[owner,{id:owner,csrf:'fictional-profile-csrf',expiresAt:Date.now()+86400000}]];
  const job={id:'12345678-1234-4234-8234-123456789abf',owner,status:'succeeded',stage:'done',createdAt:Date.now()-1000,finishedAt:Date.now()-500,names:['fictional-large-profile.pdf'],result:{text:'Fictional large result',pdf:bytes.toString('base64'),preflight:{digest,translationPages:1,pageCount:1,originalPages:0}},questions:[],payload:{files:[]}};
  await workspace.jobStore.commitJob(job);job.result.pdf='';await workspace.save();await workspace.tail;bytes.fill(0);workspace=null;
  child=spawn(process.execPath,['--expose-gc',fileURLToPath(import.meta.url),'--worker'],{stdio:['ignore','ignore','pipe'],env:{...process.env,FOLIQUO_PROFILE_DIR:directory,FOLIQUO_PROFILE_PORT:String(port)}});
  childExit=once(child,'exit');child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>stderr+=chunk);
  const origin=`http://127.0.0.1:${port}`,cookie=`urkundenklar=${owner}`;
  let ready=false;for(let attempt=0;attempt<100;attempt++){if(child.exitCode!==null)throw new Error(`Profile server exited early: ${stderr}`);try{const response=await fetch(`${origin}/api/session`,{headers:{cookie},signal:AbortSignal.timeout(500)});if(response.status===200){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,50));}assert.ok(ready,'Profile server did not start in time.');
  const sample=()=>{try{const output=process.platform==='win32'?execFileSync('powershell.exe',['-NoProfile','-Command',`(Get-Process -Id ${child.pid}).WorkingSet64`],{encoding:'utf8'}):execFileSync('/bin/ps',['-o','rss=','-p',String(child.pid)],{encoding:'utf8'});return Number(output.trim())*(process.platform==='win32'?1:1024);}catch{return 0;}};
  const baselineRss=sample();assert.ok(baselineRss>0,'Could not read the profile server RSS.');peakRss=baselineRss;sampleTimer=setInterval(()=>{peakRss=Math.max(peakRss,sample());},10);
  const response=await fetch(`${origin}/api/jobs/12345678-1234-4234-8234-123456789abf/download/pdf`,{headers:{cookie}});
  assert.equal(response.status,200,await response.clone().text());assert.equal(Number(response.headers.get('content-length')),artifactBytes);
  const output=join(directory,'fictional-profile-download.pdf');await pipeline(Readable.fromWeb(response.body),createWriteStream(output,{mode:0o600}));
  clearInterval(sampleTimer);sampleTimer=null;peakRss=Math.max(peakRss,sample());child.kill();await childExit;
  const hash=createHash('sha256');for await(const chunk of createReadStream(output))hash.update(chunk);assert.equal(hash.digest('hex'),digest,'The streamed PDF must match its source bytes.');
  const peakDeltaBytes=peakRss-baselineRss;assert.ok(peakDeltaBytes<=peakDeltaBudget,`Large-PDF HTTP retrieval added ${(peakDeltaBytes/1024/1024).toFixed(2)} MiB peak RSS; budget is ${peakDeltaBudget/1024/1024} MiB.`);
  console.log(JSON.stringify({mode:'large-archived-pdf-http-peak-rss',artifactBytes,baselineRss,peakRss,peakDeltaBytes,peakDeltaMiB:Number((peakDeltaBytes/1024/1024).toFixed(2)),peakDeltaBudgetBytes:peakDeltaBudget,digestVerified:true}));
 }finally{
  if(sampleTimer)clearInterval(sampleTimer);if(child&&child.exitCode===null){child.kill();await childExit?.catch(()=>{});}
  await workspace?.tail?.catch(()=>{});await rm(directory,{recursive:true,force:true});
 }
}
