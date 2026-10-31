import {test,expect} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {Workspace} from '../../lib/workspace.mjs';
import {newUsageRequest,mergeUsageRequest} from '../../lib/usage.mjs';
import {createApp} from '../../server.mjs';

test('provider usage filters by time period and translation job',async({page})=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-browser-usage-')),workspace=await new Workspace(directory).init(),now=Date.now();
 for(const [jobId,offset] of [['fictional-job-a',1000],['fictional-job-b',2000]]){const entry=newUsageRequest({provider:'chatgpt',model:'fictional-model',operation:'translation',jobId},now-offset);workspace.data.usage.push(entry);mergeUsageRequest(workspace.data.usage,entry.id,{inputTokens:100,outputTokens:20},{complete:true},now-offset+50);}
 await workspace.save();const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const app=createApp({workspace,port,connection:{status:()=>({connected:false,planEnabled:false})}});await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{await page.goto(`http://127.0.0.1:${app.address().port}`,{waitUntil:'networkidle'});await page.locator('#intro-skip').click();await page.locator('#ai-settings-open').click();await expect(page.locator('#provider-usage-job option')).toHaveCount(3);await page.locator('#provider-usage-job').selectOption('fictional-job-a');await expect(page.locator('#provider-usage-summary')).toContainText('1 model request');await page.locator('#provider-usage-days').selectOption('7');await expect(page.locator('#provider-usage-title')).toContainText('7');await page.evaluate(()=>window.TOCRI18n.setLocale('ar'));await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.locator('#provider-usage-days option[value="7"]')).toHaveText('7 أيام');await expect(page.locator('#provider-usage-job option[value="fictional-job-a"]')).toContainText('المهمة');await page.evaluate(()=>window.TOCRI18n.setLocale('de'));await expect(page.locator('#provider-usage-title')).toContainText('7');expect(errors).toEqual([]);}finally{await new Promise(resolve=>app.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});}
});
