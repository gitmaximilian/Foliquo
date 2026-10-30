import test from 'node:test';
import assert from 'node:assert/strict';
import {approveTranslationSegmentRetry,beginTranslationSegment,buildTranslationPlan,completeTranslationSegment,interruptTranslationSegment,translationPlanProgress} from '../lib/translation-segments.mjs';

test('translation plans are deterministic, page ordered and bind source, model, prompt and context',()=>{
 const documents=[{name:'fictional.pdf',type:'application/pdf',bytes:Buffer.from('Fictional document bytes')}],sourceBlocks=[{id:'src-one',fileIndex:0,page:1},{id:'src-two',fileIndex:0,page:6}];
 const options={documents,pageCounts:[11],sourceBlocks,provider:'openai',model:'fictional-model',contextVersion:'context-v2',maxPagesPerSegment:5};
 const plan=buildTranslationPlan(options),again=buildTranslationPlan(options);assert.deepEqual(plan.segments.map(segment=>segment.id),again.segments.map(segment=>segment.id));assert.deepEqual(plan.segments.map(segment=>segment.pageRange),[[1,5],[6,10],[11,11]]);assert.deepEqual(plan.segments[0].sourceBlockIds,['src-one']);assert.deepEqual(plan.segments[1].sourceBlockIds,['src-two']);assert.deepEqual(plan.segments[1].dependencies,[plan.segments[0].id]);
 assert.notEqual(plan.segments[0].fingerprint,buildTranslationPlan({...options,contextVersion:'context-v3'}).segments[0].fingerprint);assert.equal(JSON.stringify(plan).includes('Fictional document bytes'),false);
});

test('segment request interruptions stay unknown and require explicit retry approval',()=>{
 const plan=buildTranslationPlan({documents:[{name:'fictional.pdf',type:'application/pdf',bytes:Buffer.from('bytes')}],pageCounts:[1],provider:'api',model:'fictional-model'}),segment=plan.segments[0];
 beginTranslationSegment(plan,segment.id,'usage-1',10);interruptTranslationSegment(plan,segment.id,20);assert.equal(segment.status,'interrupted_unknown');assert.equal(segment.attempts[0].status,'unknown');assert.deepEqual(translationPlanProgress(plan),{total:1,complete:0,pending:0,inFlight:0,unknown:1,failed:0,percent:0});
 assert.throws(()=>beginTranslationSegment(plan,segment.id,'usage-2'),/bewusste Wiederholungsfreigabe/);approveTranslationSegmentRetry(plan,segment.id);beginTranslationSegment(plan,segment.id,'usage-2',30);completeTranslationSegment(plan,segment.id,{resultRef:'segment-result-1',usageId:'usage-2'},40);assert.equal(segment.status,'complete');assert.equal(translationPlanProgress(plan).percent,100);assert.throws(()=>beginTranslationSegment(plan,segment.id,'usage-3'),/nicht erneut angefragt/);
});
