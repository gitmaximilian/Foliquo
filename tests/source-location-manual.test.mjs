import test from 'node:test';
import assert from 'node:assert/strict';
import {saveSourceLocation} from '../lib/source-location.mjs';

const makeJob=()=>({id:'job',status:'awaiting_answers',result:{previews:[{name:'fictional.png',type:'image/png',data:Buffer.from('fixture').toString('base64')}],fields:[{id:'field-0',label:'Name',source:'',translated:'Adam'}],checks:[]},questions:[{id:'field-0',label:'Name',question:'Confirm name',fileIndex:0,page:1}]});

test('manual source region is validated and saved to the question and its corresponding field',async()=>{const job=makeJob(),box=[.2,.3,.15,.04],saved=await saveSourceLocation(job,{questionId:'field-0',fileIndex:0,page:1,box});assert.deepEqual(saved,{found:true,fileIndex:0,page:1,box});assert.deepEqual(job.questions[0].box,box);assert.deepEqual(job.result.fields[0].box,box);});

test('manual source region rejects invalid coordinates and unavailable pages without changing the job',async()=>{const job=makeJob();await assert.rejects(saveSourceLocation(job,{questionId:'field-0',fileIndex:0,page:1,box:[.95,.3,.2,.04]}),/sichtbaren Bereich/);await assert.rejects(saveSourceLocation(job,{questionId:'field-0',fileIndex:0,page:2,box:[.2,.3,.15,.04]}),/nur Seite 1/);assert.equal(job.questions[0].box,undefined);});
