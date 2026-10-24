import test from 'node:test';
import assert from 'node:assert/strict';
import {TranslationQueue} from '../lib/queue.mjs';
import {Workspace} from '../lib/workspace.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
function fixture(){const queue=new TranslationQueue(async()=>{});queue.pause();const job=queue.add({owner:'owner',requestId:'draft',payload:{files:[{name:'original.txt',type:'text/plain',bytes:Buffer.from('fictional')}],metadata:{},sourceExtraction:{cached:true}}});job.status='awaiting_answers';job.questions=[{id:'name',question:'Name?',context:'Name'},{id:'stamp',kind:'unreadable',question:'Unleserlich?',context:'Stempel'}];return {queue,job};}

test('Partial clarification drafts are private, bounded and never submit answers',()=>{
 const {queue,job}=fixture();queue.saveClarificationDraft(job.id,'owner',[{id:'name',answer:'Adam Mithal'},{id:'obsolete',answer:'ignore'}]);
 assert.equal(job.status,'awaiting_answers');assert.equal(job.payload.metadata.clarifications,undefined);
 assert.deepEqual(queue.snapshot('owner').jobs[0].clarificationDraft.answers,[{id:'name',answer:'Adam Mithal'}]);
 assert.equal(queue.snapshot('other').jobs.length,0);assert.throws(()=>queue.saveClarificationDraft(job.id,'other',[]));
 assert.throws(()=>queue.saveClarificationDraft(job.id,'owner',[{id:'name',answer:'x'.repeat(4001)}]));
});

test('Saved attachments survive draft edits and are committed once with the final answers',()=>{
 const {queue,job}=fixture(),files=[{name:'clearer.txt',type:'text/plain',bytes:Buffer.from('fictional clearer scan')}];
 queue.saveClarificationDraft(job.id,'owner',[{id:'name',answer:'Adam'}],files);
 queue.saveClarificationDraft(job.id,'owner',[{id:'name',answer:'Adam Mithal'}]);
 assert.equal(job.clarificationDraft.files.length,1);assert.equal(queue.snapshot('owner').jobs[0].clarificationDraft.files[0].bytes,undefined);
 queue.confirmUnreadable(job.id,'owner','stamp');assert.equal(job.status,'awaiting_answers');
 queue.answer(job.id,'owner',[{id:'name',answer:'Adam Mithal'}]);
 assert.equal(job.status,'queued');assert.deepEqual(job.names,['original.txt','clearer.txt']);assert.equal(job.clarificationDraft,null);assert.equal(job.payload.sourceExtraction,undefined);
});

test('Final unreadable confirmation includes a saved clearer image and clears the draft',()=>{
 const {queue,job}=fixture();job.questions=job.questions.filter(q=>q.id==='stamp');
 queue.saveClarificationDraft(job.id,'owner',[],[{name:'clearer.txt',type:'text/plain',bytes:Buffer.from('fictitious')}]);
 queue.confirmUnreadable(job.id,'owner','stamp');assert.equal(job.status,'queued');assert.equal(job.payload.files.length,2);assert.equal(job.clarificationDraft,null);
});

test('Encrypted workspace retains partial clarification answers and attachments across reload',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'translateocr-draft-test-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const workspace=await new Workspace(directory).init(),{queue,job}=fixture();
 queue.saveClarificationDraft(job.id,'owner',[{id:'name',answer:'Adam Mithal'}],[{name:'clearer.txt',type:'text/plain',bytes:Buffer.from('fictional scan')}]);
 workspace.data.jobs=[job];await workspace.save();const restored=await new Workspace(directory).init();
 assert.equal(restored.data.jobs[0].clarificationDraft.answers[0].answer,'Adam Mithal');
 const saved=restored.data.jobs[0].clarificationDraft.files[0].bytes;assert.equal(Buffer.from(saved.data||saved).toString(),'fictional scan');
});


test('A suggestion resolves only its question and is idempotent while preserving other drafts',()=>{
 const {queue,job}=fixture();queue.saveClarificationDraft(job.id,'owner',[{id:'stamp',answer:'Partial stamp note'}]);
 assert.throws(()=>queue.confirmAnswer(job.id,'other','name',{answer:'Adam Mithal'}));
 assert.throws(()=>queue.confirmAnswer(job.id,'owner','name',{answer:''}));
 queue.confirmAnswer(job.id,'owner','name',{answer:'Adam Mithal'});
 assert.equal(job.status,'awaiting_answers');assert.deepEqual(job.questions.map(q=>q.id),['stamp']);assert.equal(job.clarificationDraft.answers[0].answer,'Partial stamp note');
 queue.confirmAnswer(job.id,'owner','name',{answer:'Adam Mithal'});assert.equal(job.payload.metadata.clarifications.length,1);
 queue.confirmUnreadable(job.id,'owner','stamp');assert.equal(job.status,'queued');assert.equal(job.payload.metadata.clarifications.length,2);
 queue.confirmUnreadable(job.id,'owner','stamp');assert.equal(job.payload.metadata.clarifications.length,2);
});
