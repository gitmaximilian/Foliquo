import {test,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {PDFDocument} from 'pdf-lib';
import {Workspace} from '../../lib/workspace.mjs';
import {createApp} from '../../server.mjs';

test('opening an archived job streams source files and keeps result metadata free of artifact bytes',async({page})=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-browser-lazy-job-open-')),workspace=await new Workspace(directory,{lazyJobs:true}).init();
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const app=createApp({workspace,port,connection:{status:()=>({connected:false,planEnabled:false})}});await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});
 const origin=`http://127.0.0.1:${port}`,pageErrors=[],unexpectedRequests=[],resultPayloads=[];page.on('pageerror',error=>pageErrors.push(error.message));page.on('request',request=>{if(!request.url().startsWith(origin)&&!request.url().startsWith(`blob:${origin}`))unexpectedRequests.push(request.url());});page.on('response',async response=>{if(response.url().includes('/result?metadata=1')){try{resultPayloads.push(await response.json());}catch{}}});
 try{
  await page.goto(origin,{waitUntil:'networkidle'});if(await page.locator('#intro-skip').isVisible())await page.locator('#intro-skip').click();await page.evaluate(()=>window.TOCRI18n.setLocale('en'));
  const session=await page.evaluate(()=>fetch('/api/session').then(response=>response.json())),cookie=(await page.context().cookies(origin)).find(item=>item.name==='urkundenklar');assert.ok(cookie,'local session cookie exists');const owner=decodeURIComponent(cookie.value);
  const source=await PDFDocument.create();source.addPage();const sourceBytes=Buffer.from(await source.save()),id='22345678-1234-4234-8234-123456789acd',now=Date.now(),job={id,owner,status:'succeeded',stage:'done',createdAt:now-1000,finishedAt:now,names:['fictional-source.pdf'],targetLanguage:'English',provider:'openai',model:'fictional-model',questions:[],payload:{files:[]},result:{text:'Fictional completed translation.',pdf:sourceBytes.toString('base64'),word:'RkFLRQ==',fields:[],checks:[],regions:[],references:[],previews:[{name:'fictional-source.pdf',type:'application/pdf',data:sourceBytes.toString('base64')}],context:{targetLanguage:'English',layout:{}}}};
  await workspace.jobStore.commitJob(job);
  await page.evaluate(async csrf=>fetch('/api/preferences',{method:'POST',headers:{'content-type':'application/json','x-foliquo-csrf':csrf},body:JSON.stringify({locale:'en',introComplete:true})}),session.csrf);
  await page.evaluate(async ({id,names,targetLanguage,provider,model})=>{await queueAction('open',{id,names,targetLanguage,provider,model},document.body);},{id,names:job.names,targetLanguage:job.targetLanguage,provider:job.provider,model:job.model});
  await expect(page.locator('#translation')).toHaveValue(job.result.text);await expect(page.locator('#file-list')).toContainText('fictional-source.pdf');await expect.poll(()=>resultPayloads.length).toBeGreaterThan(0);
  expect(resultPayloads.at(-1)).not.toHaveProperty('pdf');expect(resultPayloads.at(-1)).not.toHaveProperty('word');expect(resultPayloads.at(-1)).not.toHaveProperty('previews');expect(resultPayloads.at(-1)).not.toHaveProperty('originalPreviews');
  const sourceResponse=await page.evaluate(async id=>fetch(`/api/jobs/${id}/source/0`).then(response=>({status:response.status,length:Number(response.headers.get('content-length'))})),id);expect(sourceResponse).toEqual({status:200,length:sourceBytes.length});expect(pageErrors).toEqual([]);expect(unexpectedRequests).toEqual([]);
 }finally{await new Promise(resolve=>app.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});}
});
