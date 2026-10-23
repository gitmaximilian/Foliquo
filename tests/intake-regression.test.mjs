import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PDFDocument} from 'pdf-lib';
import {intakeQuestions} from '../lib/studio.mjs';
import {Workspace} from '../lib/workspace.mjs';
import {createApp} from '../server.mjs';
import {TranslationQueue} from '../lib/queue.mjs';
import {unzipSync,strFromU8} from 'fflate';
import {sourceFields} from '../lib/verification.mjs';
import {parseFinalTranslation} from '../lib/translation-policy.mjs';
import {locateSource} from '../lib/source-location.mjs';

test('Incomplete uncertainty labels become answerable questions and retain the source location',()=>{
 const questions=intakeQuestions([], [{fileIndex:0,page:2,box:[.1,.2,.3,.1]}, {label:null}, {label:'x'.repeat(151)}], {}, [], [{}]);
 assert.equal(questions.length,3);
 assert.equal(questions[0].label,'Unleserliche Stelle 1');
 assert.equal(questions[0].kind,'unreadable');
 assert.equal(questions[0].page,2);
 assert.deepEqual(questions[0].box,[.1,.2,.3,.1]);
 assert.equal(questions[2].label.length,150);
 assert.equal(intakeQuestions([],null,{}).length,0);
 const meta={clarifications:[{context:questions[0].context,answer:'Fictional text',fileIndex:0,page:2}]};
 assert.equal(intakeQuestions([], [{page:2}],meta,[],[{}]).length,0);
 assert.equal(intakeQuestions([], [{page:3}],meta,[],[{}]).length,1,'a different source page still needs an answer');
});

test('A missing model label does not abort the job; answering the question allows PDF and Word output',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'translateocr-intake-regression-'));
 const workspace=await new Workspace(directory).init();
 let extractions=0,translations=0;
 const provider={status:()=>({connected:true,planEnabled:true}),models:async()=>[{id:'fixture'}],respond:async request=>{
  if(request.instructions.includes('Extrahiere')){extractions++;return JSON.stringify({documentType:'Fiktiv',fields:[],uncertainRegions:[{page:1,box:[.1,.2,.3,.1]}]});}
  translations++;
  assert.ok(request.input[0].content.some(c=>c.text?.includes('im Original unleserlich')));
  return JSON.stringify({status:'ready',sourceLanguage:'Englisch',documentType:'Fiktiv',questions:[],text:'Stempel | [im Original unleserlich]',fields:[]});
 }};
 const port=15623,origin=`http://127.0.0.1:${port}`;
 const app=createApp({port,workspace,connection:{data:{}},provider});
 await new Promise(r=>app.listen(port,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>app.close(r));await workspace.tail;await rm(directory,{recursive:true,force:true});});
 const home=await fetch(origin),cookie=home.headers.get('set-cookie').split(';')[0];
 const session=await fetch(origin+'/api/session',{headers:{cookie}}).then(r=>r.json());
 const headers={cookie,origin,'content-type':'application/json','x-translateocr-csrf':session.csrf};
 const post=(path,input)=>fetch(origin+path,{method:'POST',headers,body:JSON.stringify(input)});
 const pdf=await PDFDocument.create();pdf.addPage();
 const added=await post('/api/jobs',{clientId:'fixture',requestId:'missing-label',model:'fixture',metadata:{targetLanguage:'Deutsch'},files:[{name:'fictional.pdf',data:Buffer.from(await pdf.save()).toString('base64')}]});
 assert.equal(added.status,202);
 const {id}=await added.json();
 const wait=async status=>{for(let n=0;n<200;n++){const {jobs}=await fetch(origin+'/api/jobs',{headers}).then(r=>r.json());const job=jobs.find(j=>j.id===id);if(job?.status===status)return job;if(job?.status==='failed')assert.fail(job.error);await new Promise(r=>setTimeout(r,20));}assert.fail(`Missing ${status}`);};
 const question=await wait('awaiting_answers');
 assert.equal(question.questions[0].kind,'unreadable');
 assert.equal((await post(`/api/jobs/${id}/unreadable`,{questionId:question.questions[0].id})).status,200);
 await wait('succeeded');
 const result=await fetch(origin+`/api/jobs/${id}/result`,{headers}).then(r=>r.json());
 assert.equal(extractions,1);assert.equal(translations,1);
 assert.equal(Buffer.from(result.pdf,'base64').subarray(0,5).toString(),'%PDF-');
 assert.ok(result.word);
 assert.match(strFromU8(unzipSync(Buffer.from(result.word,'base64'))['word/document.xml']),/im Original unleserlich/);
});

