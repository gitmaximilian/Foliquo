import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
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
 const report=JSON.parse(await readFile(join(directory,'report.json'),'utf8'));assert.equal(report.mode,'technical');assert.equal(report.fixtureSet,'synthetic-development-v1');assert.equal(report.fixtureCount,20);assert.equal(report.results.length,20);assert.equal(report.requestCount,0);assert.equal(report.usage.reportedEvents,0);assert.equal(report.results.every(result=>result.sourceLanguage&&result.documentFamily&&result.targetLanguage==='Deutsch'&&Array.isArray(result.layoutIssues)),true);assert.equal(report.technicalSummary.overall.caseCount,20);assert.equal(report.technicalSummary.byDocumentFamily.reduce((sum,group)=>sum+group.caseCount,0),20);assert.equal(report.technicalSummary.byLanguagePair.reduce((sum,group)=>sum+group.caseCount,0),20);assert.match(report.technicalSummary.interpretation,/not human translation quality/i);
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

test('private custom fixtures require a version and the local review form needs an explicit source-text opt-in',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-benchmark-custom-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const [fixture]=JSON.parse(await readFile(new URL('../benchmarks/cases.json',import.meta.url),'utf8'));
 const fixturePath=join(directory,'private-fixtures.json'),resultsPath=join(directory,'private-results.json');
 const privateFixture={...fixture,id:'private-case-1',source:'<script>window.neverRun=true</script>',documentType:'fictional-certificate',sourceLanguage:'English',targetLanguage:'German'};
 await writeFile(fixturePath,JSON.stringify([privateFixture]));await writeFile(resultsPath,JSON.stringify([{id:privateFixture.id,text:'<img src=x onerror=alert(1)> Private translation'}]));
 const common=['--fixtures',fixturePath,'--fixture-set-version','private-acceptance-v1','--mode','provided-results','--results',resultsPath];
 const missingOptIn=spawnSync(process.execPath,[script,...common,'--review-form','--output',join(directory,'blocked')],{encoding:'utf8'});assert.notEqual(missingOptIn.status,0);assert.match(missingOptIn.stderr,/--include-source-text ausdrücklich/);
 const output=join(directory,'local-review'),run=spawnSync(process.execPath,[script,...common,'--review-form','--include-source-text','--output',output],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 const report=JSON.parse(await readFile(join(output,'report.json'),'utf8')),form=await readFile(join(output,'human-review-form.html'),'utf8');
 assert.equal(report.fixtureSet,'private-acceptance-v1');assert.equal(report.fixtureCount,1);assert.equal(report.requestCount,0);assert.match(form,/I am qualified to assess/);assert.match(form,/independenceSelfAttested/);assert.match(form,/reworkMinutes/);assert.match(form,/Download local ratings JSON/);assert.match(form,/\\u003cscript\\u003e/);assert.match(form,/\\u003cimg/);assert.doesNotMatch(form,/<script>window\.neverRun/);assert.doesNotMatch(form,/https?:\/\//);
});

test('custom fixture versions and custom fixture selection are validated before output creation',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-benchmark-custom-invalid-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const fixturePath=join(directory,'fixtures.json'),output=join(directory,'output');await writeFile(fixturePath,JSON.stringify([{id:'one',source:'fake',expected:{}}]));
 const missingVersion=spawnSync(process.execPath,[script,'--fixtures',fixturePath,'--output',output],{encoding:'utf8'});assert.notEqual(missingVersion.status,0);assert.match(missingVersion.stderr,/müssen gemeinsam verwendet werden/);
 const badVersion=spawnSync(process.execPath,[script,'--fixtures',fixturePath,'--fixture-set-version','../leak','--output',output],{encoding:'utf8'});assert.notEqual(badVersion.status,0);assert.match(badVersion.stderr,/fixture-set-version darf/);
 const mixed=spawnSync(process.execPath,[script,'--fixtures',fixturePath,'--fixture-set-version','private-v1','--set','smoke','--output',output],{encoding:'utf8'});assert.notEqual(mixed.status,0);assert.match(mixed.stderr,/kann nicht mit --set kombiniert werden/);
 await assert.rejects(readFile(join(output,'report.json')));
});

test('live benchmark refuses to run without an explicit bounded fixture count',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-benchmark-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const run=spawnSync(process.execPath,[script,'--live','--model','fictional-model','--output',directory],{encoding:'utf8'});
 assert.notEqual(run.status,0);assert.match(run.stderr,/--max-cases zwischen 1 und 3/);assert.doesNotMatch(run.stderr,/api\.openai\.com|authorization/i);
});
