import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {approveTranslationSegmentRetry,beginTranslationSegment,buildTranslationPlan,completeTranslationSegment,failTranslationSegment,interruptTranslationSegment,markTranslationSegmentNeedsInput,resetTranslationSegmentAndDependents,translationPlanProgress,translationSegmentDocuments} from '../lib/translation-segments.mjs';

test('translation plans are deterministic, page ordered and bind source, model, prompt and context',()=>{
 const documents=[{name:'fictional.pdf',type:'application/pdf',bytes:Buffer.from('Fictional document bytes')}],sourceBlocks=[{id:'src-one',fileIndex:0,page:1},{id:'src-two',fileIndex:0,page:6}];
 const options={documents,pageCounts:[11],sourceBlocks,provider:'openai',model:'fictional-model',contextVersion:'context-v2',maxPagesPerSegment:5};
 const plan=buildTranslationPlan(options),again=buildTranslationPlan(options);assert.deepEqual(plan.segments.map(segment=>segment.id),again.segments.map(segment=>segment.id));assert.deepEqual(plan.segments.map(segment=>segment.pageRange),[[1,5],[6,10],[11,11]]);assert.deepEqual(plan.segments[0].sourceBlockIds,['src-one']);assert.deepEqual(plan.segments[1].sourceBlockIds,['src-two']);assert.deepEqual(plan.segments[1].dependencies,[plan.segments[0].id]);
 const one=buildTranslationPlan({documents,pageCounts:[1],provider:'openai',model:'fictional-model'}),fifty=buildTranslationPlan({documents,pageCounts:[50],provider:'openai',model:'fictional-model'});assert.equal(one.segments.length,1);assert.equal(fifty.segments.length,10);assert.deepEqual(fifty.segments.at(-1).pageRange,[46,50]);
 const digest=value=>createHash('sha256').update(value).digest('hex'),documentId=`doc-${digest(documents[0].bytes).slice(0,20)}-0`;assert.equal(plan.segments[0].sourcePageIds[0],`page-${digest(`${documentId}:1`).slice(0,24)}`);
 assert.notEqual(plan.segments[0].fingerprint,buildTranslationPlan({...options,contextVersion:'context-v3'}).segments[0].fingerprint);assert.equal(JSON.stringify(plan).includes('Fictional document bytes'),false);
});

test('segment request interruptions stay unknown and require explicit retry approval',()=>{
 const plan=buildTranslationPlan({documents:[{name:'fictional.pdf',type:'application/pdf',bytes:Buffer.from('bytes')}],pageCounts:[1],provider:'api',model:'fictional-model'}),segment=plan.segments[0];
 beginTranslationSegment(plan,segment.id,'usage-1',10);interruptTranslationSegment(plan,segment.id,20);assert.equal(segment.status,'interrupted_unknown');assert.equal(segment.attempts[0].status,'unknown');assert.deepEqual(translationPlanProgress(plan),{total:1,complete:0,pending:0,inFlight:0,needsInput:0,unknown:1,failed:0,percent:0});
 assert.throws(()=>beginTranslationSegment(plan,segment.id,'usage-2'),/bewusste Wiederholungsfreigabe/);approveTranslationSegmentRetry(plan,segment.id);beginTranslationSegment(plan,segment.id,'usage-2',30);completeTranslationSegment(plan,segment.id,{resultRef:'segment-result-1',usageId:'usage-2'},40);assert.equal(segment.status,'complete');assert.equal(translationPlanProgress(plan).percent,100);assert.throws(()=>beginTranslationSegment(plan,segment.id,'usage-3'),/nicht erneut angefragt/);
});

test('later segments wait for dependencies and known failures stay distinct from unknown requests',()=>{
 const plan=buildTranslationPlan({documents:[{name:'fictional.pdf',type:'application/pdf',bytes:Buffer.from('bytes')}],pageCounts:[2],provider:'api',model:'fictional-model',maxPagesPerSegment:1}),[first,second]=plan.segments;
 assert.throws(()=>beginTranslationSegment(plan,second.id,'usage-2'),/Vorgelagerte/);beginTranslationSegment(plan,first.id,'usage-1',10);failTranslationSegment(plan,first.id,'INVALID_OUTPUT',20);assert.equal(first.status,'failed');assert.equal(first.attempts[0].status,'failed');assert.equal(translationPlanProgress(plan).failed,1);assert.throws(()=>beginTranslationSegment(plan,second.id,'usage-2'),/Vorgelagerte/);
});

test('materialized PDF segments contain only their assigned source pages',async()=>{
 const source=await PDFDocument.create();for(let page=1;page<=6;page++)source.addPage([300+page,500+page]);const bytes=Buffer.from(await source.save()),documents=[{name:'fictional.pdf',originalName:'fictional.pdf',type:'application/pdf',bytes}],plan=buildTranslationPlan({documents,pageCounts:[6],provider:'openai',model:'fictional-model',maxPagesPerSegment:2}),segment=plan.segments[1];
 const [slice]=await translationSegmentDocuments(plan,segment.id,documents),pdf=await PDFDocument.load(slice.bytes);assert.equal(pdf.getPageCount(),2);assert.equal(pdf.getPages()[0].getWidth(),303);assert.equal(pdf.getPages()[1].getWidth(),304);assert.equal(slice.sourcePageStart,3);assert.equal(slice.sourceFileIndex,0);assert.equal(slice.originalName,'fictional.pdf');
});

test('a clarification holds later segments until its source-bound segment is rerun',()=>{
 const plan=buildTranslationPlan({documents:[{name:'fictional.pdf',type:'application/pdf',bytes:Buffer.from('Fictional source')}],pageCounts:[2],provider:'openai',model:'fixture-model',maxPagesPerSegment:1}),[first,second]=plan.segments;
 beginTranslationSegment(plan,first.id,'usage-question');markTranslationSegmentNeedsInput(plan,first.id,{resultRef:'translation-'+first.id,usageId:'usage-question'});assert.equal(first.status,'needs_input');assert.throws(()=>beginTranslationSegment(plan,second.id,'usage-second'),/Vorgelagerte/);assert.deepEqual(resetTranslationSegmentAndDependents(plan,first.id),[first.id,second.id]);beginTranslationSegment(plan,first.id,'usage-after-answer');
});
