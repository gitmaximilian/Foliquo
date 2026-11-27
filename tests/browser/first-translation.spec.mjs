import {test,expect} from '@playwright/test';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {Workspace} from '../../lib/workspace.mjs';
import {createApp} from '../../server.mjs';

const baseline=process.env.FOLIQUO_WORKFLOW_BASELINE==='1';
for(const scenario of ['simple','questions','resume and correct']){
 test(`first translation: ${scenario}`,async({page},testInfo)=>{
  test.setTimeout(60000);
  const dir=await mkdtemp(join(tmpdir(),'foliquo-first-')),workspace=await new Workspace(dir).init();
  let calls=0,unblock;const processing=new Promise(resolve=>{unblock=resolve;});
  const provider={selected:'openai',status:()=>({connected:true,planEnabled:true}),summaries:()=>[{id:'openai',configured:true,label:'OpenAI API'}],models:async()=>[{id:'fictional-model'}],respond:async request=>{
   if(request.instructions.includes('Extrahiere alle sichtbaren'))return JSON.stringify({documentType:'Fictional note',fields:[],uncertainRegions:[]});
   await processing;
   const needsAnswer=scenario==='questions'&&calls++===0;
   return JSON.stringify({status:needsAnswer?'questions':'ready',sourceLanguage:'Englisch',documentType:'Fictional note',text:needsAnswer?'':'Fiktive Kopie des Dokuments.',questions:needsAnswer?[{question:'Confirm the fictional reference.',context:'Page one',fileIndex:0,page:1,box:[.1,.1,.5,.15]}]:[],fields:[],regions:[]});
  }};
  const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const app=createApp({workspace,port,connection:{data:{}},provider});await new Promise(resolve=>app.listen(port,'127.0.0.1',resolve));
  let clicks=0,detours=0;const metrics={};
  const capture=async name=>{
   if(process.env.FOLIQUO_CAPTURE_WORKFLOW==='1')await page.screenshot({path:testInfo.outputPath(name+'.png'),animations:'disabled'});
  };
  const click=async selector=>{clicks++;await page.locator(selector).click();};
  const visible=async selector=>page.locator(selector).evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length&&!node.disabled&&!node.closest('details:not([open])')).length);
  try{
   await page.goto(`http://127.0.0.1:${app.address().port}`);await click('#intro-skip');
   const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
   pdf.addPage().drawText('Fictional reference for this local browser workflow check.',{x:50,y:730,font,size:12});
   clicks++;await page.locator('#file').setInputFiles({name:'fictional-note.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
   await expect(page.locator('#translate')).toBeEnabled();
   if(!baseline){await expect(page.locator('.file-batch-group')).toBeHidden();await expect(page.locator('.studio-options')).toHaveJSProperty('open',false);}
   await capture('upload');await click('#translate');
   await expect(page.locator('#featured-job-progress')).toBeVisible();
   const progress=page.locator('#featured-job-progress');
   await expect.poll(()=>page.evaluate(()=>queueState.jobs.find(job=>job.id===featuredJobId)?.status)).toBe('running');
   const value=await page.evaluate(()=>queueState.jobs.find(job=>job.id===featuredJobId)?.progress);
   if(typeof value==='number')await expect(progress).toHaveAttribute('aria-valuenow',String(Math.round(value)));
   else await expect(progress).not.toHaveAttribute('aria-valuenow',/./);
   unblock();
   if(scenario==='questions'){
    await click('#featured-job-actions [data-queue-action=answer]');
    await expect(page.locator('#featured-job-progress')).toBeHidden();
    const field=page.locator('#clarification-fields textarea');await field.fill('Fictional reference confirmed');
    await page.setViewportSize({width:375,height:800});
    await click('#clarification-fields .question-source');
    await expect(page.locator('#clarification-original canvas')).toHaveAttribute('data-source-page','1');
    if(!baseline){await expect(page.locator('#clarification-original .source-highlight')).toBeVisible();await click('#clarification-back-to-answer');await expect(field).toBeFocused();await capture('question-mobile');}
    await expect(field).toHaveValue('Fictional reference confirmed');
    await click('#clarification-submit');
    await expect(page.locator('#clarification-dialog')).not.toBeVisible();
   }
   const next='#featured-job-actions [data-queue-action=review]';
   await expect(page.locator(next)).toBeVisible({timeout:25000});
   metrics.resultActions=await visible('#featured-job-actions [data-queue-action]');
   if(scenario==='resume and correct'){await page.reload();await expect(page.locator(next)).toBeVisible();}
   await click(next);
   await expect(page.locator('#review-final-pdf')).toBeEnabled();
   if(scenario==='resume and correct'){
    await page.reload();await expect(page.locator('#review-edit-open')).toBeVisible();await click('#review-edit-open');
    await page.locator('#direct-text').fill('Fiktive korrigierte Kopie des Dokuments.');await click('#direct-save');
    await expect(page.locator('#review-version')).toHaveText('Version 2',{timeout:15000});
    if(baseline){detours++;await click('#direct-edit-close');}
    await expect(page.locator('#direct-edit-dialog')).not.toBeVisible();
   }
   if(!baseline){
    await expect(page.locator('#review-final-title')).toHaveText('Download');
    await expect(page.locator('#review-final-status')).toContainText('Review this version against the original');
    await expect(page.locator('#review-learning-finish')).toBeHidden();
    for(const [locale,title] of [['de','Herunterladen'],['ar','التنزيل'],['en','Download']]){
     await page.evaluate(locale=>window.TOCRI18n.setLocale(locale),locale);
     await expect(page.locator('#review-final-title')).toHaveText(title);
     await expect(page.locator('html')).toHaveAttribute('dir',locale==='ar'?'rtl':'ltr');
    }
   }
   await capture('review');
   metrics.reviewActions=await visible('#review-final .export-actions button');
   if(!baseline){expect(metrics.resultActions).toBe(1);expect(metrics.reviewActions).toBe(2);}
   const download=page.waitForEvent('download');await click('#review-final-both');
   const summary=page.locator('#review-final-summary');await expect(summary).toBeVisible();
   clicks++;await summary.getByRole('checkbox').check();
   clicks++;await summary.getByRole('button',{name:'Download this version',exact:true}).press('Enter');
   const file=await download,bytes=await readFile(await file.path());
   {const {unzipSync}=await import('fflate');const zip=unzipSync(bytes);const pdf=Object.entries(zip).find(([name])=>name.endsWith('.pdf'))?.[1];expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThanOrEqual(2);expect(Object.keys(zip).some(name=>name.endsWith('.docx'))).toBe(true);if(!baseline){await expect(page.locator('#review-learning-finish')).toBeVisible();await expect(page.locator('#review-steps [aria-current=step]')).toHaveText('Export');}}
   console.log(JSON.stringify({scenario,clicks,detours,...metrics}));
  }finally{unblock();await new Promise(resolve=>{app.close(resolve);app.closeAllConnections();});await workspace.tail;await rm(dir,{recursive:true,force:true});}
 });
}
