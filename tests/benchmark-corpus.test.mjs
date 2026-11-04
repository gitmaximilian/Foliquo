import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateAcceptanceCorpus} from '../lib/benchmark-corpus.mjs';

const script=fileURLToPath(new URL('../scripts/validate-acceptance-corpus.mjs',import.meta.url));
const pairs=[['ar','de',35],['en','de',25],['de','en',10],['de','ar',10],['fr','de',5],['tr','de',5],['es','de',5],['it','de',5]],families=['driving licence','birth certificate','passport','diploma','form','letter','long table'];
function acceptanceCorpus(){
 const items=[];let index=0;
 for(const [sourceLanguage,targetLanguage,count] of pairs)for(let row=0;row<count;row++,index++)items.push({id:`case-${index+1}`,documentType:families[index%families.length],sourceLanguage,targetLanguage,difficulty:['easy','medium','hard'][index%3],source:`Fictional source record ${index+1} with isolated test tokens alpha${index} beta${index} gamma${index} delta${index} epsilon${index} zeta${index} eta${index} theta${index} iota${index} kappa${index} lambda${index} mu${index} nu${index} xi${index} omicron${index} pi${index} rho${index} sigma${index} tau${index} omega${index}.`,expected:{names:[],dates:[],numbers:[],content:[],regions:0,pageCount:1,sourceBlocks:[{id:`block-${index+1}`,kind:'paragraph',critical:true}],questions:[],terminology:[],structure:{}},goldStandard:{provenance:'Fictional validator test only; not a real gold standard.',reviewMethod:'Synthetic schema fixture; no human assessment occurred.',reviewers:[{code:'synthetic-test-reviewer',qualification:'Synthetic test metadata only.',reviewDate:'2026-10-31'}]}});
 return items;
}

test('acceptance corpus validator checks planned 100-case language matrix and family coverage',async t=>{
 const corpus=acceptanceCorpus(),report=validateAcceptanceCorpus(corpus);assert.equal(report.valid,true,report.errors.join('\n'));assert.equal(report.caseCount,100);assert.deepEqual(report.languagePairs,{'ar→de':35,'de→ar':10,'de→en':10,'en→de':25,'es→de':5,'fr→de':5,'it→de':5,'tr→de':5});assert.equal(Object.keys(report.documentFamilies).length,7);assert.equal(report.duplicateChecks.nearDuplicatePairs,0);assert.match(report.evidenceNote,/not independently verified/);
 const directory=await mkdtemp(join(tmpdir(),'foliquo-acceptance-audit-valid-'));t.after(()=>rm(directory,{recursive:true,force:true}));const path=join(directory,'private.json');await writeFile(path,JSON.stringify(corpus));const run=spawnSync(process.execPath,[script,'--fixtures',path,'--version','fictional-protocol-test-v1'],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);const cliReport=JSON.parse(run.stdout);assert.equal(cliReport.valid,true);assert.equal(cliReport.version,'fictional-protocol-test-v1');assert.doesNotMatch(run.stdout,/Fictional source record/);
});

test('acceptance corpus validator detects exact copies, near copies, and training overlap without returning source text',async()=>{
 const corpus=acceptanceCorpus(),fixtureText=`Distinct private source sentinel ${Array.from({length:50},(_,index)=>`token${index}`).join(' ')} endingomega`;corpus[0].source=fixtureText;corpus[1].source=corpus[0].source.replace('endingomega','otheromega');corpus[2].source=corpus[0].source;
 const development=[{id:'dev',source:fixtureText}],report=validateAcceptanceCorpus(corpus,{development});assert.equal(report.valid,false);assert.equal(report.duplicateChecks.withinCorpusExact,1);assert.equal(report.duplicateChecks.trainingOverlapExact,2);assert.equal(report.duplicateChecks.nearDuplicatePairs,3);assert.doesNotMatch(JSON.stringify(report),/Distinct private source sentinel/);
 const directory=await mkdtemp(join(tmpdir(),'foliquo-acceptance-audit-'));try{const path=join(directory,'private.json');await writeFile(path,JSON.stringify(corpus));const run=spawnSync(process.execPath,[script,'--fixtures',path,'--version','acceptance-private-v1'],{encoding:'utf8'});assert.notEqual(run.status,0);assert.doesNotMatch(run.stdout,/Distinct private source sentinel/);assert.doesNotMatch(run.stderr,/Distinct private source sentinel/);}finally{await rm(directory,{recursive:true,force:true});}
});

test('acceptance corpus validator requires per-case difficulty, structured gold fields, and review provenance',()=>{
 const corpus=acceptanceCorpus();delete corpus[0].difficulty;delete corpus[0].expected.pageCount;corpus[0].goldStandard.reviewers=[];delete corpus[0].goldStandard.provenance;
 const report=validateAcceptanceCorpus(corpus);assert.equal(report.valid,false);assert.ok(report.errors.some(error=>error.includes('difficulty')));assert.ok(report.errors.some(error=>error.includes('expected.pageCount')));assert.ok(report.errors.some(error=>error.includes('goldStandard.provenance')));assert.ok(report.errors.some(error=>error.includes('goldStandard.reviewers')));
});

test('acceptance corpus validator requires all 100 language-pair counts',()=>{
 const corpus=acceptanceCorpus().slice(1),report=validateAcceptanceCorpus(corpus);assert.equal(report.valid,false);assert.ok(report.errors.some(error=>error.includes('exactly 100')));assert.ok(report.errors.some(error=>error.includes('Language matrix ar→de: expected 35, found 34')));
});
