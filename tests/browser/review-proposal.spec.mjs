import {test,expect} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {Workspace} from '../../lib/workspace.mjs';
import {createApp} from '../../server.mjs';

// Fictional document; the provider is a local fixture.
test('a requested change appears inline with before/after and is applied as a new version',async({page})=>{
 test.setTimeout(90000);
 const dir=await mkdtemp(join(tmpdir(),'foliquo-proposal-')),workspace=await new Workspace(dir).init();let edits=0;
 const provider={selected:'openai',status:()=>({connected:true,planEnabled:true}),summaries:()=>[{id:'openai',configured:true,label:'OpenAI API'}],models:async()=>[{id:'fictional-model'}],respond:async request=>{
  if(request.instructions.includes('Extrahiere alle sichtbaren'))return JSON.stringify({documentType:'Fictional note',fields:[],uncertainRegions:[]});
  const edit=JSON.stringify(request).includes('Omar');if(edit)edits++;
  return JSON.stringify({status:'ready',sourceLanguage:'Englisch',documentType:'Fictional note',text:edit?'FIKTIVE NOTIZ\nName | Omar Example\nOrt | Beispielstadt':'FIKTIVE NOTIZ\nName | Alex Example\nOrt | Beispielstadt',questions:[],fields:[]});
 }};
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const app=createApp({workspace,port,connection:{data:{}},provider});await new Promise(resolve=>app.listen(port,'127.0.0.1',resolve));
 try{
  await page.goto(`http://127.0.0.1:${port}`);await page.locator('#intro-skip').click();await page.evaluate(()=>window.TOCRI18n.setLocale('de'));
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage().drawText('Fictional note.',{x:50,y:730,font,size:12});
  await page.locator('#file').setInputFiles({name:'fictional-note.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
  await page.locator('#translate').click();
  const review='#featured-job-actions [data-queue-action=review]';await expect(page.locator(review)).toBeVisible({timeout:30000});await page.locator(review).click();
  await expect(page.locator('#review-send')).toHaveText('Änderung vorschlagen →');
  await page.locator('#review-prompt').fill('Schreibe den Namen als Omar Example.');await page.locator('#review-send').click();
  const inline=page.locator('#review-proposal-inline');await expect(inline).toBeVisible({timeout:30000});
  await expect(inline.locator('.review-proposal-before')).toContainText('Alex Example');
  await expect(inline.locator('.review-proposal-after')).toContainText('Omar Example');
  await expect(page.locator('#review-tools-dialog')).not.toBeVisible();
  for(const [locale,label] of [['en','Apply'],['ar','تطبيق'],['de','Übernehmen']]){await page.evaluate(locale=>window.TOCRI18n.setLocale(locale),locale);await expect(inline.locator('[data-proposal-apply]')).toHaveText(label);}
  await inline.locator('[data-proposal-change]').uncheck();await expect(inline.locator('[data-proposal-apply]')).toBeDisabled();await expect(inline.locator('.review-proposal-hint')).toBeVisible();
  await inline.locator('[data-proposal-change]').check();await inline.locator('[data-proposal-apply]').click();
  await expect(inline).toBeHidden({timeout:30000});
  await expect(page.locator('#review-version')).toHaveText('Version 2');
  await expect(page.locator('#review-text')).toContainText('Omar Example');
  expect(edits).toBe(1);
 }finally{await new Promise(resolve=>{app.close(resolve);app.closeAllConnections();});await workspace.tail;await rm(dir,{recursive:true,force:true});}
});
