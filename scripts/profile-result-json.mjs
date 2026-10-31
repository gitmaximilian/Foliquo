import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {Readable} from 'node:stream';
import {createApp} from '../server.mjs';
import {Workspace} from '../lib/workspace.mjs';

const worker=process.argv.includes('--worker');
const reviewPreview=process.argv.includes('--review-preview');
if(worker){
 if(typeof globalThis.gc!=='function')throw new Error('Run with --expose-gc.');
 const directory=process.env.FOLIQUO_PROFILE_DIR,port=Number(process.env.FOLIQUO_PROFILE_PORT),owner='fictional-result-json-profile-session';
 const workspace=await new Workspace(directory,{lazyJobs:true}).init();
 assert.equal(workspace.jobStore.listSummaries()[0]?.owner,owner,'The archived job must retain the test-session owner.');
 const app=createApp({connection:{status:()=>({connected:false})},port,workspace});
 try{
  await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});
  globalThis.gc();await new Promise(resolve=>setTimeout(resolve,100));globalThis.gc();
  const monitor=setInterval(()=>process.send?.({event:'rss',bytes:process.memoryUsage.rss()}),20);
  process.once('SIGTERM',()=>clearInterval(monitor));
  process.send?.({event:'ready',bytes:process.memoryUsage.rss()});
  await new Promise(resolve=>process.once('SIGTERM',resolve));
 }finally{await new Promise(resolve=>app.close(resolve));await workspace.tail;}
}else{
 if(typeof globalThis.gc!=='function')throw new Error('Run with --expose-gc.');
 const directory=await mkdtemp(join(tmpdir(),'foliquo-result-json-profile-')),port=30000+Math.floor(Math.random()*20000),owner='fictional-result-json-profile-session',textBytes=161*1024*1024,peakDeltaBudget=2*textBytes+96*1024*1024;
 const prefix=Buffer.from('{"text":"'),suffix=Buffer.from('\",\"previewTransport\":\"source-stream\"}');
 let child,childExit,workspace,peakRss=0,stderr='';
 try{
  workspace=await new Workspace(directory,{lazyJobs:true}).init();
  workspace.data.sessions=[[owner,{id:owner,csrf:'fictional-result-json-profile-csrf',expiresAt:Date.now()+86400000}]];
  let text='x'.repeat(textBytes);const expectedHash=createHash('sha256').update(prefix).update(text).update(suffix).digest('hex');
  const job={id:'12345678-1234-4234-8234-123456789abf',owner,status:'succeeded',stage:'done',createdAt:Date.now()-1000,finishedAt:Date.now()-500,names:['fictional-large-result.pdf'],result:{text},questions:[],payload:{files:[]}};
  await workspace.jobStore.commitJob(job);job.result.text='';await workspace.save();await workspace.tail;text=null;workspace=null;
  child=spawn(process.execPath,['--expose-gc',fileURLToPath(import.meta.url),'--worker'],{stdio:['ignore','ignore','pipe','ipc'],env:{...process.env,FOLIQUO_PROFILE_DIR:directory,FOLIQUO_PROFILE_PORT:String(port)}});
  childExit=once(child,'exit');child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>stderr+=chunk);
  let baselineRss=0;child.on('message',message=>{if(message?.event==='ready')baselineRss=message.bytes;if(message?.event==='rss')peakRss=Math.max(peakRss,message.bytes);});
  const origin=`http://127.0.0.1:${port}`,cookie=`urkundenklar=${owner}`;
  let ready=false;for(let attempt=0;attempt<120;attempt++){if(child.exitCode!==null)throw new Error(`Profile server exited early: ${stderr}`);try{const response=await fetch(`${origin}/api/session`,{headers:{cookie},signal:AbortSignal.timeout(500)});if(response.status===200){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,50));}assert.ok(ready,'Profile server did not start in time.');
  for(let attempt=0;attempt<100&&baselineRss===0;attempt++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(baselineRss>0,'Could not read the profile server RSS.');peakRss=baselineRss;
  const path=reviewPreview?'/api/jobs/12345678-1234-4234-8234-123456789abf/review?preview=1&stream=1':'/api/jobs/12345678-1234-4234-8234-123456789abf/result?metadata=1';
  const response=await fetch(`${origin}${path}`,{headers:{cookie}});
  assert.equal(response.status,200);assert.equal(response.headers.get('transfer-encoding'),'chunked');assert.equal(response.headers.get('content-length'),null);
  const hash=createHash('sha256'),marker=Buffer.from(reviewPreview?'"result":{"text":"':'"text":"');let bytes=0,first=Buffer.alloc(0),last=Buffer.alloc(0),scanCarry=Buffer.alloc(0),foundText=false,textFinished=false,streamedTextBytes=0;
  for await(const chunk of Readable.fromWeb(response.body)){
   bytes+=chunk.length;if(!reviewPreview)hash.update(chunk);if(first.length<16)first=Buffer.concat([first,chunk]).subarray(0,16);last=Buffer.concat([last,chunk]).subarray(-(reviewPreview?64:suffix.length));
   if(reviewPreview&&!textFinished){let content=chunk;if(!foundText){content=Buffer.concat([scanCarry,chunk]);const markerIndex=content.indexOf(marker);if(markerIndex<0){scanCarry=content.subarray(Math.max(0,content.length-marker.length+1));continue;}foundText=true;content=content.subarray(markerIndex+marker.length);scanCarry=Buffer.alloc(0);}const closingQuote=content.indexOf(0x22);if(closingQuote>=0){streamedTextBytes+=closingQuote;textFinished=true;}else streamedTextBytes+=content.length;}
  }
  if(reviewPreview){assert.ok(first.subarray(0,Math.min(first.length,16)).toString().startsWith('{'));assert.ok(last.includes(Buffer.from('}')),'The streamed review response must close its JSON object.');assert.equal(streamedTextBytes,textBytes,'The streamed nested review text must preserve every UTF-8 byte.');}
  else{assert.equal(bytes,prefix.length+textBytes+suffix.length,'The streamed response must preserve the complete JSON shape.');assert.equal(first.subarray(0,prefix.length).toString(),prefix.toString());assert.equal(last.toString(),suffix.toString());assert.equal(hash.digest('hex'),expectedHash,'The streamed result JSON must preserve the exact large text.');}
  await new Promise(resolve=>setTimeout(resolve,40));child.kill();await childExit;
  const peakDeltaBytes=peakRss-baselineRss;
  assert.ok(peakDeltaBytes<=peakDeltaBudget,`Large result JSON retrieval added ${(peakDeltaBytes/1024/1024).toFixed(2)} MiB peak RSS; budget is ${(peakDeltaBudget/1024/1024).toFixed(2)} MiB.`);
  console.log(JSON.stringify({mode:reviewPreview?'large-archived-review-preview-peak-rss':'large-archived-result-json-peak-rss',textBytes,baselineRss,peakRss,peakDeltaBytes,peakDeltaMiB:Number((peakDeltaBytes/1024/1024).toFixed(2)),peakDeltaBudgetBytes:peakDeltaBudget,responseBytes:bytes,textLengthVerified:reviewPreview?streamedTextBytes===textBytes:undefined,digestVerified:!reviewPreview}));
 }finally{
  if(child&&child.exitCode===null){child.kill();await childExit?.catch(()=>{});}
  await workspace?.tail?.catch(()=>{});await rm(directory,{recursive:true,force:true});
 }
}
