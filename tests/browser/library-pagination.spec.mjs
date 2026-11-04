import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {Workspace} from '../../lib/workspace.mjs';
import {createApp} from '../../server.mjs';

test('document library loads encrypted history in pages and keeps older records available',async({page})=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-browser-library-'));
 const workspace=await new Workspace(directory).init();
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const app=createApp({workspace,port,connection:{status:()=>({connected:false,planEnabled:false})}});
 await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});
 const origin=`http://127.0.0.1:${app.address().port}`,pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
 try{
  await page.goto(origin,{waitUntil:'networkidle'});await page.locator('#intro-skip').click();
  await page.evaluate(()=>fetch('/api/session'));
  for(let attempt=0;attempt<50&&!workspace.data.sessions.length;attempt++)await new Promise(resolve=>setTimeout(resolve,20));
  const owner=workspace.data.sessions.at(-1)?.[0];expect(owner).toBeTruthy();
  const now=Date.now(),jobs=Array.from({length:55},(_,index)=>({id:randomUUID(),owner,status:'succeeded',stage:'done',createdAt:now-120000-index*1000,startedAt:now-120000-index*1000,finishedAt:now-119000-index*1000,provider:'chatgpt',model:'fictional-model',targetLanguage:'Deutsch',names:[`fictional-document-${String(index+1).padStart(2,'0')}.pdf`],detected:{sourceLanguage:'English',documentType:index%2?'Fictional form':'Fictional certificate'},result:{text:'Fictional translation only.'},questions:[],events:[],review:{version:1}}));
  workspace.data.jobs.push(...jobs);await workspace.save();
  await page.evaluate(()=>view('documents',{historyMode:'none'}));
  const apiPage=await page.evaluate(()=>fetch('/api/job-summaries?offset=0&limit=50').then(response=>response.json()));expect(apiPage.jobs).toHaveLength(50);
  const rows=page.locator('#library-results .document-table tbody tr');await expect(rows).toHaveCount(50);
  await expect(page.locator('#library-results .library-pagination')).toContainText('Showing 50 of 55');
  await expect(rows.first()).toContainText('fictional-document-01.pdf');
  await page.locator('#library-search').fill('fictional-document-55.pdf');await expect(rows).toHaveCount(1);await expect(rows.first()).toContainText('fictional-document-55.pdf');await expect(page.locator('#library-results .library-pagination')).toContainText('Showing 1 of 1');
  await page.locator('#library-search').fill('');await expect(rows).toHaveCount(50);await expect(page.locator('#library-results .library-pagination')).toContainText('Showing 50 of 55');
  await page.locator('#library-results .library-pagination button').click();await expect(rows).toHaveCount(55);
  await expect(page.locator('#library-results .library-pagination')).toContainText('Showing 55 of 55');
  await expect(page.locator('#library-results .library-pagination button')).toHaveCount(0);
  const filteredApi=await page.evaluate(()=>fetch('/api/job-summaries?type=Fictional%20form').then(response=>response.json()));expect(filteredApi.total).toBe(27);
  await page.getByRole('button',{name:/Filter document type/}).click();await page.getByRole('option',{name:'Fictional form'}).click();await expect(rows).toHaveCount(27);await expect(page.locator('#library-results .library-pagination')).toContainText('Showing 27 of 27');
  expect(pageErrors).toEqual([]);
 }finally{
  await new Promise(resolve=>app.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});
 }
});
