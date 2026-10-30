import test from 'node:test';
import assert from 'node:assert/strict';
import {beginCheckpoint,checkpointFingerprint,checkpointState,completeCheckpoint,interruptCheckpoint,invalidateCheckpoint,reusableCheckpoint} from '../lib/checkpoints.mjs';

test('checkpoint reuse is bound to exact request content and phase',()=>{
 const payload={},request={model:'fictional-model',instructions:'translate',input:[{text:'fictional document'}]},fingerprint=checkpointFingerprint(request,'translation-v1');
 beginCheckpoint(payload,'translation',fingerprint,'usage-a',100);completeCheckpoint(payload,'translation',fingerprint,'translated text',200);
 assert.equal(reusableCheckpoint(payload,'translation',fingerprint),'translated text');assert.equal(reusableCheckpoint(payload,'source_extraction',fingerprint),null);assert.equal(reusableCheckpoint(payload,'translation',checkpointFingerprint({...request,input:[{text:'changed'}]},'translation-v1')),null);assert.deepEqual(checkpointState(payload),{phase:'translation',status:'complete',finishedAt:200});
});

test('an interrupted provider request remains uncertain; invalid output requires an explicit new attempt',()=>{
 const payload={},fingerprint=checkpointFingerprint({prompt:'fictional'});beginCheckpoint(payload,'source_extraction',fingerprint,'usage-b',100);interruptCheckpoint(payload,'source_extraction',fingerprint,150);assert.equal(payload.checkpoints.source_extraction.status,'interrupted');assert.equal(payload.checkpoints.source_extraction.attempts[0].status,'unknown');assert.equal(reusableCheckpoint(payload,'source_extraction',fingerprint),null);
 beginCheckpoint(payload,'source_extraction',fingerprint,'usage-c',200);completeCheckpoint(payload,'source_extraction',fingerprint,'not valid JSON',250);invalidateCheckpoint(payload,'source_extraction',fingerprint);assert.equal(reusableCheckpoint(payload,'source_extraction',fingerprint),null);assert.equal(payload.checkpoints.source_extraction.status,'invalid');
});
