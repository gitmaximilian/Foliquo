import {test,expect} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {Workspace} from '../../lib/workspace.mjs';
import {createApp} from '../../server.mjs';

test('sample drafts use shared review, profile switches and explicit source removal choices',async({page},testInfo)=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-fictional-sample-ui-')),workspace=await new Workspace(directory).init(),sampleId=randomUUID();
 workspace.data.learning.push({id:sampleId,canonicalRules:true,name:'Fictional sample',version:1,documentType:'Fictional certificate',targetLanguage:'German',active:false,status:'pending_review',rules:[],fieldLabels:[],analysis:{profileVersion:1,complete:true,pageCount:1,analyzedPages:[1],sourceLanguage:'English',observations:[],terminology:[],layout:{lineHeight:1.5}}});await workspace.save();
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));let calls=0;
 const provider={id:'fixture',selected:'fixture',status:()=>({connected:false,planEnabled:false}),summaries:()=>[{id:'fixture',connected:false}],models:async()=>[],respond:async()=>{calls++;throw new Error('No model call during sample review');}};
 const app=createApp({workspace,port,provider,connection:{data:{}}});await new Promise(resolve=>app.listen(port,'127.0.0.1',resolve));const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(`http://127.0.0.1:${port}`);await page.locator('#intro-skip').click();await page.waitForFunction(()=>typeof csrf!=='undefined'&&csrf&&window.TOCRRules);await page.locator('header [data-view=workspace]').click();
  const sample=page.locator(`[data-sample-id="${sampleId}"]`),proposal=sample.locator('.rule-proposal');await expect(proposal).toHaveCount(1);await expect(proposal).toContainText('Estimated / uncertain');expect(workspace.data.personalRules).toHaveLength(0);
  await proposal.getByRole('button',{name:'Accept rule',exact:true}).click();await expect(sample).toContainText('Accepted');expect(workspace.data.personalRules).toHaveLength(1);expect(workspace.data.learning[0].active).toBe(false);
  const sourceSwitch=sample.locator('.learning-active input');await sourceSwitch.check();await expect.poll(()=>workspace.data.learning[0].active).toBe(true);
  const preview=()=>page.evaluate(async()=>localRequest('/api/personal-rules/preview',{metadata:{sourceLanguage:'Englisch',targetLanguage:'Deutsch',documentType:'Fictional certificate'}}).then(response=>response.json()));expect((await preview()).layoutPatch.lineHeight).toBe(1.5);
  await sourceSwitch.uncheck();await expect.poll(()=>workspace.data.learning[0].active).toBe(false);expect((await preview()).layoutPatch.lineHeight).toBeUndefined();await sourceSwitch.check();await expect.poll(()=>workspace.data.learning[0].active).toBe(true);
  await page.locator('#rule-library-tab').click();await expect(page.locator('#rule-list')).toContainText('Line spacing: 1.5');await page.locator('#rule-list').getByRole('button',{name:'From samples',exact:true}).click();await expect(sample).toBeVisible();
  await page.setViewportSize({width:375,height:800});for(const language of ['de','ar']){await page.evaluate(language=>window.TOCRI18n.setLocale(language),language);await expect(sample).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await sample.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);}await page.screenshot({path:join(process.cwd(),'outputs',`foli-sample-ar-mobile-${testInfo.project.name}.png`),fullPage:true});await page.evaluate(()=>window.TOCRI18n.setLocale('en'));
  await sample.getByRole('button',{name:'Remove sample',exact:true}).click();const dialog=page.locator('dialog[open]');await expect(dialog).toContainText('Line spacing: 1.5');await dialog.getByRole('button',{name:'Keep as independent rules',exact:true}).click();await expect(page.locator('[data-sample-id]')).toHaveCount(0);expect(workspace.data.learning).toHaveLength(0);expect(workspace.data.personalRules[0].independent).toBe(true);expect(workspace.data.personalRules[0].origins[0].id).toBe(sampleId);expect((await preview()).layoutPatch.lineHeight).toBe(1.5);expect(calls).toBe(0);expect(errors).toEqual([]);
 }finally{await page.close();await app.flushWorkspace();await new Promise(resolve=>app.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});}
});
