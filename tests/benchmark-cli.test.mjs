import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(new URL('../scripts/benchmark.mjs',import.meta.url));
test('offline benchmark report records its source and quality limits',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-benchmark-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const run=spawnSync(process.execPath,[script,'--output',directory],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 const report=JSON.parse(await readFile(join(directory,'report.json'),'utf8'));
 assert.equal(report.mode,'offline-reference-pipeline');assert.equal(report.fixtureSet,'offline-smoke-v1');assert.equal(report.results.length,3);assert.equal(report.provider,null);assert.equal(report.modelId,null);assert.equal(report.requestCount,0);assert.match(report.sourceRevision,/^[0-9a-f]{40}$/);
});

test('live benchmark refuses to run without an explicit bounded fixture count',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-benchmark-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const run=spawnSync(process.execPath,[script,'--live','--model','fictional-model','--output',directory],{encoding:'utf8'});
 assert.notEqual(run.status,0);assert.match(run.stderr,/--max-cases zwischen 1 und 3/);assert.doesNotMatch(run.stderr,/api\.openai\.com|authorization/i);
});
