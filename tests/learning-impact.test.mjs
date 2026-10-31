import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {evaluateLearningImpact,validateLearningImpactInput} from '../lib/learning-impact.mjs';

const study=(count=20)=>({schemaVersion:1,studyId:'fictional-pilot',cases:Array.from({length:count},(_,index)=>({caseId:`fictional-${index+1}`,independentDocumentAttested:true,qualifiedReviewAttested:true,blindLabelsAttested:true,randomizedOrderAttested:true,withoutLearning:{styleCorrections:3,terminologyCorrections:2,criticalFactErrors:0},withLearning:{styleCorrections:2,terminologyCorrections:2,criticalFactErrors:0}}))});

test('paired learning impact passes only with 20 independent cases, at least 20 percent fewer corrections and no critical regression',()=>{
 const report=evaluateLearningImpact(study(),{sourceRevision:'fictional-revision'});
 assert.equal(report.passed,true);assert.equal(report.correctionReduction,0.2);assert.equal(report.caseCount,20);assert.equal(report.withoutLearning.criticalFactErrors,0);assert.equal(report.criticalFactRegressions,0);assert.match(report.evidenceStatus,/not independently verified/u);assert.doesNotMatch(JSON.stringify(report),/private data|fictional-pilot|fictional-1/iu);assert.equal(report.results[0].caseNumber,1);assert.equal('caseId' in report.results[0],false);
 const regressed=study();regressed.cases[0].withLearning.criticalFactErrors=1;assert.equal(evaluateLearningImpact(regressed).passed,false);assert.equal(evaluateLearningImpact(regressed).criticalFactRegressions,1);
});

test('paired learning impact reports failed sample-size and refuses duplicate or document-bearing inputs',()=>{
 assert.equal(evaluateLearningImpact(study(19)).gates.minimumIndependentDocuments,false);
 const duplicate=study();duplicate.cases[1].caseId=duplicate.cases[0].caseId;assert.throws(()=>validateLearningImpactInput(duplicate),/unique opaque caseId/u);
 const withText=study();withText.cases[0].sourceDocument='private data';assert.throws(()=>validateLearningImpactInput(withText),/only allowed fields/u);
 const unattested=study();unattested.cases[0].blindLabelsAttested=false;assert.throws(()=>validateLearningImpactInput(unattested),/blindLabelsAttested/u);
});

test('learning impact CLI writes a local report and returns failure when study gates are unmet',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-learning-impact-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const input=join(directory,'counts.json'),output=join(directory,'report.json');await writeFile(input,JSON.stringify(study(2)));
 const result=spawnSync(process.execPath,['scripts/learning-impact.mjs','--input',input,'--output',output],{encoding:'utf8'});assert.equal(result.status,1,result.stderr);assert.match(result.stdout,/"passed":false/u);
 const report=JSON.parse(await readFile(output,'utf8'));assert.equal(report.caseCount,2);assert.equal(report.gates.minimumIndependentDocuments,false);assert.match(report.inputFingerprint,/^[a-f0-9]{64}$/u);
});
