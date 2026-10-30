import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {gradeTranslation,regressions} from '../lib/benchmark.mjs';
import {createTranslationPDF,translationRequest,parseTranslation} from '../lib/documents.mjs';
import {createTranslationWord} from '../lib/word.mjs';
import {auditArtifacts} from '../lib/preflight.mjs';

const args=process.argv.slice(2),arg=name=>{const index=args.indexOf(name);return index<0?null:args[index+1];};
const outputDirectory=resolve(arg('--output')||'outputs/benchmark');
const fixtureSets={
 smoke:{file:'../benchmarks/cases.json',label:'offline-smoke-v1'},
 development:{file:'../benchmarks/development-cases.json',label:'synthetic-development-v1'},
};
const fixtureSet=arg('--set')||'smoke';
if(!fixtureSets[fixtureSet])throw new Error(`Unbekannter Fixture-Satz „${fixtureSet}“. Verfügbar: ${Object.keys(fixtureSets).join(', ')}.`);
const fixtureBytes=await readFile(new URL(fixtureSets[fixtureSet].file,import.meta.url));
const fixtures=JSON.parse(fixtureBytes.toString());
if(!Array.isArray(fixtures)||!fixtures.length||fixtures.some(item=>!item||typeof item.id!=='string'||typeof item.source!=='string'||!item.expected||typeof item.expected!=='object')||new Set(fixtures.map(item=>item.id)).size!==fixtures.length)throw new Error('Der Benchmark-Fixture-Satz ist ungültig oder enthält doppelte IDs.');
const requestedMode=arg('--mode');
if(requestedMode&&!['technical','provided-results','live'].includes(requestedMode))throw new Error('--mode muss technical, provided-results oder live sein.');
const mode=requestedMode||(args.includes('--live')?'live':arg('--results')?'provided-results':'technical');
if(args.includes('--live')&&mode!=='live'||arg('--results')&&mode!=='provided-results')throw new Error('--mode widerspricht --live oder --results.');
if(mode==='live'&&arg('--results'))throw new Error('Live-Modus kann nicht mit --results verwendet werden.');
if(mode==='provided-results'&&!arg('--results'))throw new Error('provided-results benötigt --results FILE.');
if(mode==='technical'&&(args.includes('--live')||arg('--results')))throw new Error('technical kann nicht mit --live oder --results kombiniert werden.');
let maxCases=null;
if(mode==='live'){
 const rawLimit=arg('--max-cases');maxCases=Number(rawLimit);
 if(!rawLimit||!Number.isInteger(maxCases)||maxCases<1||maxCases>fixtures.length)throw new Error(`live benötigt --max-cases zwischen 1 und ${fixtures.length}; jede Fixture löst einen Modellaufruf aus.`);
 if(!arg('--model'))throw new Error('live benötigt --model mit einer verfügbaren Modell-ID.');
}else if(arg('--max-cases'))throw new Error('--max-cases gilt nur für den live-Modus.');
const baselineReport=arg('--baseline')?JSON.parse(await readFile(resolve(arg('--baseline')),'utf8')):null;
if(baselineReport){
 const baselineMode=({ 'offline-reference-pipeline':'technical','live-model':'live' })[baselineReport.mode]||baselineReport.mode;
 if(baselineReport.fixtureSet!==fixtureSets[fixtureSet].label)throw new Error('--baseline muss denselben versionierten Fixture-Satz verwenden.');
 if(baselineMode!==mode)throw new Error('--baseline muss denselben Auswertungsmodus verwenden.');
 if(mode==='live'&&baselineReport.maxCases!==maxCases)throw new Error('--baseline muss dieselbe Live-Fallobergrenze verwenden.');
}
await mkdir(outputDirectory,{recursive:true});

