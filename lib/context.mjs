import {createHash} from 'node:crypto';
import {learningContext} from './learning.mjs';
import {referenceLineHashes} from './memory.mjs';
import {eligibleGlossaryCandidates,selectGlossary} from './glossary.mjs';

const plain=value=>value&&typeof value==='object'&&!Array.isArray(value);
const safeText=(value,max)=>typeof value==='string'?value.slice(0,max):'';
const safeList=(value,count,length)=>Array.isArray(value)?value.filter(item=>typeof item==='string').slice(0,count).map(item=>safeText(item,length)):[];

function learningUsageSummary(value){
 const count=value=>Number.isSafeInteger(value)&&value>=0?value:0,versions={};
 for(const [version,metrics]of Object.entries(value?.versions||{}).slice(-20)){
  const ruleEvents={};for(const [id,rule]of Object.entries(metrics.ruleEvents||{}).slice(-500))if(/^rule-[a-f0-9]{24}$/.test(id))ruleEvents[id]={explicitHelpful:count(rule.explicitHelpful),explicitRejected:count(rule.explicitRejected)};
  versions[version]={explicitHelpful:count(metrics.explicitHelpful),explicitRejected:count(metrics.explicitRejected),ruleEvents};
 }
 return {versions};
}

function structureOf(entry){
 if(plain(entry?.structure)){
  const safeMetrics=value=>{const result={};for(const key of ['lineCount','paragraphCount','blankLines','tableLikeRows','fieldLikeRows','listItems','averageWordsPerLine'])if(Number.isFinite(value?.[key]))result[key]=Math.max(0,Math.min(100000,Math.round(value[key])));return result;};
  return {documentType:safeText(entry.structure.documentType||entry?.documentType,120),targetLanguage:safeText(entry.structure.targetLanguage||entry?.targetLanguage,50),source:safeMetrics(entry.structure.source),translation:safeMetrics(entry.structure.translation)};
 }
 const measure=value=>{
  const lines=String(value||'').split(/\r?\n/),nonempty=lines.filter(line=>line.trim()),separators=nonempty.filter(line=>/[|\t]{1,}/.test(line)).length,fieldLike=nonempty.filter(line=>/^\s*[^:|]{1,80}\s*[:|]\s*\S/.test(line)).length,bullets=nonempty.filter(line=>/^\s*(?:[-*•]|\d+[.)])\s+/.test(line)).length;
  return {lineCount:lines.length,paragraphCount:nonempty.length,blankLines:lines.length-nonempty.length,tableLikeRows:separators,fieldLikeRows:fieldLike,listItems:bullets,averageWordsPerLine:nonempty.length?Math.round(nonempty.reduce((n,line)=>n+line.trim().split(/\s+/).length,0)/nonempty.length):0};
 };
 return {documentType:safeText(entry?.documentType,120),targetLanguage:safeText(entry?.targetLanguage,50),source:measure(entry?.sourceText),translation:measure(entry?.translation)};
}

function pinExamples(examples){
 return (Array.isArray(examples)?examples:[]).slice(0,2).map(entry=>({id:safeText(entry.id,80),name:safeText(entry.name,120),templateId:safeText(entry.templateId,80),documentType:safeText(entry.documentType,120),targetLanguage:safeText(entry.targetLanguage,50),structure:structureOf(entry)}));
}

function learningCandidates(entries=[]){
 return (Array.isArray(entries)?entries:[]).filter(entry=>plain(entry)&&entry.active&&(entry.status==='active'||entry.status===undefined)).slice(0,60).map(entry=>{
  const analysis=plain(entry.analysis)?entry.analysis:{};
  const layout=plain(entry.layout)?Object.fromEntries(['font','fontSize','lineHeight','margin','titleAlign','pageNumbers','includeOriginals','tableLabelWidth','paragraphSpacing','keepRows'].filter(key=>entry.layout[key]!==undefined).map(key=>[key,entry.layout[key]])):null;
  return {
   id:safeText(entry.id,80),name:safeText(entry.name,120),documentType:safeText(entry.documentType,120),targetLanguage:safeText(entry.targetLanguage,50),sourceLanguage:safeText(entry.sourceLanguage,50),
   active:true,status:entry.status==='active'?'active':undefined,updatedAt:Number.isFinite(entry.updatedAt)?entry.updatedAt:null,createdAt:Number.isFinite(entry.createdAt)?entry.createdAt:null,version:Number.isSafeInteger(entry.version)&&entry.version>0?entry.version:1,
   rules:safeList(entry.rules,12,500),fieldLabels:safeList(entry.fieldLabels,40,120),layout,layoutApproved:entry.layoutApproved!==false,learningUsage:learningUsageSummary(entry.learningUsage),
   analysis:{sourceLanguage:safeText(analysis.sourceLanguage,50),fieldLabels:safeList(analysis.fieldLabels,40,120),profileVersion:Number.isSafeInteger(analysis.profileVersion)&&analysis.profileVersion>0?analysis.profileVersion:1,
    observations:(Array.isArray(analysis.observations)?analysis.observations:[]).filter(item=>plain(item)).slice(0,40).map(item=>({id:safeText(item.id,80),category:safeText(item.category,40),text:safeText(item.text,500),scope:safeText(item.scope,80),pages:Array.isArray(item.pages)?item.pages.filter(Number.isInteger).slice(0,50):[],approved:item.approved===true})),
    terminology:(Array.isArray(analysis.terminology)?analysis.terminology:[]).filter(item=>plain(item)).slice(0,40).map(item=>({id:safeText(item.id,80),source:safeText(item.source,300),target:safeText(item.target,300),note:safeText(item.note,300),pages:Array.isArray(item.pages)?item.pages.filter(Number.isInteger).slice(0,50):[],approved:item.approved===true}))}
  };
 });
}

