import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeHumanReview,validateHumanReview} from '../lib/benchmark-human-review.mjs';

const fixtures=[{id:'f1',documentType:'birth certificate',sourceLanguage:'Arabic',targetLanguage:'German'},{id:'f2',documentType:'letter',sourceLanguage:'English',targetLanguage:'German'}];
function review(){return {schema:1,fixtureSetVersion:'gold-v1',createdAt:'2026-10-31T00:00:00.000Z',reviewerCode:'private-reviewer-code',qualificationSelfAttested:true,independenceSelfAttested:true,cases:fixtures.map((fixture,index)=>({caseCode:`R-00${index+1}`,fixtureId:fixture.id,ratings:{meaning:4,criticalFacts:5,completeness:3,terminology:4,readability:4,questions:3,criticalFactErrors:index,omissions:index+1,unsupportedAdditions:0,necessaryQuestions:2,necessaryQuestionsAsked:1,unnecessaryQuestions:1,reworkMinutes:10+index}}))};}

test('human review aggregation keeps rubric means, question metrics, and time separate by group',()=>{
 const validated=validateHumanReview(fixtures,'gold-v1',review()),report=summarizeHumanReview(fixtures,validated);assert.equal(report.status,'completed-self-attested-single-reviewer');assert.equal(report.reviewedCaseCount,2);assert.equal(report.overall.caseCount,2);assert.equal(report.overall.rubricMeans.meaning.mean,4);assert.equal(report.overall.rubricMeans.criticalFacts.mean,5);assert.equal(report.overall.findings.criticalFactErrors,1);assert.equal(report.overall.findings.omissions,3);assert.equal(report.overall.questionDetection.precision,0.5);assert.equal(report.overall.questionDetection.recall,0.5);assert.equal(report.overall.humanReworkMinutes.total,21);assert.equal(report.overall.humanReworkMinutes.median,10.5);assert.equal(report.byDocumentFamily.length,2);assert.equal(report.byLanguagePair.length,2);assert.equal(JSON.stringify(report).includes('private-reviewer-code'),false);assert.match(report.interpretation,/no combined quality score/i);
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
