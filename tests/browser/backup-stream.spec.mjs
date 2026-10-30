import {test,expect} from '@playwright/test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {Workspace} from '../../lib/workspace.mjs';
import {createApp} from '../../server.mjs';

async function openIsolatedWorkspace(page){
 const directory=await mkdtemp(join(tmpdir(),'foliquo-browser-backup-'));
 const workspace=await new Workspace(directory).init();
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const app=createApp({workspace,port,connection:{status:()=>({connected:false,planEnabled:false})}});
 await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});
 await page.goto(`http://127.0.0.1:${app.address().port}`,{waitUntil:'networkidle'});
 await page.locator('#intro-skip').click();
 await page.evaluate(()=>document.querySelector('#guide-storage-dialog').showModal());
 await page.locator('#backup-passphrase').fill('fictional backup password');
 return {directory,workspace,app};
}

async function closeIsolatedWorkspace({directory,workspace,app}){
 await new Promise(resolve=>app.close(resolve));
 await workspace.tail;
 await rm(directory,{recursive:true,force:true});
}

test('backup download streams to the native save destination when available',async({page})=>{
 const isolated=await openIsolatedWorkspace(page);
 const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
 try{
  await expect(page.locator('#storage-recovery-info')).toContainText(/same disk/i);
  await expect(page.locator('#storage-recovery-info')).toContainText(/external backup/i);
  await page.evaluate(()=>{
   window.__backupChunks=[];
   window.__backupPickerCalls=[];
   window.__backupClosed=false;
   window.showSaveFilePicker=async options=>{
    window.__backupPickerCalls.push(options);
    return {createWritable:async()=>new WritableStream({write(chunk){window.__backupChunks.push(Array.from(new Uint8Array(chunk)));},close(){window.__backupClosed=true;}})};
   };
  });
  await page.locator('#backup-download').click();
  await page.waitForFunction(()=>window.__backupClosed);
  const saved=await page.evaluate(()=>({chunks:window.__backupChunks.flat(),options:window.__backupPickerCalls,password:document.querySelector('#backup-passphrase').value}));
  const bytes=Buffer.from(saved.chunks);
  expect(saved.options).toHaveLength(1);
  expect(saved.options[0].suggestedName).toBe('foliquo-backup.enc');
  expect(bytes.subarray(0,9).toString()).toBe('TOCRBACK2');
  expect(bytes.length).toBeGreaterThan(40);
  expect(saved.password).toBe('');
  expect(pageErrors).toEqual([]);
 }finally{await closeIsolatedWorkspace(isolated);}
});

test('backup download retains the Blob download fallback without a native picker',async({page})=>{
 const isolated=await openIsolatedWorkspace(page);
 const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
 try{
  await page.evaluate(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
  const downloadEvent=page.waitForEvent('download');
  await page.locator('#backup-download').click();
  const download=await downloadEvent;
  const path=await download.path();
  const bytes=await readFile(path);
  expect(download.suggestedFilename()).toBe('foliquo-backup.enc');
  expect(bytes.subarray(0,9).toString()).toBe('TOCRBACK2');
  expect(bytes.length).toBeGreaterThan(40);
  expect(pageErrors).toEqual([]);
 }finally{await closeIsolatedWorkspace(isolated);}
});

test('cancelling the native save dialog does not request a backup or clear the password',async({page})=>{
 const isolated=await openIsolatedWorkspace(page);
 const backupRequests=[];
 page.on('request',request=>{if(request.url().endsWith('/api/backup'))backupRequests.push(request.url());});
 try{
  await page.evaluate(()=>{window.__pickerCancelled=false;window.showSaveFilePicker=async()=>{window.__pickerCancelled=true;throw new DOMException('User cancelled','AbortError');};});
  await page.locator('#backup-download').click();
  await page.waitForFunction(()=>window.__pickerCancelled);
  await expect(page.locator('#backup-passphrase')).toHaveValue('fictional backup password');
  expect(backupRequests).toEqual([]);
 }finally{await closeIsolatedWorkspace(isolated);}
});
