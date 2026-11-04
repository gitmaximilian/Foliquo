import {test,expect} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {Workspace} from '../../lib/workspace.mjs';
import {createApp} from '../../server.mjs';

test('reference trace renders safely in English, German, and Arabic',async({page})=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-browser-'));
 const workspace=await new Workspace(directory).init();
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const app=createApp({workspace,port,connection:{status:()=>({connected:false,planEnabled:false})}});
 await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});
 const address=app.address(),origin=`http://127.0.0.1:${address.port}`;
 const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
 try{
  await page.goto(origin,{waitUntil:'networkidle'});
  await page.locator('#intro-skip').click();
  await page.evaluate(()=>{reviewJobId='fictional-job';view('review',{historyMode:'none'});});
  await page.evaluate(()=>view('workspace',{historyMode:'none'}));
  const order=await page.evaluate(()=>{const learning=document.querySelector('.learning-collection'),dossiers=document.querySelector('.dossier-collection');return Boolean(learning.compareDocumentPosition(dossiers)&Node.DOCUMENT_POSITION_FOLLOWING);});
  expect(order).toBeTruthy();
  await page.evaluate(()=>{reviewJobId='fictional-job';view('review',{historyMode:'none'});});
  for(const [locale,width] of [['en',375],['de',1024],['ar',1440]]){
   await page.setViewportSize({width,height:900});
   await page.evaluate(value=>window.TOCRI18n.setLocale(value),locale);
   await page.evaluate(()=>window.renderWorkflow({jobId:'fictional-job',version:1,busy:false,hasQuestions:false,protectedFields:[],checks:[],regions:[],fields:[],references:[{id:'fictional-reference',name:'Fictional sample',documentType:'Fictional licence',targetLanguage:'German',structure:'two-column table',matchedLineCount:2,translation:'PRIVATE-FICTIONAL-TRANSLATION-MUST-NOT-RENDER',matches:['PRIVATE-FICTIONAL-MATCH-MUST-NOT-RENDER']}] }));
   const panel=page.locator('#used-references');
   await expect(panel).toContainText('Fictional sample');
   await expect(panel).toContainText('2');
   await expect(panel).not.toContainText('PRIVATE-FICTIONAL');
   await expect(panel).toContainText(locale==='en'?'Literal matches detected: 2':locale==='de'?'Wörtliche Übereinstimmungen erkannt: 2':'تم اكتشاف تطابقات حرفية: 2');
   await expect(page.locator('html')).toHaveAttribute('dir',locale==='ar'?'rtl':'ltr');
  }
  expect(pageErrors).toEqual([]);
 }finally{
  await new Promise(resolve=>app.close(resolve));
  await workspace.tail;
  await rm(directory,{recursive:true,force:true});
 }
});
