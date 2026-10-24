import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const scope=vm.createContext({});vm.runInContext(await readFile(new URL('../dist/queue-status.js',import.meta.url),'utf8'),scope);
const status=(job,paused)=>scope.queueStatus(job,paused);
test('Job statuses distinguish active work, action needed, failure and completion without relying on color',()=>{
 for(const state of ['running','awaiting_answers','succeeded','failed','cancelled','expired','queued','cancelling']){const view=status({status:state,progress:35});assert.ok(view.label);assert.ok(view.icon);assert.ok(view.tone);}
 assert.equal(status({status:'awaiting_answers'}).tone,'attention');assert.equal(status({status:'failed'}).tone,'error');assert.equal(status({status:'succeeded'}).tone,'success');
 assert.equal(status({status:'queued'},true).label,'Pausiert');assert.equal(status({status:'queued'},false).label,'Wartet');
});
test('Per-job progress is rounded and bounded while completion is always 100 percent',()=>{
 assert.equal(status({status:'running',progress:42.6}).progress,43);assert.equal(status({status:'running',progress:-1}).progress,0);assert.equal(status({status:'running',progress:900}).progress,100);assert.equal(status({status:'running',progress:NaN}).progress,0);assert.equal(status({status:'succeeded',progress:2}).progress,100);
});
