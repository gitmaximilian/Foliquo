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
 assert.equal(report.mode,'technical');assert.equal(report.fixtureSet,'offline-smoke-v1');assert.equal(report.fixtureCount,3);assert.equal(report.results.length,3);assert.equal(report.provider,null);assert.equal(report.modelId,null);assert.equal(report.requestCount,0);assert.equal(report.usage.apiCost,null);assert.equal(report.configuration.sourcePageAppendix,'not-tested; text-only benchmark fixtures');assert.match(report.sourceRevision,/^[0-9a-f]{40}$/);assert.match(report.fingerprints.fixtureSetSha256,/^[0-9a-f]{64}$/);assert.equal(report.results.every(result=>result.requestFingerprint===null&&result.sourceFingerprint.length===64),true);
 const compared=spawnSync(process.execPath,[script,'--baseline',join(directory,'report.json'),'--output',join(directory,'compared')],{encoding:'utf8'});assert.equal(compared.status,0,compared.stderr);const comparison=JSON.parse(await readFile(join(directory,'compared','report.json'),'utf8')).comparison;assert.equal(comparison.matchedCases,3);assert.equal(comparison.baselineRevision,report.sourceRevision);
});

test('development benchmark evaluates all 20 separate synthetic cases and records no live requests',{timeout:120_000},async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-benchmark-development-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const run=spawnSync(process.execPath,[script,'--mode','technical','--set','development','--output',directory],{encoding:'utf8',timeout:110_000});assert.equal(run.status,0,run.stderr||run.stdout);
 const report=JSON.parse(await readFile(join(directory,'report.json'),'utf8'));assert.equal(report.mode,'technical');assert.equal(report.fixtureSet,'synthetic-development-v1');assert.equal(report.fixtureCount,20);assert.equal(report.results.length,20);assert.equal(report.requestCount,0);assert.equal(report.usage.reportedEvents,0);assert.equal(report.results.every(result=>result.sourceLanguage&&result.documentFamily&&result.targetLanguage==='Deutsch'&&Array.isArray(result.layoutIssues)),true);
});

test('provided-results mode grades supplied fictional results without provider calls',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-benchmark-provided-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const fixtures=JSON.parse(await readFile(new URL('../benchmarks/cases.json',import.meta.url),'utf8')),input=join(directory,'results.json'),output=join(directory,'report');await (await import('node:fs/promises')).writeFile(input,JSON.stringify(fixtures.map(fixture=>({id:fixture.id,text:fixture.reference,regions:Array(fixture.expected.regions).fill({})}))));
 const run=spawnSync(process.execPath,[script,'--mode','provided-results','--results',input,'--output',output],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 const report=JSON.parse(await readFile(join(output,'report.json'),'utf8'));assert.equal(report.mode,'provided-results');assert.equal(report.requestCount,0);assert.equal(report.results[0].score,100);assert.equal(report.results[0].usage,null);
});

test('provided-results mode rejects duplicate, unknown, and missing case IDs before writing a report',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-benchmark-invalid-results-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const fixtures=JSON.parse(await readFile(new URL('../benchmarks/cases.json',import.meta.url),'utf8'));
 const valid=fixtures.map(fixture=>({id:fixture.id,text:fixture.reference,regions:Array(fixture.expected.regions).fill({})}));
 const cases=[
  {results:[...valid,valid[0]],message:/doppelte Fall-ID/},
  {results:[...valid,{id:'not-a-fixture',text:'unknown'}],message:/unbekannte Fall-ID/},
  {results:valid.slice(1),message:/fehlt für 1 ausgewählte Fälle/},
 ];
 for(let index=0;index<cases.length;index++){
  const input=join(directory,`invalid-${index}.json`),output=join(directory,`report-${index}`);
  await (await import('node:fs/promises')).writeFile(input,JSON.stringify(cases[index].results));
  const run=spawnSync(process.execPath,[script,'--mode','provided-results','--results',input,'--output',output],{encoding:'utf8'});
  assert.notEqual(run.status,0);assert.match(run.stderr,cases[index].message);await assert.rejects(readFile(join(output,'report.json')));
 }
});

test('live benchmark refuses to run without an explicit bounded fixture count',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-benchmark-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const run=spawnSync(process.execPath,[script,'--live','--model','fictional-model','--output',directory],{encoding:'utf8'});
 assert.notEqual(run.status,0);assert.match(run.stderr,/--max-cases zwischen 1 und 3/);assert.doesNotMatch(run.stderr,/api\.openai\.com|authorization/i);
});
