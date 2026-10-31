import {test,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {Workspace} from '../../lib/workspace.mjs';
import {createApp} from '../../server.mjs';
import {documentFromLegacyText} from '../../lib/document-adapter.mjs';

test('archived review reads lightweight metadata and streams its PDF without hydrating the job',async({page})=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-browser-lazy-review-')),workspace=await new Workspace(directory,{lazyJobs:true}).init();
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const app=createApp({workspace,port,connection:{status:()=>({connected:false,planEnabled:false})}});await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});
 const origin=`http://127.0.0.1:${port}`,pageErrors=[],unexpectedRequests=[],reviewPayloads=[];page.on('pageerror',error=>pageErrors.push(error.message));page.on('request',request=>{if(!request.url().startsWith(origin))unexpectedRequests.push(request.url());});page.on('response',async response=>{if(response.url().includes('/review?preview=1&stream=1')){try{reviewPayloads.push(await response.json());}catch{}}});
 try{
  await page.goto(origin,{waitUntil:'networkidle'});if(await page.locator('#intro-skip').isVisible())await page.locator('#intro-skip').click();await page.evaluate(()=>window.TOCRI18n.setLocale('en'));
  const session=await page.evaluate(()=>fetch('/api/session').then(response=>response.json())),cookie=(await page.context().cookies(origin)).find(item=>item.name==='urkundenklar');assert.ok(cookie,'local session cookie exists');const owner=decodeURIComponent(cookie.value);
  const pdf=await PDFDocument.create();pdf.addPage();const pdfBytes=Buffer.from(await pdf.save()),now=Date.now(),id='12345678-1234-4234-8234-123456789acd';
  const text='Fictional archived translation for review.',document=documentFromLegacyText(text),sourceItems=[1,2].map(page=>({id:`source-${page}`,documentId:'fictional-source',pageId:`page-${page}`,kind:'paragraph',label:`Fictional source page ${page}`,fileIndex:0,page,box:null,extractionMethod:'model',sourceText:'Fictional repeated source',targetText:text,coverageStatus:'mapped',targetNodeIds:[document.blocks[0].id],review:null}));
  const job={id,owner,status:'succeeded',stage:'done',createdAt:now-1000,finishedAt:now,names:['fictional-archived-document.pdf'],targetLanguage:'English',provider:'openai',model:'fictional-model',questions:[],payload:{files:[]},result:{text,document,sourceInventory:{schema:1,items:sourceItems,summary:{total:2,reviewed:2,mapped:2,open:0,percent:100}},pdf:pdfBytes.toString('base64'),word:'RkFLRQ==',fields:[],checks:[],regions:[],references:[],context:{targetLanguage:'English',layout:{}},preflight:{digest:createHash('sha256').update(pdfBytes).digest('hex'),pageCount:1,translationPages:1,originalPages:0}}};
  await workspace.jobStore.commitJob(job);workspace.jobStore.getJob=async()=>{throw new Error('Archived review must not hydrate the complete job record.');};
  await page.evaluate(async csrf=>fetch('/api/preferences',{method:'POST',headers:{'content-type':'application/json','x-foliquo-csrf':csrf},body:JSON.stringify({locale:'en',introComplete:true})}),session.csrf);
  await page.evaluate(async jobId=>openReviewWorkspace(jobId),id);
  await expect(page.locator('#review-text')).toHaveText(job.result.text);await expect(page.locator('#review-page-label')).toContainText('Page 1 of 1',{timeout:15000});
  await expect.poll(()=>reviewPayloads.length).toBeGreaterThan(0);const response=reviewPayloads.at(-1);expect(response.previewTransport).toBe('download-stream');expect(response.result.text).toBe(job.result.text);expect(response.result).not.toHaveProperty('pdf');expect(response.result).not.toHaveProperty('word');expect(response.result).not.toHaveProperty('previews');expect(response.result).not.toHaveProperty('originalPreviews');
  expect(response.sourceInventory.summary.open).toBe(2);expect(response.sourceInventory.items.map(item=>item.coverageStatus)).toEqual(['unreviewed','unreviewed']);expect(JSON.stringify(response.sourceInventory)).not.toContain('Fictional repeated source');
  await page.locator('#review-tools-open').click();await page.locator('details.optional-review-tools').evaluate(element=>{element.open=true;});for(const pageNumber of [1,2])await expect(page.locator('#source-inventory .source-inventory-item').filter({hasText:`Fictional source page ${pageNumber}`})).toContainText('Open');
  expect(pageErrors).toEqual([]);expect(unexpectedRequests).toEqual([]);
 }finally{await new Promise(resolve=>app.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});}
});
