import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Workspace} from '../lib/workspace.mjs';
import {Readable} from 'node:stream';
import {proposeRule,reviewRuleProposal} from '../lib/personal-rules.mjs';

async function store(t){const directory=await mkdtemp(join(tmpdir(),'foliquo-fictional-chat-'));const workspace=await new Workspace(directory).init();t.after(async()=>{await workspace.tail;await rm(directory,{recursive:true,force:true});});return workspace;}
const message=text=>({id:randomUUID(),role:'user',text,source:'local',createdAt:Date.now()});
test('Foli history is encrypted outside workspace metadata, owner-scoped and survives restart',async t=>{
 const workspace=await store(t),created=await workspace.conversations.create('fictional-owner','Fictional chat'),record=await workspace.conversations.update('fictional-owner',created.id,created.version,chat=>chat.messages.push(message('PRIVATE FICTIONAL CHAT CONTENT')));
 const entry=workspace.data.foliConversations[0],encrypted=await readFile(workspace.conversations.secure.path(entry.recordId,'record'));
 assert.equal(encrypted.includes(Buffer.from('PRIVATE FICTIONAL CHAT CONTENT')),false);assert.equal(JSON.stringify(workspace.data).includes('PRIVATE FICTIONAL CHAT CONTENT'),false);
 assert.equal(workspace.conversations.list('other-owner').length,0);await assert.rejects(()=>workspace.conversations.read('other-owner',record.id),{code:'ERR_FOLI_NOT_FOUND'});
 const reopened=await new Workspace(workspace.directory).init();assert.equal((await reopened.conversations.read('fictional-owner',record.id)).messages[0].text,'PRIVATE FICTIONAL CHAT CONTENT');
 assert.equal((await readdir(join(workspace.directory,'foli-chats','record'))).length,1,'superseded record files are removed');
});
test('failed chat writes leave the committed record visible and parallel ordinary saves retain the chat index',async t=>{
 const workspace=await store(t),chat=await workspace.conversations.create('owner'),old=structuredClone(workspace.data.foliConversations),write=workspace.writeMetadata.bind(workspace);
 workspace.writeMetadata=async()=>{throw Object.assign(new Error('Fictional denied write'),{code:'EACCES'});};
 await assert.rejects(()=>workspace.conversations.update('owner',chat.id,chat.version,record=>record.messages.push(message('NOT COMMITTED'))),{code:'EACCES'});assert.deepEqual(workspace.data.foliConversations,old);assert.equal((await workspace.conversations.read('owner',chat.id)).messages.length,0);
 workspace.writeMetadata=write;const update=workspace.conversations.update('owner',chat.id,chat.version,record=>record.messages.push(message('Committed fictional message'))),ordinary=workspace.save();await Promise.all([update,ordinary]);
 const reopened=await new Workspace(workspace.directory).init();assert.equal((await reopened.conversations.read('owner',chat.id)).messages.length,1);
 await assert.rejects(()=>workspace.conversations.update('owner',chat.id,chat.version,()=>{}),{code:'ERR_FOLI_STALE'});
});
test('startup marks interrupted replies unknown and deleting a chat preserves accepted rules',async t=>{
 const workspace=await store(t),chat=await workspace.conversations.create('owner');
 await workspace.conversations.update('owner',chat.id,chat.version,record=>{record.messages.push(message('Fictional request'));record.turn={requestId:randomUUID(),status:'running',provider:'fixture',model:'fixture-model',startedAt:Date.now(),finishedAt:null};});
 const reopened=await new Workspace(workspace.directory).init(),interrupted=await reopened.conversations.read('owner',chat.id);assert.equal(interrupted.turn.status,'interrupted_unknown');assert.equal(interrupted.turn.errorCode,'PROCESS_INTERRUPTED');
 const accepted=await reopened.save({ruleOperation:data=>{const proposal=proposeRule(data,{definition:{title:'Fictional spacing',effect:{kind:'layout',key:'lineHeight',value:1.5},scope:{},origins:[{kind:'chat',id:interrupted.messages[0].id}]}});return reviewRuleProposal(data,proposal.id,{version:1,accept:true});}});
 await reopened.conversations.remove('owner',chat.id,interrupted.version);assert.equal(reopened.conversations.list('owner').length,0);assert.equal(reopened.data.personalRules[0].id,accepted.rule.id);assert.equal(reopened.data.personalRules[0].status,'active');
});
test('chat integrity errors and oversized updates cannot overwrite existing history',async t=>{
 const workspace=await store(t),chat=await workspace.conversations.create('owner');
 await assert.rejects(()=>workspace.conversations.update('owner',chat.id,chat.version,record=>record.messages.push(message('x'.repeat(8001)))),{code:'ERR_FOLI_CONTENT'});assert.equal((await workspace.conversations.read('owner',chat.id)).messages.length,0);
 const path=workspace.conversations.secure.path(workspace.data.foliConversations[0].recordId,'record'),bytes=await readFile(path);bytes[25]^=1;await writeFile(path,bytes);await assert.rejects(()=>workspace.conversations.read('owner',chat.id),/authentication failed/);
});
test('stream backups retain leased history during updates and restore it with a new key and owner atomically',async t=>{
 const source=await store(t),created=await source.conversations.create('original-owner');
 const chat=await source.conversations.update('original-owner',created.id,created.version,record=>record.messages.push(message('Fictional backed-up message'))),previous=structuredClone(source.data.foliConversations[0]);
 const stream=source.backupStream('fictional-chat-backup-password'),chunks=[],first=await stream.next();chunks.push(first.value);
 await source.conversations.update('original-owner',chat.id,chat.version,record=>record.messages.push(message('Later message outside the snapshot')));
 assert.ok(await readFile(source.conversations.secure.path(previous.recordId,'record')),'backup lease protects its immutable record');for await(const chunk of stream)chunks.push(chunk);
 await assert.rejects(()=>readFile(source.conversations.secure.path(previous.recordId,'record')),{code:'ENOENT'});
 const bytes=Buffer.concat(chunks),target=await store(t),old=await target.conversations.create('target-owner','Existing target chat'),oldIndex=structuredClone(target.data.foliConversations),key=await readFile(join(target.directory,'workspace.key'));
 await target.restoreStream(Readable.from([bytes]),'fictional-chat-backup-password',{owner:'target-owner'});const write=target.writeMetadata.bind(target);target.writeMetadata=async()=>{throw Object.assign(new Error('Fictional disk full'),{code:'ENOSPC'});};
 await assert.rejects(()=>target.save(),{code:'ENOSPC'});assert.deepEqual(target.data.foliConversations,oldIndex);assert.equal((await target.conversations.read('target-owner',old.id)).title,'Existing target chat');
 target.writeMetadata=write;await target.restoreStream(Readable.from([bytes]),'fictional-chat-backup-password',{owner:'target-owner'});await target.save();
 const restored=await target.conversations.read('target-owner',chat.id);assert.equal(restored.messages.length,1);assert.equal(restored.messages[0].text,'Fictional backed-up message');assert.equal(target.conversations.list('original-owner').length,0);assert.deepEqual(await readFile(join(target.directory,'workspace.key')),key);
 assert.equal(JSON.stringify(target.data).includes('Fictional backed-up message'),false);assert.equal((await readdir(join(target.directory,'foli-chats','record'))).length,1);
 const reopened=await new Workspace(target.directory).init();assert.equal((await reopened.conversations.read('target-owner',chat.id)).messages.length,1);
 const before=structuredClone(target.data.foliConversations);await assert.rejects(()=>target.restoreStream(Readable.from([bytes.subarray(0,bytes.length-20)]),'fictional-chat-backup-password'));assert.deepEqual(target.data.foliConversations,before);
 assert.throws(()=>source.backup('fictional-chat-backup-password'),/streamed backup/);
 const withoutHistory=source.backup('fictional-chat-backup-password',undefined,{excludeChats:true});const legacy=await store(t);legacy.restore(withoutHistory,'fictional-chat-backup-password');await legacy.save();assert.equal(legacy.data.foliConversations.length,0);
});
test('local recovery points include chat records and a damaged running chat does not disable the workspace',async t=>{
 const workspace=await store(t),created=await workspace.conversations.create('owner');
 const saved=await workspace.conversations.update('owner',created.id,created.version,record=>record.messages.push(message('Fictional recovery content')));await workspace.createRecoveryPoint({reason:'manual'});
 await workspace.conversations.update('owner',saved.id,saved.version,record=>record.messages.push(message('Later fictional content')));
 assert.ok(await workspace.recoverFromLatest());assert.equal((await workspace.conversations.read('owner',saved.id)).messages.length,1);
 const chat=await workspace.conversations.read('owner',saved.id);await workspace.conversations.update('owner',chat.id,chat.version,record=>{record.turn={requestId:randomUUID(),status:'running',provider:'fixture',model:'fixture',startedAt:Date.now(),finishedAt:null};});
 const entry=workspace.data.foliConversations[0],path=workspace.conversations.secure.path(entry.recordId,'record'),bytes=await readFile(path);bytes[25]^=1;await writeFile(path,bytes);
 const reopened=await new Workspace(workspace.directory).init();assert.equal(reopened.conversations.list('owner')[0].status,'unavailable');assert.ok(Array.isArray(reopened.data.personalRules));await reopened.conversations.remove('owner',chat.id,entry.version);assert.equal(reopened.conversations.list('owner').length,0);
});