const selectedFixtures=fixtures.slice(0,mode==='live'?maxCases:undefined);
let candidates=[],provider=null,modelId=null;
const requestMetadata=fixture=>({targetLanguage:fixture.targetLanguage||'Deutsch',sourceLanguage:fixture.sourceLanguage||'Automatisch',documentType:fixture.documentType||'',additionalInfo:fixture.additionalInfo||''});
const fingerprint=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)||value instanceof Uint8Array?value:JSON.stringify(value)).digest('hex');

if(mode==='provided-results')candidates=JSON.parse(await readFile(resolve(arg('--results')),'utf8'));
else if(mode==='live'){
 modelId=arg('--model');provider='chatgpt';
 const {ChatGPTConnection}=await import('../lib/chatgpt.mjs'),{ChatGPTProvider}=await import('../lib/providers.mjs');
 const connection=new ChatGPTConnection(new URL('../.local/',import.meta.url).pathname);await connection.init();
 const engine=new ChatGPTProvider(connection);if(!(await engine.models()).some(model=>model.id===modelId))throw new Error('Modell nicht verfügbar.');
 const {prepareDocuments}=await import('../lib/formats.mjs');
 for(const fixture of selectedFixtures){
  const files=[{name:`${fixture.id}.txt`,type:'text/plain',bytes:Buffer.from(fixture.source)}],documents=await prepareDocuments(files),metadata=requestMetadata(fixture);
  const request=translationRequest(modelId,documents,metadata),usage=[];
  const raw=await engine.respond(request,AbortSignal.timeout(300000),()=>{},(tokens,details)=>usage.push({tokens,complete:details?.complete===true,responseId:details?.responseId||null}));
  const parsed=parseTranslation(raw,metadata.targetLanguage);
  candidates.push({id:fixture.id,text:parsed.text||'',regions:parsed.rawRegions||[],requiresInput:parsed.requiresInput===true,questions:parsed.questions||[],requestFingerprint:fingerprint(request),promptFingerprint:fingerprint(request.instructions),usage});
 }
}else candidates=fixtures.map(fixture=>({id:fixture.id,text:fixture.reference,regions:Array(fixture.expected.regions||0).fill({})}));

if(!Array.isArray(candidates))throw new Error('Benchmark-Ergebnisse müssen eine JSON-Liste sein.');
const results=[];
for(const fixture of selectedFixtures){
 const candidate=candidates.find(result=>result?.id===fixture.id);
 if(!candidate)throw new Error(`Benchmark-Ergebnis fehlt: ${fixture.id}`);
 if(typeof candidate.text!=='string')throw new Error(`Benchmark-Ergebnis enthält keinen Text: ${fixture.id}`);
 if(candidate.text){
  const metadata={...requestMetadata(fixture),example:true};
  const pdf=await createTranslationPDF(candidate.text,[],metadata),word=createTranslationWord(candidate.text,metadata);
  candidate.preflight=await auditArtifacts({...candidate,pdf:pdf.toString('base64'),word:word.toString('base64'),context:metadata,previews:[]});
  await writeFile(join(outputDirectory,`${fixture.id}.pdf`),pdf);await writeFile(join(outputDirectory,`${fixture.id}.docx`),word);
 }
 const result=gradeTranslation(fixture,candidate);
 results.push({...result,documentFamily:fixture.documentType||null,sourceLanguage:fixture.sourceLanguage||null,targetLanguage:fixture.targetLanguage||'Deutsch',requiresInput:candidate.requiresInput===true,questionCount:Array.isArray(candidate.questions)?candidate.questions.length:0,sourceFingerprint:fingerprint({source:fixture.source,additionalInfo:fixture.additionalInfo||'',expected:fixture.expected}),requestFingerprint:candidate.requestFingerprint||null,promptFingerprint:candidate.promptFingerprint||null,usage:candidate.usage||null});
}

