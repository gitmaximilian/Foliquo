import {test,expect} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {Workspace} from '../../lib/workspace.mjs';
import {createApp} from '../../server.mjs';

const sample={id:'fictional-sample',canonicalRules:true,name:'Fictional birth certificate',version:1,documentType:'Geburtsurkunde',targetLanguage:'Deutsch',active:false,status:'pending_review',rules:[],fieldLabels:[],analysis:{profileVersion:1,complete:true,pageCount:1,analyzedPages:[1],sourceLanguage:'Arabisch',observations:[{id:'o1',text:'Family names in capitals',category:'style',certainty:'observed',pages:[1],effect:{kind:'style',text:'Write family names in capital letters'}}],terminology:[],layout:{titleAlign:'center',lineHeight:1.3}}};

test('simple mode keeps three main areas, applies a learned style in one step and switches designs',async({page})=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-simple-mode-')),workspace=await new Workspace(directory).init();
 Object.assign(workspace.data.settings,{uiMode:'simple',locale:'de',introComplete:true});workspace.data.learning.push(structuredClone(sample));await workspace.save();
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const app=createApp({workspace,port,connection:{data:{},status:()=>({connected:false,planEnabled:false})}});await new Promise(resolve=>app.listen(port,'127.0.0.1',resolve));const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(`http://127.0.0.1:${port}`);await page.waitForFunction(()=>typeof csrf!=='undefined'&&csrf);
  await expect(page.locator('html')).toHaveAttribute('data-ui-mode','simple');
  for(const section of ['rules','terms','dossiers'])await expect(page.locator(`.app-header [data-section="${section}"]`)).toBeHidden();
  await expect(page.locator('#jobs-open')).toBeHidden();await expect(page.locator('.app-header [data-section="style"]')).toContainText('Mein Stil');

  await page.locator('.app-header [data-section="style"]').click();
  const card=page.locator('.my-style-learned-card');await expect(card).toContainText('Fictional birth certificate');
  const rows=card.locator('.my-style-habit-list li');await expect(rows).toHaveCount(3);
  await rows.first().locator('.my-style-strike').click();await expect(rows.first()).toHaveClass(/is-excluded/);
  await card.getByRole('button',{name:'2 von 3 übernehmen'}).click();await expect(card).toHaveCount(0);
  await expect.poll(()=>workspace.data.ruleProposals.filter(item=>item.status==='accepted').length).toBe(2);
  expect(workspace.data.ruleProposals.filter(item=>item.status==='rejected').length).toBe(1);
  await expect.poll(()=>workspace.data.learning[0].active).toBe(true);
  await expect(page.locator('.my-style-habit-card')).toContainText('Geburtsurkunde');
  await expect(page.locator('#dossier-create-form')).toBeHidden();await expect(page.locator('#glossary-manager')).toBeHidden();

  await page.locator('#ai-settings-open').click();await page.locator('.settings-design .design-option[data-choice="glass"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-design','glass');
  await page.locator('.settings-mode .mode-switch').click();await expect(page.locator('html')).toHaveAttribute('data-ui-mode','pro');
  await expect.poll(()=>workspace.data.settings.uiMode).toBe('pro');
  await page.locator('#ai-settings-close').click();
  await page.locator('.app-header [data-section="terms"]').click();await expect(page.locator('#glossary-manager')).toBeVisible();await expect(page.locator('#workspace-title')).toHaveText('Begriffe');
  await page.locator('.app-header [data-section="dossiers"]').click();await expect(page.locator('#dossier-create-form')).toBeVisible();await expect(page.locator('.learning-collection')).toBeHidden();
  await page.locator('.app-header [data-section="rules"]').click();await expect(page.locator('#personal-rules-panel')).toBeVisible();await expect(page.locator('.app-header [data-section="rules"]')).toHaveAttribute('aria-current','page');

  const found=await page.evaluate(()=>window.TOCRRememberSpelling.changes('Name: Ali Hasan\nOrt: Homs','Name: Ali AL-HASSAN\nOrt: Homs'));
  expect(found).toEqual([{from:'Hasan',to:'AL-HASSAN'}]);
  expect(await page.evaluate(()=>window.TOCRRememberSpelling.changes('Datum 12.03.2019','Datum 13.03.2019'))).toEqual([]);
  await page.evaluate(()=>window.TOCRRememberSpelling.offer([{from:'Hasan',to:'AL-HASSAN'}],'Deutsch'));
  await page.locator('#remember-spelling').getByRole('button',{name:'Immer so schreiben',exact:true}).click();
  await expect(page.locator('#remember-spelling')).toContainText('Gemerkt');
  await expect.poll(()=>workspace.data.personalRules.some(rule=>rule.status==='active'&&rule.effect.kind==='style'&&rule.effect.text.includes('„AL-HASSAN“ statt „Hasan“'))).toBe(true);
  expect(errors).toEqual([]);
 }finally{await new Promise(resolve=>app.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});}
});
