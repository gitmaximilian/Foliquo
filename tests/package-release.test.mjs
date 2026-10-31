import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationInputs} from '../scripts/package-release.mjs';

test('curated user package includes the personal learning impact tool and its instructions',()=>{
 assert.ok(applicationInputs.includes('lib'),'The complete runtime library must be shipped.');
 for(const file of ['scripts/learning-impact.mjs','docs/LEARNING-IMPACT-EVALUATION.md'])assert.ok(applicationInputs.includes(file),`${file} must be shipped in the curated package`);
});