let sourceRevision=process.env.GITHUB_SHA||null,workingTreeDirty=null,trackedDiffFingerprint=null;
try{sourceRevision||=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();workingTreeDirty=Boolean(execFileSync('git',['status','--porcelain','--untracked-files=all'],{encoding:'utf8'}).trim());trackedDiffFingerprint=fingerprint(execFileSync('git',['diff','--binary','HEAD']));}catch{}
const baselineResults=Array.isArray(baselineReport?.results)?baselineReport.results:[];
const regressionsFound=regressions(results,baselineResults);
const usageReports=results.flatMap(result=>(result.usage||[]).filter(item=>item.tokens).map(item=>({fixtureId:result.id,...item.tokens,complete:item.complete,responseId:item.responseId})));
const report={
 mode,createdAt:new Date().toISOString(),sourceRevision,workingTreeDirty,trackedDiffFingerprint,provider,modelId,
 fixtureSet:fixtureSets[fixtureSet].label,fixtureSetVersion:fixtureSet,fixtureCount:results.length,
 maxCases:mode==='live'?maxCases:null,requestCount:mode==='live'?results.length:0,
 configuration:{targetLanguages:[...new Set(selectedFixtures.map(item=>item.targetLanguage||'Deutsch'))],exportFont:'Aptos',exportFontSizePt:11,sourcePagesPresent:false,sourcePageAppendix:'not-tested; text-only benchmark fixtures'},
 fingerprints:{fixtureSetSha256:fingerprint(fixtureBytes),translationPolicySha256:fingerprint(await readFile(new URL('../lib/translation-policy.mjs',import.meta.url))),exportPipelineSha256:fingerprint(Buffer.concat(await Promise.all(['../lib/documents.mjs','../lib/word.mjs','../lib/preflight.mjs'].map(path=>readFile(new URL(path,import.meta.url))))))},
 usage:{reportedEvents:usageReports.length,events:usageReports,apiCost:null,note:mode==='live'?'Tokenangaben werden nur aus tatsächlichen Anbieterereignissen übernommen. API-Kosten sind hier nicht anwendbar; unbekannte Verbrauchswerte bleiben unbekannt.':'Keine Live-Anbieteranfragen; kein Modellverbrauch.'},
 comparison:baselineReport?{baselineRevision:baselineReport.sourceRevision||null,baselineWorkingTreeDirty:baselineReport.workingTreeDirty??null,baselineTrackedDiffFingerprint:baselineReport.trackedDiffFingerprint||null,baselineFixtureSet:baselineReport.fixtureSet||null,matchedCases:results.filter(result=>baselineResults.some(old=>old.id===result.id)).length,metric:'synthetic expected-fact score only; not a human translation-quality comparison',regressions:regressionsFound}:null,
 note:mode==='technical'?'Deterministischer Referenz- und Exporttest mit fiktiven Fällen; keine gemessene KI-Qualität.':mode==='live'?'Begrenzter Modelllauf auf fiktiven Fixtures; vergleicht nur explizit erwartete Fakten, nicht vollständige Sprachqualität.':'Auswertung bereitgestellter Ergebnisse gegen fiktive Referenzen; fachliche Prüfung bleibt erforderlich.',
 results,regressions:regressionsFound,
};
await writeFile(join(outputDirectory,'report.json'),JSON.stringify(report,null,2));
const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
await writeFile(join(outputDirectory,'report.html'),`<!doctype html><meta charset="utf-8"><title>Foliquo Benchmark</title><style>body{font:16px system-ui;max-width:900px;margin:50px auto;padding:20px}pre{white-space:pre-wrap;background:#f5f4fa;padding:20px}</style><h1>Foliquo Benchmark</h1><p>${escape(report.note)}</p><pre>${escape(JSON.stringify(report,null,2))}</pre>`);
console.log(JSON.stringify({mode,fixtureSet:report.fixtureSet,cases:results.length,regressions:regressionsFound.length,requests:report.requestCount,report:join(outputDirectory,'report.json')}));
if(regressionsFound.length)process.exitCode=1;
