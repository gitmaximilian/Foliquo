import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as createNetServer} from 'node:net';
import {Workspace} from '../lib/workspace.mjs';
import {createApp} from '../server.mjs';

test('finalized learning includes the generated Word layout after explicit preflight consent',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-finished-output-learning-')),workspace=await new Workspace(directory).init(),requests=[];
 const provider={id:'fixture',selected:'fixture',status:()=>({connected:false,planEnabled:false}),summaries:()=>[{id:'fixture',connected:true}],models:async()=>[{id:'fixture-model'}],respond:async request=>{requests.push(request);return JSON.stringify({documentType:'Fictional translated certificate',sourceLanguage:'English',targetLanguage:'German',register:'Formal and concise',observations:[{category:'layout',text:'The finished output uses a centered heading and aligned field rows.',pages:[1],certainty:'observed',scope:'document-type'}],rules:['Keep field labels aligned in a stable order.'],fieldLabels:['Name','Date'],terminology:[],layout:{titleAlign:'center',margin:25},warnings:[]});}};
 const probe=createNetServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const app=createApp({workspace,port,provider,connection:{status:()=>({connected:false,planEnabled:false})}});await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});
 try{
  const origin=`http://127.0.0.1:${port}`,rootResponse=await fetch(origin),cookie=rootResponse.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);const sessionResponse=await fetch(`${origin}/api/session`,{headers:{cookie}}),session=await sessionResponse.json();
  const call=async(path,{method='GET',body}={})=>{const response=await fetch(`${origin}${path}`,{method,headers:{cookie,origin,...(body?{'content-type':'application/json','x-translateocr-csrf':session.csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};};
  const created=await call('/api/demo',{method:'POST',body:{}});assert.equal(created.status,202);
  let status='queued';for(let attempt=0;attempt<200&&status!=='succeeded';attempt++){await new Promise(resolve=>setTimeout(resolve,100));const jobs=await call('/api/jobs');status=jobs.data.jobs.find(job=>job.id===created.data.id)?.status||'missing';assert.notEqual(status,'failed',JSON.stringify(jobs.data));}
  assert.equal(status,'succeeded');const review=await call(`/api/jobs/${created.data.id}/review?preview=1`);assert.equal(review.status,200);const version=review.data.version;
  assert.equal((await call(`/api/jobs/${created.data.id}/learn`,{method:'POST',body:{action:'finish',version}})).status,200);
  const prepared=await call(`/api/jobs/${created.data.id}/learn`,{method:'POST',body:{action:'prepare',version,provider:'fixture',model:'fixture-model'}});assert.equal(prepared.status,200);
  assert.equal(prepared.data.learningPreflight.finishedTranslationLayout,true);assert.ok(prepared.data.learningPreflight.sourcePages>0);assert.ok(prepared.data.learningPreflight.finishedTranslationPages>0);
  assert.equal(prepared.data.learningPreflight.pages,prepared.data.learningPreflight.sourcePages+prepared.data.learningPreflight.finishedTranslationPages);assert.match(prepared.data.learningPreflight.content,/fertige Word-Fassung/);
  const started=await call(`/api/jobs/${created.data.id}/learn`,{method:'POST',body:{action:'start',version,provider:'fixture',model:'fixture-model',confirmed:true}});assert.equal(started.status,202);
  let entry;for(let attempt=0;attempt<300;attempt++){entry=workspace.data.learning.find(item=>item.originJobId===created.data.id);if(entry?.status==='pending_review'&&entry.analysis?.localInventory)break;if(entry?.status==='interrupted')assert.fail(entry.lastError);await new Promise(resolve=>setTimeout(resolve,100));}
  assert.equal(entry?.status,'pending_review');const generated=entry.sources.find(source=>/^Foliquo-Finished-Translation-v\d+\.docx$/i.test(source.name));assert.ok(generated);assert.ok(entry.analysis.localInventory.docx.paragraphCount>0);assert.ok(requests.length>0);
  const requestText=JSON.stringify(requests[0]);assert.match(requestText,/Foliquo-Finished-Translation-v/);assert.match(requestText,/authoritative target layout/);assert.match(requestText,/finishedTranslationDocx/);
 }finally{await new Promise(resolve=>app.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true,maxRetries:8,retryDelay:100});}
});
