import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleTranslatedSegments,beginTranslationSegment,buildTranslationPlan,completeTranslationSegment} from '../lib/translation-segments.mjs';
import {beginCheckpoint,completeCheckpoint} from '../lib/checkpoints.mjs';
import {answerRevisionQuestions,approveRevisionRetry,askRevisionQuestions,createRevisionTask,interruptRevisionTask,revisionTaskMatches,revisionUnknownSegments} from '../lib/revision-segments.mjs';

function fixture(){
 const documents=[{name:'fictional.pdf',type:'application/pdf',bytes:Buffer.from('fictional source bytes')}],pageCounts=[2],plan=buildTranslationPlan({documents,pageCounts,provider:'openai',model:'fixture-model',contextVersion:'context-1',maxPagesPerSegment:1}),assembled=assembleTranslatedSegments(plan,['First fictional section','Second fictional section'],documents,pageCounts);
 return {jobId:'fictional-job',version:1,provider:'openai',model:'fixture-model',contextVersion:'context-1',messages:[{role:'user',text:'Please correct the date.'}],documents,pageCounts,...assembled};
}

test('segmented revision freezes its source, text, context and provider without copying document content',()=>{
 const input=fixture(),task=createRevisionTask(input);assert.equal(task.segments.length,2);assert.deepEqual(task.segments[1].dependencies,[task.segments[0].id]);assert.equal(revisionTaskMatches(task,input),true);assert.equal(JSON.stringify(task).includes('First fictional section'),false);assert.equal(JSON.stringify(task).includes('fictional source bytes'),false);
 assert.equal(revisionTaskMatches(task,{...input,text:input.text+' changed'}),false);assert.equal(revisionTaskMatches(task,{...input,version:2}),false);assert.equal(revisionTaskMatches(task,{...input,provider:'chatgpt'}),false);assert.equal(revisionTaskMatches(task,{...input,documents:[{...input.documents[0],bytes:Buffer.from('different source')}]}),false);
 const damaged=structuredClone(task);damaged.segments[1].pageRange=[1,1];assert.equal(revisionTaskMatches(damaged,input),false);delete damaged.map;assert.equal(revisionTaskMatches(damaged,input),false);
});

test('interrupted revision requests remain unknown until the user explicitly approves another attempt',()=>{
 const task=createRevisionTask(fixture()),segment=task.segments[0],phase=`revision-${segment.id}-0`;task.status='running';beginTranslationSegment(task,segment.id,'fictional-usage',10);beginCheckpoint(task,phase,'fictional-fingerprint','fictional-usage',10);
 assert.deepEqual(interruptRevisionTask(task),['fictional-usage']);assert.equal(task.status,'interrupted');assert.equal(segment.status,'interrupted_unknown');assert.equal(task.checkpoints[phase].status,'interrupted');assert.throws(()=>approveRevisionRetry(task),/ausdrücklich bestätigen/);assert.equal(segment.status,'interrupted_unknown');approveRevisionRetry(task,{confirmUnknown:true});assert.equal(segment.status,'pending');assert.equal(task.status,'pending');
});

test('a response saved before a crash is reused without marking its request unknown',()=>{
 const task=createRevisionTask(fixture()),segment=task.segments[0],phase=`revision-${segment.id}-0`;task.status='running';beginTranslationSegment(task,segment.id,'saved-usage',10);beginCheckpoint(task,phase,'saved-fingerprint','saved-usage',10);completeCheckpoint(task,phase,'saved-fingerprint','fictional response',20);
 assert.deepEqual(interruptRevisionTask(task),[]);assert.equal(task.status,'interrupted');assert.equal(segment.status,'pending');assert.equal(segment.attempts[0].status,'complete');assert.equal(task.checkpoints[phase].result,'fictional response');approveRevisionRetry(task);assert.equal(task.status,'pending');
});

test('a question resumes only its own section while completed sections remain saved',()=>{
 const task=createRevisionTask(fixture()),[first,second]=task.segments,firstPhase=`revision-${first.id}-0`,secondPhase=`revision-${second.id}-0`;
 beginTranslationSegment(task,first.id,'usage-first',10);beginCheckpoint(task,firstPhase,'fingerprint-first','usage-first',10);completeCheckpoint(task,firstPhase,'fingerprint-first','fictional completed response',20);completeTranslationSegment(task,first.id,{resultRef:firstPhase},20);
 beginTranslationSegment(task,second.id,'usage-question',30);beginCheckpoint(task,secondPhase,'fingerprint-second','usage-question',30);completeCheckpoint(task,secondPhase,'fingerprint-second','fictional question response',40);askRevisionQuestions(task,second.id,[{question:'Which fictional spelling?',context:'Page 2'}],secondPhase);assert.equal(task.status,'needs_input');assert.equal(first.status,'complete');first.attempts.unshift({usageId:'previous-unknown',status:'unknown'});assert.deepEqual(interruptRevisionTask(task),[]);assert.equal(task.status,'needs_input','an old unknown attempt does not interrupt a later question');assert.throws(()=>answerRevisionQuestions(task,''),/nicht fortgesetzt/);
 assert.throws(()=>answerRevisionQuestions(task,42),/nicht fortgesetzt/);answerRevisionQuestions(task,'Use Example.');assert.equal(task.status,'pending');assert.equal(second.round,1);assert.equal(second.status,'pending');assert.deepEqual(second.answers.map(item=>item.role),['assistant','user']);assert.deepEqual(first.answers,[]);assert.equal(task.checkpoints[firstPhase].result,'fictional completed response');assert.equal(task.history.length,1);assert.equal(revisionTaskMatches(task,fixture()),true);
 const restored=JSON.parse(JSON.stringify(task));assert.equal(restored.segments[0].status,'complete');assert.equal(restored.segments[1].answers.at(-1).text,'Use Example.');
});

test('an inconsistent interrupted checkpoint still requires explicit retry approval',()=>{
 const task=createRevisionTask(fixture()),segment=task.segments[0],phase=`revision-${segment.id}-0`;task.status='running';beginCheckpoint(task,phase,'fictional-fingerprint','fictional-usage',10);assert.deepEqual(interruptRevisionTask(task),['fictional-usage']);assert.equal(segment.status,'pending');assert.equal(revisionUnknownSegments(task).length,1);assert.throws(()=>approveRevisionRetry(task),/ausdrücklich bestätigen/);approveRevisionRetry(task,{confirmUnknown:true});assert.equal(task.status,'pending');
});
