import {test,expect} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {Workspace} from '../../lib/workspace.mjs';
import {createApp} from '../../server.mjs';

test('cross-page critical value inconsistency is visible and never offers a false single-source jump',async({page})=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-browser-document-consistency-')),workspace=await new Workspace(directory).init();
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const app=createApp({workspace,port,connection:{status:()=>({connected:false,planEnabled:false})}});await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});
 const errors=[],origin=`http://127.0.0.1:${port}`;page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(origin,{waitUntil:'networkidle'});await page.locator('#intro-skip').click();
  const session=await page.evaluate(()=>fetch('/api/session').then(response=>response.json()));
  const created=await page.evaluate(async csrf=>fetch('/api/demo',{method:'POST',headers:{'content-type':'application/json','x-translateocr-csrf':csrf},body:'{}'}).then(response=>response.json()),session.csrf);
  await page.locator('#jobs-open').click();const review=page.locator(`#queue-list .queue-row[data-job-id="${created.id}"] [data-queue-action="review"]`);await expect(review).toBeVisible({timeout:25000});await review.click();
  const job=workspace.data.jobs.find(item=>item.id===created.id);job.result.fields=[
   {id:'field-1',kind:'name',label:'Name',source:'Alex Example',translated:'Alex Beispiel',fileIndex:0,page:1,box:null},
   {id:'field-2',kind:'name',label:'Name',source:'Alex Example',translated:'Alex Muster',fileIndex:0,page:4,box:null}
  ];
  const saved=await page.evaluate(async({id,csrf,text})=>fetch(`/api/jobs/${id}/direct`,{method:'POST',headers:{'content-type':'application/json','x-translateocr-csrf':csrf},body:JSON.stringify({version:1,text})}).then(response=>response.json()),{id:created.id,csrf:session.csrf,text:job.result.text});
  const check=saved.checks.find(item=>item.kind==='consistency');expect(check).toBeTruthy();expect(check.issue).toContain('Seiten: 1, 4');
  await page.locator('#review-tools-open').click();await expect(page.locator('#review-tools-dialog')).toBeVisible();
  const row=page.locator('#inspect-checks .field-check').filter({has:page.locator('input[data-check-id^="consistency-"]')});await page.evaluate(()=>window.TOCRI18n.setLocale('de'));await expect(row).toContainText('Wiederholter Wert: Name');await expect(row).toContainText('Alex Beispiel · Alex Muster');await expect(row).toContainText('Seiten: 1, 4');await expect(row.getByRole('button',{name:'Originalstelle ansehen'})).toHaveCount(0);
  await page.evaluate(()=>window.TOCRI18n.setLocale('en'));await expect(row).toContainText('Repeated value: Name');await expect(row).toContainText('pages: 1, 4');
  await page.evaluate(()=>window.TOCRI18n.setLocale('ar'));await expect(row).toContainText('قيمة متكررة: الاسم');await expect(row).toContainText('الصفحات: 1, 4');
  expect(errors).toEqual([]);
 }finally{await new Promise(resolve=>app.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});}
});
