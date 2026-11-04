import {test,expect} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import sharp from 'sharp';
import {Workspace} from '../../lib/workspace.mjs';
import {createApp} from '../../server.mjs';

test('clarification shows the original alongside questions and locates a PDF region after switching files',async({page})=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-question-view-')),workspace=await new Workspace(directory).init(),probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const provider={id:'openai',selected:'openai',status:()=>({connected:true,planEnabled:true}),summaries:()=>[],models:async()=>[{id:'fictional-model'}],respond:async request=>JSON.stringify(request.instructions.includes('Extrahiere alle sichtbaren')?{documentType:'Fictional certificate',fields:[],uncertainRegions:[]}:{status:'questions',sourceLanguage:'Englisch',documentType:'Fictional certificate',text:'',questions:[{question:'Confirm the fictional name.',context:'Page two, fictional name field.',fileIndex:0,page:2,box:[0.1,0.1,0.5,0.15]}]})};
 const app=createApp({workspace,port,connection:{data:{}},provider});await new Promise(resolve=>app.listen(port,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${port}`,errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.setViewportSize({width:1280,height:900});await page.goto(origin);await page.locator('#intro-skip').click();await page.waitForFunction(()=>typeof csrf!=='undefined'&&csrf);
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);for(let i=1;i<=2;i++){const canvas=pdf.addPage([400,600]);canvas.drawText(`Fictional page ${i}`,{x:40,y:530,font,size:16});}const image=await sharp({create:{width:200,height:300,channels:3,background:'#ececec'}}).png().toBuffer();
  const id=await page.evaluate(async files=>{const session=await fetch('/api/session').then(r=>r.json()),r=await fetch('/api/jobs',{method:'POST',headers:{'content-type':'application/json','x-translateocr-csrf':session.csrf},body:JSON.stringify({clientId:'fictional-view',requestId:'fictional-view',provider:'openai',model:'fictional-model',files,metadata:{targetLanguage:'Deutsch'}})});return (await r.json()).id;},[{name:'fictional.pdf',data:Buffer.from(await pdf.save()).toString('base64')},{name:'fictional.png',data:image.toString('base64')}]);
  await expect.poll(async()=>page.evaluate(async id=>(await fetch('/api/jobs').then(r=>r.json())).jobs.find(job=>job.id===id)?.status,id)).toBe('awaiting_answers');await page.evaluate(async id=>{await pollQueue();showClarifications(queueState.jobs.find(job=>job.id===id),true);},id);
  const original=page.locator('#clarification-original'),canvas=original.locator('canvas');await expect(canvas).toHaveAttribute('data-source-page','1');await expect(original).not.toContainText('extern');await expect(page.locator('#clarification-fields')).toContainText('Confirm the fictional name.');
  const sourceBounds=await original.boundingBox(),questionBounds=await page.locator('#clarification-form').boundingBox();expect(Math.abs(sourceBounds.y-questionBounds.y)).toBeLessThan(100);expect(sourceBounds.x).not.toBe(questionBounds.x);
  await page.locator('#clarification-fields .question-source').click();await expect(canvas).toHaveAttribute('data-source-page','2');await expect(original.locator('.source-highlight')).toBeVisible();await original.locator('input[type=number]').fill('1');await original.locator('input[type=number]').dispatchEvent('change');await expect(canvas).toHaveAttribute('data-source-page','1');await original.locator('select').selectOption('1');await expect(canvas).toHaveAttribute('data-source-name','fictional.png');await page.locator('#clarification-fields .question-source').click();await expect(canvas).toHaveAttribute('data-source-page','2');await expect(canvas).toHaveAttribute('data-source-name','fictional.pdf');await expect(original.locator('.source-highlight')).toBeVisible();await expect(original.locator('.source-selectable-text')).toHaveCount(0);expect(errors).toEqual([]);
 }finally{await new Promise(resolve=>app.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});}
});