function frozenBaseContext(workspace,meta,jobId,owner){
 const stored=workspace?.context(meta,jobId)||{template:null,profile:null,layout:null,terms:[],examples:[]};
 const glossaryCandidates=eligibleGlossaryCandidates(workspace?.data.glossary||[],{...meta,profileId:stored.profile?.id||meta.profileId||''},jobId);
 const selectedExamples=pinExamples(stored.examples);
 const dossier=meta.dossierId?workspace?.data.dossiers.find(item=>item.id===meta.dossierId&&item.owner===owner):null;
 if(meta.dossierId&&!dossier)throw new Error('Dossier nicht gefunden.');
 return {
  template:stored.template?structuredClone(stored.template):null,
  profile:stored.profile?structuredClone(stored.profile):null,
  layout:stored.layout?structuredClone(stored.layout):null,
  terms:(stored.terms||[]).map(term=>structuredClone(term)),
  glossaryConflicts:(stored.glossaryConflicts||[]).map(conflict=>structuredClone(conflict)),
  glossaryCandidates,
  examples:selectedExamples,
  referenceFingerprints:workspace?.key?selectedExamples.map(example=>{const source=stored.examples.find(item=>item.id===example.id);return {id:example.id,hashes:referenceLineHashes(source?.translation,workspace.key)};}):[],
  dossierId:dossier?.id||'',dossierVersion:dossier?.version||1,
  dossierFacts:(dossier?.facts||[]).filter(fact=>fact.confirmed===true).map(({id,key,label,value,version,updatedAt})=>({id,key,label,value,version:version||1,updatedAt,confirmed:true}))
 };
}

export function createContextLibrarySnapshot(workspace,meta={},jobId=meta.jobId||'',owner=null,{now=Date.now()}={}){
 const base=frozenBaseContext(workspace,meta,jobId,owner);
 const learning=meta.useLearning===false?[]:learningCandidates(workspace?.data.learning);
 return {schema:1,createdAt:now,base,learning};
}

export function resolveContextSnapshot(snapshot,meta={}){
 if(!plain(snapshot)||snapshot.schema!==1||!plain(snapshot.base))throw new Error('Der gespeicherte Übersetzungskontext ist ungültig.');
 const {glossaryCandidates,...stored}=snapshot.base,selectedGlossary=selectGlossary(Array.isArray(glossaryCandidates)?glossaryCandidates:stored.terms||[],meta,meta.jobId||'');
 const learned=learningContext(snapshot.learning||[],{...meta,asOf:snapshot.createdAt,templateFields:stored.template?.fields||[],profileFields:stored.profile?.fields||[]});
 const glossaryTerms=selectedGlossary.terms||[];
 const learnedTerms=(learned.terms||[]).filter(term=>!glossaryTerms.some(saved=>saved.source.trim().toLocaleLowerCase()===term.source.trim().toLocaleLowerCase()));
 const context={...structuredClone(stored),...learned,terms:[...glossaryTerms,...learnedTerms],glossaryConflicts:selectedGlossary.conflicts||[],examples:structuredClone(stored.examples||[]),layout:stored.layout?{...learned.layout,...stored.layout}:learned.layout||null};
 const versionSource={createdAt:snapshot.createdAt,selection:{documentType:meta.documentType||'',sourceLanguage:meta.sourceLanguage||'',targetLanguage:meta.targetLanguage||'',useLearning:meta.useLearning!==false,templateId:meta.templateId||'',profileId:meta.profileId||'',referenceIds:meta.referenceIds||[],dossierId:meta.dossierId||''},context};
 context.contextVersion=createHash('sha256').update(JSON.stringify(versionSource)).digest('hex').slice(0,32);
 context.contextPinnedAt=snapshot.createdAt;
 return context;
}

export function referenceStructure(entry){return structureOf(entry);}
