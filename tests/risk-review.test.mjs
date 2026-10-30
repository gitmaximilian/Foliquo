import test from 'node:test';
import assert from 'node:assert/strict';
import {intakeQuestions} from '../lib/studio.mjs';
import {verificationFor} from '../lib/verification.mjs';

test('verification prioritizes missing or inconsistent critical values before lower-risk checks',()=>{
 const fields=[
  {id:'style',label:'Authority',kind:'other',source:'Authority',translated:'Fictional Authority',fileIndex:0,page:1},
  {id:'number',label:'Document number',kind:'number',source:'123',translated:'999',fileIndex:0,page:1},
  {id:'name',label:'Name',kind:'name',source:'Alex Example',translated:'Alex Example',fileIndex:0,page:1},
  {id:'date',label:'Date',kind:'date',source:'7 March 1998',translated:'07.03.1998',fileIndex:0,page:1}
 ];
 const checks=verificationFor('Name: Alex Example\nDate: 07.03.1998\nNumber: 999',fields,[{}]);
 assert.deepEqual(checks.slice(0,4).map(check=>[check.id,check.severity]),[['number','critical'],['style','warning'],['name','review'],['date','review']]);
 assert.deepEqual(checks.slice(-2).map(check=>check.id),['completeness','names-dates']);
 assert.ok(checks.find(check=>check.id==='number').issue);
});

test('clarification identity stays stable for the same source location and differs across pages',()=>{
 const name={kind:'name',source:'آدم مثال',label:'Name',fileIndex:0,page:1,box:[.1,.2,.6,.1]};
 const first=intakeQuestions([name],[],{},[],[{}])[0];
 const repeated=intakeQuestions([name],[],{},[],[{}])[0];
 const anotherPage=intakeQuestions([{...name,page:2}],[],{},[],[{}])[0];
 assert.equal(first.id,repeated.id);
 assert.notEqual(first.id,anotherPage.id);
 assert.match(first.id,/^q-[a-f0-9]{24}$/);
});

test('same-label questions on one page remain distinct when their source boxes differ',()=>{
 const first={kind:'name',source:'آدم مثال',label:'Name',fileIndex:0,page:1,box:[.1,.2,.3,.1]},second={...first,box:[.6,.2,.3,.1]};
 const questions=intakeQuestions([first,second],[],{},[],[{}]);
 assert.equal(questions.length,2);
 assert.notEqual(questions[0].id,questions[1].id);
 const answeredFirst=intakeQuestions([first,second],[],{clarifications:[{questionId:questions[0].id,context:questions[0].context,fileIndex:0,page:1,box:first.box,answer:'Adam Example'}]},[],[{}]);
 assert.deepEqual(answeredFirst.map(question=>question.id),[questions[1].id]);
});
