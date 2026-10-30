import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {Workspace} from '../lib/workspace.mjs';

async function workspace(t){const directory=await mkdtemp(join(tmpdir(),'foliquo-recovery-')),value=await new Workspace(directory).init();t.after(async()=>{await value.tail.catch(()=>{});await rm(directory,{recursive:true,force:true});});return value;}

test('daily and forced recovery points contain only encrypted committed files and remain capped',async t=>{
 const value=await workspace(t);value.put('glossary',{name:'Fictional term',source:'fictional source phrase',target:'fictional target phrase'});await value.save();
 const directory=join(value.directory,'.recovery-points'),entries=await readdir(directory),point=entries.find(name=>/^\d{13}-/.test(name));assert.ok(point);const encrypted=await readFile(join(directory,point,'state.enc'));assert.equal(encrypted.includes(Buffer.from('fictional source phrase')),false);assert.equal(encrypted.includes(Buffer.from('fictional target phrase')),false);
 const forced=[];for(let index=0;index<8;index++){const created=await value.createRecoveryPoint({reason:'manual',now:Date.now()+index*1000});forced.push(created);}
 assert.ok(forced.every(Boolean));assert.equal((await value.recoveryPoints.list()).length,7);assert.equal(await value.createRecoveryPoint({reason:'daily'}),null,'daily snapshots are limited to one per 24 hours');
});

test('a corrupt active manifest recovers the latest authenticated workspace generation',async t=>{
 const value=await workspace(t);value.put('glossary',{name:'Fictional recovery term',source:'fictional recovery source',target:'saved target'});await value.save();await value.createRecoveryPoint({reason:'manual'});
 value.put('glossary',{name:'Fictional recovery term',source:'fictional recovery source',target:'newer unsaved state'});await value.save();await rm(join(value.directory,'workspace.enc'));await writeFile(join(value.directory,'workspace.enc'),Buffer.from('corrupted active manifest'));
 const recovered=await new Workspace(value.directory).init();assert.equal(recovered.data.glossary[0].target,'saved target');assert.equal(recovered.jobStore.listSummaries().length,0);assert.equal(recovered.data.settings.apiProviders.openai,undefined);
});

test('a missing active manifest recovers instead of initializing an empty workspace',async t=>{
 const value=await workspace(t);value.put('glossary',{name:'Fictional missing manifest',source:'fictional source phrase',target:'saved translation'});await value.save();await value.createRecoveryPoint({reason:'manual'});await rm(join(value.directory,'workspace.enc'));
 const reopened=await new Workspace(value.directory).init();assert.equal(reopened.data.glossary[0].target,'saved translation');assert.ok(reopened.recoveredFrom);assert.ok((await readFile(join(value.directory,'workspace.enc'))).length>33);
});

test('a missing or invalid local workspace key is recovered from the encrypted point',async t=>{
 for(const damage of ['missing','invalid']){
  const value=await workspace(t);value.put('glossary',{name:`Fictional ${damage} key`,source:'fictional source',target:'preserved target'});await value.save();const keyPath=join(value.directory,'workspace.key');await rm(keyPath);if(damage==='invalid')await writeFile(keyPath,Buffer.from('wrong key'));
  const reopened=await new Workspace(value.directory).init();assert.equal(reopened.data.glossary[0].target,'preserved target');assert.equal(reopened.data.settings.locale,'en');
 }
});

test('an interrupted local recovery resumes from its verified point before staging cleanup',async t=>{
 const value=await workspace(t);value.put('glossary',{name:'Fictional interrupted recovery',source:'fictional source',target:'committed target'});await value.save();await value.createRecoveryPoint({reason:'manual'});
 value.put('glossary',{name:'Fictional interrupted recovery',source:'fictional source',target:'newer target'});await value.save();await rm(join(value.directory,'workspace.enc'));await writeFile(join(value.directory,'workspace.enc'),Buffer.from('partial recovery manifest'));
 const staleStage=join(value.directory,'.recovery-restore-12345678-1234-4234-8234-123456789abc');await mkdir(staleStage,{mode:0o700});await writeFile(join(value.directory,'.recovery-restore.pending'),JSON.stringify({schema:1,startedAt:Date.now()}),{mode:0o600});
 const reopened=await new Workspace(value.directory).init();assert.equal(reopened.data.glossary[0].target,'committed target');assert.equal((await readdir(value.directory)).includes('.recovery-restore.pending'),false);assert.equal((await readdir(value.directory)).includes('.recovery-restore-12345678-1234-4234-8234-123456789abc'),false);
});

test('a changed or truncated snapshot is rejected and an older valid point is used',async t=>{
 const value=await workspace(t);value.put('glossary',{name:'Fictional recovery term',source:'fictional source',target:'older target'});await value.save();
 value.put('glossary',{name:'Fictional recovery term',source:'fictional source',target:'new target'});await value.save();await value.createRecoveryPoint({reason:'manual'});
 const points=await value.recoveryPoints.list(),latest=points[0],pointPath=join(value.directory,'.recovery-points',latest.id,'workspace.enc');await rm(pointPath);await writeFile(pointPath,Buffer.from('tampered snapshot file'));
 await rm(join(value.directory,'workspace.enc'));await writeFile(join(value.directory,'workspace.enc'),Buffer.from('broken manifest'));
 const reopened=await new Workspace(value.directory).init();assert.equal(reopened.data.glossary[0].target,'older target');
});

test('backup restore preserves a local recovery point of the workspace it replaces',async t=>{
 const current=await workspace(t),incoming=await workspace(t);current.put('glossary',{name:'Existing fictional term',source:'old source',target:'old target'});incoming.put('glossary',{name:'Incoming fictional term',source:'new source',target:'new target'});await current.save();await incoming.save();const chunks=[];for await(const chunk of incoming.backupStream('fictional recovery password'))chunks.push(Buffer.from(chunk));
 await current.restoreStream(Readable.from(chunks),'fictional recovery password',{owner:'fictional-owner'});const snapshots=await current.recoveryPoints.list();assert.ok(snapshots.some(point=>point.reason==='restore'));await current.save();assert.equal(current.data.glossary[0].target,'new target');
});
