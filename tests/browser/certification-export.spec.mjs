import {test,expect} from '@playwright/test';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {unzipSync,strFromU8} from 'fflate';
import {Workspace} from '../../lib/workspace.mjs';
import {createApp} from '../../server.mjs';

// Fictional document only; the provider is a local fixture and never contacts a service.
test('certification: set the profile once, then the clause, header and checklist follow the guide',async({page},testInfo)=>{
 test.setTimeout(120000);
 const dir=await mkdtemp(join(tmpdir(),'foliquo-certification-')),workspace=await new Workspace(dir).init();
 const provider={selected:'openai',status:()=>({connected:true,planEnabled:true}),summaries:()=>[{id:'openai',configured:true,label:'OpenAI API'}],models:async()=>[{id:'fictional-model'}],respond:async request=>{
  if(request.instructions.includes('Extrahiere alle sichtbaren'))return JSON.stringify({documentType:'Fictional certificate',fields:[],uncertainRegions:[]});
  return JSON.stringify({status:'ready',sourceLanguage:'Englisch',documentType:'Fictional certificate',text:'FIKTIVE BESTÄTIGUNG\nName | Alex Example\nGeburtsdatum | 01.02.2000\n\n[Unterschrift: unleserlich]',questions:[],fields:[],regions:[{label:'Signature',kind:'signature',source:'signature',translated:'[Unterschrift: unleserlich]',fileIndex:0,page:1,box:null}]});
 }};
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const app=createApp({workspace,port,connection:{data:{}},provider});await new Promise(resolve=>app.listen(port,'127.0.0.1',resolve));
 const capture=name=>process.env.FOLIQUO_CAPTURE_WORKFLOW==='1'?page.screenshot({path:testInfo.outputPath(name+'.png'),fullPage:false,animations:'disabled'}):null;
 try{
  await page.goto(`http://127.0.0.1:${port}`);await page.locator('#intro-skip').click();
  await page.evaluate(()=>window.TOCRI18n.setLocale('de'));
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage().drawText('Fictional certificate for a local check.',{x:50,y:730,font,size:12});
  await page.locator('#file').setInputFiles({name:'fictional-certificate.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
  await page.locator('#translate').click();
  const review='#featured-job-actions [data-queue-action=review]';await expect(page.locator(review)).toBeVisible({timeout:30000});await page.locator(review).click();
  await expect(page.locator('#review-final-both')).toBeEnabled();

  // Without a profile the clause cannot be placed; the panel says so and offers the one-time setup.
  const panel=page.locator('#certification-panel');await expect(panel).toBeVisible();
  await expect(page.locator('#certification-confirm')).not.toBeChecked();
  await expect(panel.locator('.certification-preview-header')).toContainText('Beglaubigte Übersetzung aus der englischen Sprache in die deutsche Sprache');
  await expect(panel.locator('.certification-preview-header')).toContainText('Certified translation from English into German');
  await page.locator('#certification-confirm').check();
  await expect(panel.locator('.certification-missing')).toBeVisible();
  await capture('certification-no-profile');
  await page.locator('#certification-profile-open').click();
  const dialog=page.locator('#certification-settings-dialog');await expect(dialog).toBeVisible();
  await page.locator('#certification-place').fill('Wien');
  await dialog.locator('#certification-languages input[value="Englisch"]').check();
  await page.locator('#certification-settings-save').click();await expect(dialog).toBeHidden();

  // With the profile the clause is on by default and shows exactly the printed wording.
  await expect(page.locator('#certification-confirm')).toBeChecked();
  const clause=panel.locator('.certification-preview-clause');
  await expect(clause).toContainText('Die genaue Übereinstimmung der vorstehenden Übersetzung mit dem angehefteten Original bestätige ich unter Berufung auf meinen Eid.');
  await expect(clause).toContainText('[Translation of the certification clause] I confirm, invoking my oath');
  await expect(clause).toContainText(/Wien, \d{2}\.\d{2}\.\d{4}/);
  await expect(page.locator('#certification-checks li')).toHaveText(['Bereit für den finalen Export.']);
  await page.locator('#certification-source-form').selectOption('attached-copy');
  await expect(clause).toContainText('mit der angehefteten Kopie');
  await expect(page.locator('#certification-checks [data-check=copy]')).toBeVisible();
  await page.locator('#certification-source-form').selectOption('attached-certified-copy');
  await page.locator('#certification-excerpt').check();
  await expect(panel.locator('.certification-preview-header')).toContainText('Beglaubigte auszugsweise Übersetzung aus der englischen Sprache in die deutsche Sprache');
  await capture('certification-panel');

  // The interface languages translate the panel; the legal German wording stays German.
  for(const [locale,title,check] of [['en','Certification','Ready for the final export.'],['ar','التصديق','جاهز للتصدير النهائي.']]){
   await page.evaluate(locale=>window.TOCRI18n.setLocale(locale),locale);
   await expect(page.locator('#certification-title')).toHaveText(title);
   await expect(page.locator('#certification-checks li').first()).toHaveText(check);
   await expect(clause).toContainText('Die genaue Übereinstimmung');
  }
  await page.evaluate(()=>window.TOCRI18n.setLocale('de'));

  const download=page.waitForEvent('download');await page.locator('#review-final-both').click();
  const summary=page.locator('#review-final-summary');await expect(summary).toBeVisible();
  await summary.getByRole('checkbox').check();await summary.getByRole('button',{name:'Diese Fassung herunterladen',exact:true}).press('Enter');
  const zip=unzipSync(await readFile(await (await download).path())),word=unzipSync(Object.entries(zip).find(([name])=>name.endsWith('.docx'))[1]);
  const body=strFromU8(word['word/document.xml']).replace(/<[^>]+>/g,''),header=strFromU8(word['word/header1.xml']).replace(/<[^>]+>/g,'');
  expect(Object.keys(word).filter(name=>name.startsWith('word/media/original-'))).toHaveLength(1);
  expect(header).toContain('Beglaubigte auszugsweise Übersetzung aus der englischen Sprache in die deutsche Sprache');
  expect(body).toMatch(/\[Unterschrift: unleserlich\].*Die genaue Übereinstimmung der vorstehenden Übersetzung mit der angehefteten beglaubigten Kopie bestätige ich unter Berufung auf meinen Eid\..*Wien, /s);

  // After the download the checklist follows the chosen route.
  const checklist=page.locator('#certification-checklist');await expect(checklist).toBeVisible();
  await expect(page.locator('#certification-steps li').nth(1)).toContainText('dauerhaft verbinden');
  await expect(page.locator('#certification-abroad-details')).toBeVisible();
  await page.locator('input[name="certification-route"][value="electronic"]').check();
  await expect(page.locator('#certification-steps')).toContainText('ID Austria');
  await expect(page.locator('#certification-abroad-details')).toBeHidden();
  await capture('certification-checklist');
 }finally{await new Promise(resolve=>{app.close(resolve);app.closeAllConnections();});await workspace.tail;await rm(dir,{recursive:true,force:true});}
});
