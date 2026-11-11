import {test,expect} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {Workspace} from '../../lib/workspace.mjs';
import {createApp} from '../../server.mjs';

test('local text recognition and PDF rendering work under the app content security policy',async({page})=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-browser-ocr-')),workspace=await new Workspace(directory).init(),probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const provider={id:'openai',selected:'openai',status:()=>({connected:false,planEnabled:false}),summaries:()=>[],models:async()=>[],respond:async()=>'{}'};
 const app=createApp({workspace,port,connection:{data:{},status:()=>({connected:false,planEnabled:false})},provider});await new Promise(resolve=>app.listen(port,'127.0.0.1',resolve));
 const violations=[];page.on('console',message=>{if(/Content Security Policy|Refused to/i.test(message.text()))violations.push(message.text());});page.on('pageerror',error=>violations.push(error.message));
 try{
  const response=await page.goto(`http://127.0.0.1:${port}/`);expect(response.headers()['content-security-policy']).toContain("script-src 'self' 'wasm-unsafe-eval'");
  await page.evaluate(()=>new Promise((resolve,reject)=>{if(window.FoliquoSourceText)return resolve();const script=document.createElement('script');script.src='/source-text.js';script.onload=resolve;script.onerror=reject;document.head.append(script);}));
  const result=await page.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=420;canvas.height=120;const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,420,120);context.fillStyle='#000';context.font='40px sans-serif';context.fillText('Fictional 2000',20,75);return window.FoliquoSourceText.localOcr(canvas);});
  expect(result.text).toMatch(/Fictional\s+2000/);expect(result.words.length).toBeGreaterThanOrEqual(2);
  const pages=await page.evaluate(async()=>{const pdfjs=await import('/vendor/pdfjs/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.mjs';const bytes=Uint8Array.from(atob('JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMjAwIDIwMF0+PmVuZG9iagp0cmFpbGVyPDwvUm9vdCAxIDAgUj4+CiUlRU9G'),character=>character.charCodeAt(0)),pdf=await pdfjs.getDocument({data:bytes,isEvalSupported:false}).promise,first=await pdf.getPage(1),viewport=first.getViewport({scale:1}),canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;await first.render({canvasContext:canvas.getContext('2d'),viewport}).promise;return pdf.numPages;});
  expect(pages).toBe(1);
  expect(violations).toEqual([]);
 }finally{await new Promise(resolve=>app.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});}
});
