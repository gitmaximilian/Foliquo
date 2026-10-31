import {test,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {Workspace} from '../../lib/workspace.mjs';
import {createApp} from '../../server.mjs';

test('featured job shows saved section progress while a later section is still running',async({page})=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-browser-segment-progress-')),workspace=await new Workspace(directory).init();
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 let releaseSecond,signalSecond;const secondGate=new Promise(resolve=>releaseSecond=resolve),secondStarted=new Promise(resolve=>signalSecond=resolve);let secondIsRunning=false;
 const provider={id:'openai',selected:'openai',status:()=>({connected:true,planEnabled:true}),models:async()=>[{id:'fictional-model'}],respond:async request=>{
  if(request.instructions.includes('Extrahiere alle sichtbaren'))return JSON.stringify({documentType:'Fictional multi-page document',fields:[],uncertainRegions:[]});
  const match=request.instructions.match(/Abschnitt (\d+)–(\d+) der Originaldatei/u);assert.ok(match,'translation request identifies its source pages');const [first,last]=match.slice(1).map(Number);
  if(first===6){secondIsRunning=true;signalSecond();await secondGate;}
  return JSON.stringify({status:'ready',sourceLanguage:'Englisch',documentType:'Fictional multi-page document',questions:[],text:`Fictional translated section ${first} to ${last}.`,fields:[],regions:[]});
 }};
 const app=createApp({port,workspace,connection:{data:{}},provider});await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});
 const origin=`http://127.0.0.1:${port}`,pageErrors=[],outsideRequests=[];page.on('pageerror',error=>pageErrors.push(error.message));page.on('request',request=>{if(!request.url().startsWith(origin))outsideRequests.push(request.url());});
 try{
  await page.goto(origin,{waitUntil:'domcontentloaded'});if(await page.locator('#intro-skip').isVisible())await page.locator('#intro-skip').click();
  const csrf=await page.evaluate(()=>fetch('/api/session').then(response=>response.json()).then(session=>session.csrf));
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);for(let number=1;number<=6;number++){const sheet=pdf.addPage([400,600]);sheet.drawText(`FICTIONAL PAGE ${number}`,{x:36,y:540,font,size:12});}
  const added=await page.evaluate(async({csrf,data})=>fetch('/api/jobs',{method:'POST',headers:{'content-type':'application/json','x-translateocr-csrf':csrf},body:JSON.stringify({clientId:'fictional-browser-segment',requestId:'fictional-six-page-job',provider:'openai',model:'fictional-model',metadata:{sourceLanguage:'Englisch',targetLanguage:'Deutsch'},files:[{name:'fictional-six-pages.pdf',type:'application/pdf',data}]})}).then(async response=>({status:response.status,body:await response.json()})),{csrf,data:Buffer.from(await pdf.save()).toString('base64')});
  expect(added.status,JSON.stringify(added.body)).toBe(202);const jobId=added.body.id;
  for(let attempt=0;attempt<300&&!secondIsRunning;attempt++)await new Promise(resolve=>setTimeout(resolve,50));expect(secondIsRunning,'the second segment reached its deliberate hold').toBe(true);
  const uiState=await page.evaluate(async id=>{featuredJobId=id;sessionStorage.setItem('translateocr-featured-job',id);queueState=await fetch('/api/jobs').then(response=>response.json());renderFeaturedJob();return queueState.jobs.find(job=>job.id===id)?.segmentProgress;},jobId);
  expect(uiState).toMatchObject({complete:1,total:2});
  await expect(page.locator('#featured-job')).toBeVisible();await expect(page.locator('#featured-job-detail')).toContainText('1 of 2 sections saved');
  await page.evaluate(()=>window.TOCRI18n.setLocale('de'));await expect(page.locator('#featured-job-detail')).toContainText('Abschnitt 1 von 2 gespeichert');
  await page.evaluate(()=>window.TOCRI18n.setLocale('ar'));await expect(page.locator('#featured-job-detail')).toContainText('تم حفظ 1 من 2 أقسام');
  await page.evaluate(()=>window.TOCRI18n.setLocale('en'));
  const progress=await page.evaluate(async id=>fetch('/api/jobs').then(response=>response.json()).then(snapshot=>snapshot.jobs.find(job=>job.id===id)?.segmentProgress),jobId);expect(progress).toMatchObject({complete:1,total:2});
  releaseSecond();await expect.poll(async()=>page.evaluate(async id=>fetch('/api/jobs').then(response=>response.json()).then(snapshot=>snapshot.jobs.find(job=>job.id===id)?.status),jobId),{timeout:20000}).toBe('succeeded');await page.evaluate(async id=>{queueState=await fetch('/api/jobs').then(response=>response.json());featuredJobId=id;renderFeaturedJob();},jobId);await expect(page.locator('#featured-job-title')).toHaveText('Your translation is ready');
  expect(await page.evaluate(async id=>fetch(`/api/jobs/${id}/result`).then(response=>response.json()).then(result=>result.text),jobId)).toMatch(/Fictional translated section 1 to 5[\s\S]*Fictional translated section 6 to 6/u);
  expect(pageErrors).toEqual([]);expect(outsideRequests).toEqual([]);
 }finally{
  releaseSecond();if(secondIsRunning)for(let attempt=0;attempt<200&&!['succeeded','failed'].includes(workspace.data.jobs.find(job=>job.requestId==='fictional-six-page-job')?.status);attempt++)await new Promise(resolve=>setTimeout(resolve,50));await new Promise(resolve=>app.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});
 }
});
