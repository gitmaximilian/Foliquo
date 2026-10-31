import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeHumanReview,validateHumanReview} from '../lib/benchmark-human-review.mjs';
import {createBenchmarkReviewForm} from '../lib/benchmark-review-form.mjs';

const fixtures=[{id:'f1',documentType:'birth certificate',sourceLanguage:'Arabic',targetLanguage:'German'},{id:'f2',documentType:'letter',sourceLanguage:'English',targetLanguage:'German'}];
function review(){return {schema:1,fixtureSetVersion:'gold-v1',createdAt:'2026-10-31T00:00:00.000Z',reviewerCode:'private-reviewer-code',qualificationSelfAttested:true,independenceSelfAttested:true,cases:fixtures.map((fixture,index)=>({caseCode:`R-00${index+1}`,fixtureId:fixture.id,ratings:{meaning:4,criticalFacts:5,completeness:3,terminology:4,readability:4,questions:3,criticalFactErrors:index,omissions:index+1,unsupportedAdditions:0,necessaryQuestions:2,necessaryQuestionsAsked:1,unnecessaryQuestions:1,reworkMinutes:10+index}}))};}

test('human review aggregation keeps rubric means, question metrics, and time separate by group',()=>{
 const validated=validateHumanReview(fixtures,'gold-v1',review()),report=summarizeHumanReview(fixtures,validated);assert.equal(report.status,'completed-self-attested-single-reviewer');assert.equal(report.reviewedCaseCount,2);assert.equal(report.overall.caseCount,2);assert.equal(report.overall.rubricMeans.meaning.mean,4);assert.equal(report.overall.rubricMeans.criticalFacts.mean,5);assert.equal(report.overall.findings.criticalFactErrors,1);assert.equal(report.overall.findings.omissions,3);assert.equal(report.overall.questionDetection.precision,0.5);assert.equal(report.overall.questionDetection.recall,0.5);assert.equal(report.overall.humanReworkMinutes.total,21);assert.equal(report.overall.humanReworkMinutes.median,10.5);assert.equal(report.byDocumentFamily.length,2);assert.equal(report.byLanguagePair.length,2);assert.equal(JSON.stringify(report).includes('private-reviewer-code'),false);assert.match(report.interpretation,/no combined quality score/i);
});

test('human review accepts shuffled display order while binding each stable code to its fixture',()=>{
 const shuffled=review();shuffled.cases.reverse();
 const validated=validateHumanReview(fixtures,'gold-v1',shuffled),report=summarizeHumanReview(fixtures,validated);
 assert.deepEqual(validated.reviewed.map(item=>item.fixtureId),['f2','f1']);
 assert.equal(report.byDocumentFamily.find(item=>item.group==='birth certificate').findings.criticalFactErrors,0);
 assert.equal(report.byDocumentFamily.find(item=>item.group==='letter').findings.criticalFactErrors,1);
 const mismatched={...shuffled,cases:[{...shuffled.cases[0],caseCode:'R-001'},shuffled.cases[1]]};
 assert.throws(()=>validateHumanReview(fixtures,'gold-v1',mismatched),/code that does not match its fixture/);
});

test('human review import rejects unknown and duplicate fixtures after order randomization',()=>{
 for(const cases of [
  [{...review().cases[0],fixtureId:'unknown'},review().cases[1]],
  [review().cases[0],review().cases[0]],
 ])assert.throws(()=>validateHumanReview(fixtures,'gold-v1',{...review(),cases}),/Human review file is invalid/);
});

test('review form shuffles presentation while preserving stable fixture codes',()=>{
 const ordered=[...fixtures,{id:'f3',source:'Fictional third case'}];
 const html=createBenchmarkReviewForm(ordered,[],'gold-v1',{randomIndex:()=>0});
 const json=html.match(/<script type="application\/json" id="review-data">([\s\S]*?)<\/script>/)?.[1];
 const cases=JSON.parse(json).cases;
 assert.deepEqual(cases.map(item=>item.fixtureId),['f2','f3','f1']);
 assert.deepEqual(cases.map(item=>item.code),['R-002','R-003','R-001']);
});

test('human review import rejects version mismatches, ID/order drift, missing attestation, and invalid counts',()=>{
 const cases=[
  value=>({...value,fixtureSetVersion:'other-v1'}),
  value=>({...value,cases:[{...value.cases[0],fixtureId:'wrong'},value.cases[1]]}),
  value=>({...value,independenceSelfAttested:false}),
  value=>({...value,cases:[{...value.cases[0],ratings:{...value.cases[0].ratings,criticalFactErrors:-1}},value.cases[1]]}),
  value=>({...value,cases:[{...value.cases[0],ratings:{...value.cases[0].ratings,necessaryQuestionsAsked:3}},value.cases[1]]}),
 ];
 for(const mutate of cases)assert.throws(()=>validateHumanReview(fixtures,'gold-v1',mutate(review())),/Human review file is invalid/);
});
