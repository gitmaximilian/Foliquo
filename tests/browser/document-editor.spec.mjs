import {test,expect} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {Workspace} from '../../lib/workspace.mjs';
import {createApp} from '../../server.mjs';

test('structured document editor changes table layout, supports undo and saves a new local version',async({page})=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-browser-document-editor-')),workspace=await new Workspace(directory).init();
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const app=createApp({workspace,port,connection:{status:()=>({connected:false,planEnabled:false})}});await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});
 const pageErrors=[],externalRequests=[];page.on('pageerror',error=>pageErrors.push(error.message));page.on('request',request=>{if(!request.url().startsWith(`http://127.0.0.1:${port}`))externalRequests.push(request.url());});
 try{
  const origin=`http://127.0.0.1:${port}`;await page.setViewportSize({width:1000,height:850});await page.goto(origin,{waitUntil:'networkidle'});await page.locator('#intro-skip').click();
  const csrf=await page.evaluate(()=>fetch('/api/session').then(response=>response.json()).then(session=>session.csrf));
  const {id}=await page.evaluate(async csrf=>{const response=await fetch('/api/demo',{method:'POST',headers:{'content-type':'application/json','x-translateocr-csrf':csrf},body:'{}'});return response.json();},csrf);
  await page.locator('#jobs-open').click();const review=page.locator(`#queue-list .queue-row[data-job-id="${id}"] [data-queue-action="review"]`);await expect(review).toBeVisible({timeout:25000});await review.click();
  await expect(page.locator('#review-edit-open')).toBeVisible();await page.locator('#review-edit-open').click();await expect(page.locator('#direct-edit-dialog')).toBeVisible();
  await page.getByRole('button',{name:'Structure',exact:true}).click();await expect(page.locator('#structured-editor')).toBeVisible();
  const firstWidth=page.getByRole('spinbutton',{name:'Column width 1 as a percentage'}).first();await firstWidth.fill('25');await firstWidth.press('Tab');
  await page.getByRole('button',{name:'Add table row'}).first().click();await page.locator('#document-undo').click();await page.locator('#document-redo').click();
  await page.locator('#direct-save').click();await expect(page.locator('#review-version')).toHaveText('Version 2',{timeout:15000});
  const stored=workspace.data.jobs.find(job=>job.id===id).result.document;expect(stored.schema).toBe(1);expect(stored.blocks.find(block=>block.type==='table').relativeColumnWidths[0]).toBeCloseTo(25,0);
  expect(externalRequests).toEqual([]);expect(pageErrors).toEqual([]);
 }finally{await new Promise(resolve=>app.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});}
});
