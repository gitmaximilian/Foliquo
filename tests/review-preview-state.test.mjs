import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('Lightweight review polls preserve downloads for the same document version only',async()=>{
 const source=await readFile(new URL('../dist/review.js',import.meta.url),'utf8');
 const render=source.slice(source.indexOf('function renderReview(snapshot){'),source.indexOf('async function loadReview('));
 let pdfRenders=0;const nodes=new Map(),context=vm.createContext({$:id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',replaceChildren(){}});return nodes.get(id);},setReviewPDF(){pdfRenders++;},queueResultCache:new Map(),renderReviewControls(){}});
 vm.runInContext('let reviewData=null,reviewHadProposal=false,reviewMessageSignature="[]",reviewPreviewVersion=null,reviewJobId="one";'+render,context);
 const snapshot={jobId:'one',version:1,messages:[],names:['fictional.pdf'],result:{text:'Fictional translation',pdf:'fixture'}};
 context.snapshot=snapshot;vm.runInContext('renderReview(snapshot)',context);
 context.snapshot={jobId:'one',version:1,messages:[]};vm.runInContext('renderReview(snapshot)',context);
 assert.equal(vm.runInContext('reviewData.result.text',context),'Fictional translation');assert.equal(pdfRenders,1,'same-version polling must preserve image zoom and pan');
 context.snapshot={jobId:'one',version:2,messages:[],names:['fictional.pdf']};vm.runInContext('renderReview(snapshot)',context);
 assert.equal(vm.runInContext('reviewData.result',context),undefined,'a changed version must load its own preview');
 context.snapshot={jobId:'two',version:1,messages:[],names:['fictional.pdf']};vm.runInContext('renderReview(snapshot)',context);
 assert.equal(vm.runInContext('reviewData.result',context),undefined,'another document must not inherit the previous preview');
});