test('Unreadable is an explicit answer for illegibility questions, never a substitute for a name spelling',()=>{
 const queue=new TranslationQueue(async()=>{});queue.pause();
 const job=queue.add({owner:'fixture',requestId:'fixture',payload:{files:[],metadata:{}}});
 job.status='awaiting_answers';job.questions=[{id:'name',question:'Name laut Pass?',context:'Namensabgleich'}];
 assert.throws(()=>queue.answer(job.id,'fixture',[{id:'name',unreadable:true}]),/keine unleserliche/);
 assert.equal(job.status,'awaiting_answers');
});

test('Name and reading suggestions remain optional candidates until the user chooses an answer',()=>{
 const fields=sourceFields([{label:'Name',kind:'name',source:'آدم مثال',translated:'آدم مثال',suggestion:'Adam Mithal'}],[{}]);
 const questions=intakeQuestions(fields,[{label:'Stempel',suggestion:'Fictional authority',page:1}],{},[],[{}]);
 assert.equal(questions[0].suggestion,'Adam Mithal');
 assert.equal(questions[1].suggestion,'Fictional authority');
 assert.equal(questions[0].answer,undefined);
 const parsed=parseFinalTranslation(JSON.stringify({status:'questions',sourceLanguage:'Arabisch',documentType:'Fiktiv',text:'',questions:[{question:'Welche Lesung stimmt?',context:'Stempel',suggestion:'Fictional authority'}]}));
 assert.equal(parsed.questions[0].suggestion,'Fictional authority');
 assert.equal(parsed.text,undefined);
 assert.equal(intakeQuestions(sourceFields([{...fields[0],suggestion:'آدم'}],[{}]),[],{})[0].suggestion,'');
});

test('Confirming illegibility removes only that question immediately and resumes after the final answer',()=>{
 const queue=new TranslationQueue(async()=>{});queue.pause();
 const job=queue.add({owner:'fixture',requestId:'partial',payload:{files:[],metadata:{}}});
 job.status='awaiting_answers';job.questions=[{id:'name',question:'Name?',context:'Name'},{id:'stamp',kind:'unreadable',question:'Stempel unleserlich?',context:'Unleserliche Stelle: Stempel'}];
 queue.confirmUnreadable(job.id,'fixture','stamp');
 assert.equal(job.status,'awaiting_answers');assert.deepEqual(job.questions.map(q=>q.id),['name']);
 assert.equal(job.payload.metadata.clarifications[0].unreadable,true);
 queue.confirmUnreadable(job.id,'fixture','stamp');assert.equal(job.payload.metadata.clarifications.length,1);
 queue.answer(job.id,'fixture',[{id:'name',answer:'Adam Mithal'}]);assert.equal(job.status,'queued');
 assert.equal(job.payload.metadata.clarifications.length,2);
});

test('Missing source coordinates are located on the selected original page and reused without another model request',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage([400,500]);pdf.addPage([222,333]);
 const field={id:'field-0',label:'Name',source:'Fictional name',fileIndex:0,page:2,box:null};
 const job={model:'fixture',targetLanguage:'Deutsch',result:{fields:[field],checks:[{...field}],previews:[{name:'fictional.pdf',type:'application/pdf',data:Buffer.from(await pdf.save()).toString('base64')}]}};
 let calls=0;
 const provider={respond:async request=>{calls++;const document=request.input[0].content.find(c=>c.type==='input_file');const selected=await PDFDocument.load(Buffer.from(document.file_data.split(',')[1],'base64'));assert.equal(selected.getPageCount(),1);assert.equal(selected.getPage(0).getWidth(),222);return JSON.stringify({found:true,box:[.1,.2,.5,.1]});}};
 assert.deepEqual((await locateSource(job,{fieldId:field.id},provider)).box,[.1,.2,.5,.1]);
 assert.deepEqual(job.result.checks[0].box,field.box);
 await locateSource(job,{fieldId:field.id},provider);assert.equal(calls,1);
 field.box=null;
 assert.equal((await locateSource(job,{fieldId:field.id},{respond:async()=>'{"found":false,"box":null}'})).found,false);
 assert.equal(field.box,null);
 await assert.rejects(locateSource(job,{fieldId:field.id},{respond:async()=>'{"found":true,"box":[0.9,0,0.5,0.1]}'}),/gültige Bildmarkierung/);
});
