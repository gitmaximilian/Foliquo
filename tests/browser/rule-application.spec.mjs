import {test,expect} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {Workspace} from '../../lib/workspace.mjs';
import {createApp} from '../../server.mjs';

test('current layout rules create a reviewable new version while retaining the old translation',async({page})=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-fictional-reapply-ui-')),workspace=await new Workspace(directory).init(),probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));let calls=0;
 const provider={id:'fixture',selected:'fixture',status:()=>({connected:false,planEnabled:false}),summaries:()=>[{id:'fixture',connected:false}],models:async()=>[],respond:async()=>{calls++;throw new Error('No provider for a local export change.');}},app=createApp({workspace,port,provider,connection:{data:{}}});await new Promise(resolve=>app.listen(port,'127.0.0.1',resolve));const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(`http://127.0.0.1:${port}`);await page.locator('#intro-skip').click();await page.waitForFunction(()=>typeof csrf!=='undefined'&&csrf);const id=await page.evaluate(async()=>(await localRequest('/api/demo',{}).then(response=>response.json())).id);await expect.poll(()=>workspace.data.jobs.find(job=>job.id===id)?.status,{timeout:30000}).toBe('succeeded');const oldWord=workspace.data.jobs.find(job=>job.id===id).result.word;
  await page.evaluate(async()=>{const {proposal}=await localRequest('/api/personal-rules/proposals',{requestId:crypto.randomUUID(),definition:{title:'Fictional spacing',effect:{kind:'layout',key:'lineHeight',value:1.5},scope:{}}}).then(response=>response.json());await localRequest('/api/personal-rules/review',{id:proposal.id,version:1,accept:true});});await page.evaluate(async id=>openReviewWorkspace(id),id);
  await page.locator('#review-apply-rules').click();const dialog=page.locator('#review-rule-dialog');await expect(dialog).toBeVisible();await expect(dialog).toContainText('without an AI request');await expect(dialog).toContainText('Line spacing: 1.5');expect(workspace.data.jobs.find(job=>job.id===id).result.word).toBe(oldWord);
  await page.setViewportSize({width:375,height:800});for(const [locale,label]of [['de','Änderungsvorschlag erstellen'],['ar','إنشاء اقتراح مراجعة']]){await page.evaluate(locale=>window.TOCRI18n.setLocale(locale),locale);await expect(dialog.locator('button[type=submit]')).toHaveText(label);expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);}await page.evaluate(()=>window.TOCRI18n.setLocale('en'));
  await dialog.getByRole('button',{name:'Create revision proposal',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(page.locator('#review-proposal-open')).toBeVisible();expect(workspace.data.jobs.find(job=>job.id===id).result.word).toBe(oldWord);await page.locator('#review-proposal-open').click();await page.locator('#revision-accept').click();await expect.poll(()=>workspace.data.jobs.find(job=>job.id===id).review.version).toBe(2);expect(workspace.data.jobs.find(job=>job.id===id).result.context.layout.lineHeight).toBe(1.5);expect(workspace.data.jobs.find(job=>job.id===id).review.versions.some(version=>version.version===1)).toBe(true);expect(calls).toBe(0);expect(errors).toEqual([]);
 }finally{await page.close();await app.flushWorkspace();await new Promise(resolve=>app.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});}
});
