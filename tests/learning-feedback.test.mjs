import test from 'node:test';
import assert from 'node:assert/strict';
import {learningFeedbackSnapshot,learningFeedbackSummary,recordLearningExposure,recordLearningFeedback} from '../lib/learning-feedback.mjs';
import {learningList} from '../lib/learning.mjs';

test('learning exposure is counted once per finalized job and profile version',()=>{
 const workspace={data:{learning:[{id:'fictional-style',version:3,learningUsage:{schema:1,versions:{}}}]}},job={id:'fictional-job',result:{context:{appliedLearning:[{id:'fictional-style',profileVersion:3}]}},review:{version:2,finalizedVersion:null}};
 assert.deepEqual(recordLearningExposure(workspace,job),[]);job.review.finalizedVersion=2;recordLearningExposure(workspace,job);recordLearningExposure(workspace,job);
 assert.deepEqual(learningFeedbackSummary(workspace.data.learning[0]),[{profileVersion:3,eligibleUses:1,explicitHelpful:0,explicitRejected:0}]);
});

test('profile feedback requires a finalized current version, is idempotent and can be corrected',()=>{
 const entry={id:'fictional-style',version:3},workspace={data:{learning:[entry]}},job={id:'fictional-job',result:{context:{appliedLearning:[{id:entry.id,profileVersion:3}]}},review:{version:2,finalizedVersion:null}};
 recordLearningExposure(workspace,{...job,review:{version:2,finalizedVersion:2}});
 assert.throws(()=>recordLearningFeedback(workspace,job,{version:2,entryId:entry.id,profileVersion:3,outcome:'helpful'},job.review),/finale Fassung/);
 job.review.finalizedVersion=2;recordLearningFeedback(workspace,job,{version:2,entryId:entry.id,profileVersion:3,outcome:'helpful'},job.review);recordLearningFeedback(workspace,job,{version:2,entryId:entry.id,profileVersion:3,outcome:'helpful'},job.review);
 assert.deepEqual(learningFeedbackSummary(entry),[{profileVersion:3,eligibleUses:1,explicitHelpful:1,explicitRejected:0}]);
 recordLearningFeedback(workspace,job,{version:2,entryId:entry.id,profileVersion:3,outcome:'rejected'},job.review);assert.deepEqual(learningFeedbackSummary(entry),[{profileVersion:3,eligibleUses:1,explicitHelpful:0,explicitRejected:1}]);
 assert.equal(learningFeedbackSnapshot(workspace,job)[0].outcome,'rejected');assert.equal(JSON.stringify(learningFeedbackSummary(entry)).includes(job.id),false);const publicEntry=learningList(workspace)[0];assert.equal('learningUsage'in publicEntry,false);assert.equal(JSON.stringify(publicEntry).includes(job.id),false);
 assert.throws(()=>recordLearningFeedback(workspace,job,{version:2,entryId:entry.id,profileVersion:2,outcome:'helpful'},job.review),/nicht verwendet/);
});
