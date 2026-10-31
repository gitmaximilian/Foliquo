import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {renameDurably,syncDirectory} from '../lib/durable-file.mjs';

test('durable rename waits for the containing directory flush',async()=>{
 const order=[];
 await renameDurably('/private/staged.enc','/private/state.enc',{
  rename:async(from,to)=>{order.push(['rename',from,to]);},
  flushDirectory:async(path)=>{order.push(['flush',path]);}
 });
 assert.deepEqual(order,[['rename','/private/staged.enc','/private/state.enc'],['flush','/private']]);
});

test('directory flush failure is surfaced after an atomic rename',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-durable-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const source=join(directory,'staged'),target=join(directory,'state');
 await writeFile(source,'committed');
 const failure=Object.assign(new Error('simulated directory flush failure'),{code:'EIO'});
 await assert.rejects(()=>renameDurably(source,target,{flushDirectory:async()=>{throw failure;}}),error=>error===failure);
 assert.equal(await readFile(target,'utf8'),'committed');
});

test('directory flush opens and syncs the directory on supported platforms',async t=>{
 if(process.platform==='win32'){assert.equal(await syncDirectory(tmpdir()),false);return;}
 const directory=await mkdtemp(join(tmpdir(),'foliquo-dir-sync-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 assert.equal(await syncDirectory(directory),true);
});
