import {test,expect} from '@playwright/test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {Workspace} from '../../lib/workspace.mjs';
import {createApp} from '../../server.mjs';

test('first-run onboarding opens the no-provider demo and completes a fictional review and export',async({page})=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-browser-onboarding-'));
 const workspace=await new Workspace(directory).init();
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const app=createApp({workspace,port,connection:{status:()=>({connected:false,planEnabled:false})}});
 await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});
 const pageErrors=[],apiRequests=[];page.on('pageerror',error=>pageErrors.push(error.message));page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))apiRequests.push(new URL(request.url()).pathname);});
 try{
  await page.setViewportSize({width:375,height:812});await page.goto(`http://127.0.0.1:${app.address().port}`,{waitUntil:'networkidle'});
  await expect(page.locator('#onboarding')).toBeVisible();await page.locator('#intro-name').fill('Alex Example');await page.locator('#intro-language').selectOption('de');
  await page.locator('#intro-next').click();await page.locator('#intro-next').click();await expect(page.locator('#intro-ai-later')).toBeVisible();await page.locator('#intro-ai-later').click();
  await page.locator('#intro-next').click();await page.locator('#intro-next').click();await expect(page.locator('#intro-demo')).toBeVisible();await page.locator('#intro-demo').click();await page.waitForURL('**/demo/?lang=de');
  await expect(page.locator('#notice')).toContainText('keine KI-Anfrage');await expect(page.locator('#step-title')).toHaveText('Dokument auswählen');
  expect(await workspace.preferences()).toMatchObject({locale:'de',displayName:'Alex Example',introComplete:true});
  await page.locator('#choose').click();await expect(page.locator('#message')).toContainText('Beispiel ausgewählt');await page.locator('#next').click();
  await page.locator('[name="spelling"][value="Layla Samir Nassar"]').check();await page.locator('#next').click();
  await page.locator('#prompt').click();await page.locator('#accept').click();await expect(page.locator('#message')).toContainText('Neue Fassung übernommen');await page.locator('#next').click();
  await expect(page.locator('#step-title')).toHaveText('Deine fertigen Dateien');await expect(page.locator('#step-body')).toContainText('PDF mit beiden Originalseiten');
  const downloadEvent=page.waitForEvent('download');await page.getByRole('link',{name:/PDF herunterladen/}).click();const download=await downloadEvent,bytes=await readFile(await download.path());
  expect(download.suggestedFilename()).toBe('Foliquo-de-Demo.pdf');expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
  expect(apiRequests).not.toContain('/api/demo');expect(pageErrors).toEqual([]);
 }finally{
  await new Promise(resolve=>app.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});
 }
});

test('a finished translation offers opt-in learning once and remembers never-ask',async({page})=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-browser-learning-offer-'));
 const workspace=await new Workspace(directory).init();
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const app=createApp({workspace,port,connection:{status:()=>({connected:false,planEnabled:false})}});
 await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});
 const origin=`http://127.0.0.1:${app.address().port}`,pageErrors=[],externalRequests=[];page.on('pageerror',error=>pageErrors.push(error.message));page.on('request',request=>{if(!request.url().startsWith(origin))externalRequests.push(request.url());});
 try{
  await page.goto(origin,{waitUntil:'networkidle'});await page.locator('#intro-skip').click();
  const csrf=await page.evaluate(()=>fetch('/api/session').then(response=>response.json()).then(session=>session.csrf));
  const createDemo=()=>page.evaluate(async csrf=>{const response=await fetch('/api/demo',{method:'POST',headers:{'content-type':'application/json','x-translateocr-csrf':csrf},body:'{}'});return response.json();},csrf);
  const openReview=async(id,{offerEnabled=true}={})=>{const jobsOpen=page.locator('#jobs-open');if(await jobsOpen.getAttribute('aria-expanded')!=='true')await jobsOpen.click();const review=page.locator(`#queue-list .queue-row[data-job-id="${id}"] [data-queue-action="review"]`);await expect(review).toBeVisible({timeout:25000});await review.click();if(offerEnabled)await expect(page.locator('#review-learning-finish')).toBeVisible({timeout:10000});else await expect(page.locator('#review-learning-finish')).toBeHidden();};
  const first=await createDemo();await openReview(first.id);await page.locator('#review-learning-finish').click();await expect(page.locator('#learning-offer')).toBeVisible();
  await expect(page.locator('#learning-offer-copy')).toContainText('encrypted local workspace');await page.locator('#learning-offer-later').click();await expect(page.locator('#learning-offer')).toBeHidden();
  expect(workspace.data.jobs.find(job=>job.id===first.id).learningOffer.state).toBe('dismissed');
  const second=await createDemo();await openReview(second.id);await page.locator('#review-learning-finish').click();await expect(page.locator('#learning-offer')).toBeVisible();await page.locator('#learning-offer-never').click();await expect(page.locator('#learning-offer')).toBeHidden();
  expect(workspace.data.settings.learningPromptDisabled).toBe(true);
  const third=await createDemo();await openReview(third.id,{offerEnabled:false});await expect(page.locator('#learning-offer')).toBeHidden();
  expect(externalRequests).toEqual([]);expect(pageErrors).toEqual([]);
 }finally{
  await new Promise(resolve=>app.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});
 }
});
