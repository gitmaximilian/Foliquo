// Fictional encrypted archive profiling follows the existing storage/IPC harness.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {JobStore} from '../lib/job-store.mjs';
import {SearchIndex} from '../lib/search-index.mjs';
const owner='fictional-search-profile-owner',records=1000,largeChars=20*1024*1024;
const mib=1024*1024,worker=process.argv.indexOf('--worker');
if(worker>=0){
 assert.equal(typeof globalThis.gc,'function','Run this profile with --expose-gc.');
 const phase=process.argv[worker+1],jobs=await new JobStore(process.env.FQ_SEARCH_PROFILE_DIR,Buffer.from(process.env.FQ_SEARCH_PROFILE_KEY,'hex'),{cacheBytes:1}).init(),index=new SearchIndex(process.env.FQ_SEARCH_PROFILE_DIR,Buffer.from(process.env.FQ_SEARCH_PROFILE_KEY,'hex'),jobs);
 globalThis.gc();const baseline=process.memoryUsage.rss();let peak=baseline;const sample=()=>{peak=Math.max(peak,process.memoryUsage.rss());};const monitor=setInterval(sample,20);let detail;
 try{
  if(phase==='build'){
   await index.configure(owner);let steps=0,characters=0,maxStepMs=0,maxStepCharacters=0;const started=performance.now();
   for(;;){const start=performance.now(),state=await index.step(owner);sample();steps++;maxStepMs=Math.max(maxStepMs,performance.now()-start);maxStepCharacters=Math.max(maxStepCharacters,state.characters||0);characters+=state.characters||0;if(steps%25===0)process.send?.({event:'progress',phase,steps,complete:state.complete,total:state.total});assert.ok((state.worked||0)<=8);assert.ok((state.characters||0)<=4*mib);if(!state.incomplete){assert.equal(state.complete,records+1);break;}assert.ok(steps<10000,'The bounded index build stopped progressing.');await new Promise(resolve=>setImmediate(resolve));}
   detail={elapsedMs:performance.now()-started,steps,characters,maxStepMs,maxStepCharacters};
  }else{
   const timings=[];for(const [label,query,expected]of [['rare','needle-0999',1],['german','Straße',1],['arabic','محمد',1],['common','Fictional archive context',records],['large-tail','large-record-finish',1]]){
    let cursor=null,hits=0,pages=0,readBytes=0,textBytes=0;const started=performance.now();
    do{const start=performance.now(),result=await index.query(owner,{query,cursor});sample();assert.ok(result.readBytes<=64*mib);assert.ok(result.textBytes<=8*mib);assert.ok(result.hits.length<=25);hits+=result.hits.length;pages++;readBytes+=result.readBytes;textBytes+=result.textBytes;cursor=result.cursor;assert.ok(performance.now()-start<30000,'A bounded search page exceeded the profile regression budget.');assert.ok(pages<1000,'Search pagination stopped progressing.');}while(cursor);
    assert.equal(hits,expected,`Unexpected ${label} hit count.`);timings.push({label,hits,pages,elapsedMs:performance.now()-started,readBytes,textBytes});
   }
   // A foreign owner cannot obtain even a snippet from this index.
   assert.deepEqual((await index.query('fictional-other-owner',{query:'needle-0999'})).hits,[]);detail={queries:timings};
  }
  sample();peak=Math.max(peak,process.resourceUsage().maxRSS*1024);const delta=peak-baseline,budget=(phase==='build'?384:256)*mib;assert.ok(delta<=budget,`${phase} added ${delta} peak RSS bytes; budget ${budget}.`);process.send?.({phase,baselineRss:baseline,peakRss:peak,peakDeltaBytes:delta,peakDeltaBudgetBytes:budget,...detail});
 }finally{clearInterval(monitor);}
}else{
 assert.equal(typeof globalThis.gc,'function','Run this profile with --expose-gc.');const directory=await mkdtemp(join(tmpdir(),'foliquo-search-profile-')),key=randomBytes(32);let child;
 const run=phase=>new Promise((resolve,reject)=>{
  console.log(JSON.stringify({event:'search-profile-phase',phase}));child=spawn(process.execPath,['--expose-gc',fileURLToPath(import.meta.url),'--worker',phase],{stdio:['ignore','ignore','pipe','ipc'],env:{PATH:process.env.PATH,FQ_SEARCH_PROFILE_DIR:directory,FQ_SEARCH_PROFILE_KEY:key.toString('hex')}});let result=null,stderr='';const watchdog=setTimeout(()=>{child.kill();reject(new Error(`Search ${phase} profile exceeded ten minutes.`));},600000);child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>{stderr+=chunk;});child.on('message',message=>{if(message?.event==='progress')console.log(JSON.stringify(message));else result=message;});child.once('error',error=>{clearTimeout(watchdog);reject(error);});child.once('exit',code=>{clearTimeout(watchdog);if(code!==0||!result)reject(new Error(`Search ${phase} profile failed: ${stderr}`));else resolve(result);});
 });
 try{
  console.log(JSON.stringify({event:'search-profile-phase',phase:'seed',records:records+1}));let writer=await new JobStore(directory,key,{cacheBytes:1}).init();let totalTextBytes=0;
  async function* fictionalJobs(){for(let number=0;number<records;number++){
   const suffix=String(number).padStart(4,'0'),text=`Fictional archive context needle-${suffix}\n`+(number===999?'Straße Café مُحَمَّد\n':'')+'Neutral example sentence without private data.\n'.repeat(700),sourceText=`Fictional original marker-${suffix}\n`+'Ordinary saved source.\n'.repeat(90),historical=`Historical fictional version ${suffix}`;totalTextBytes+=Buffer.byteLength(text+sourceText+historical);
   yield {id:`fictional-profile-${suffix}`,owner,status:'succeeded',createdAt:number+1,finishedAt:number+2,names:[`fictional-${suffix}.pdf`],result:{text,sourceInventory:{schema:1,items:[{id:`source-${suffix}`,sourceText,fileIndex:0,page:1,box:null}]}},review:{version:2,versions:[{version:1,text:historical}]}};
  }
  const text='x'.repeat(largeChars)+' large-record-finish';totalTextBytes+=Buffer.byteLength(text);yield {id:'fictional-large-profile',owner,status:'succeeded',names:['fictional-large.txt'],result:{text},review:{version:1,versions:[]}};
  }
  await writer.commitJobs(fictionalJobs());writer=null;globalThis.gc();const build=await run('build'),query=await run('query');console.log(JSON.stringify({mode:'fictional-encrypted-content-search-profile',records:records+1,totalTextBytes,largeTextChars:largeChars,build,query}));
 }finally{if(child&&child.exitCode===null&&child.signalCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill();});await rm(directory,{recursive:true,force:true});}
}
