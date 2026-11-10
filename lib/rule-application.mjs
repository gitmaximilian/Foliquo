import {randomUUID} from 'node:crypto';
import {createContextLibrarySnapshot,resolveContextSnapshot} from './context.mjs';
import {personalRuleQuestions} from './rule-questions.mjs';
import {reviewState} from './reviews.mjs';
import {proposeRevision} from './revisions.mjs';

function ready(job,version){const r=reviewState(job);if(r.version!==version||r.busy||r.proposal||r.hasQuestions||r.segmentedRevision||r.ruleApplication)throw new Error('Finish or discard the current revision before applying new rules.');return r;}
export function createRuleApplicationPreview(workspace,job,version){
 const r=ready(job,version),old=job.result.context||{},meta={...old,sourceLanguage:job.result.detected?.sourceLanguage||old.sourceLanguage,documentType:job.result.detected?.documentType||old.documentType,targetLanguage:job.targetLanguage||old.targetLanguage,jobId:job.id,clarifications:[],excludedRuleIds:[],ruleLayoutOverrides:{}};
 const safeMeta={...meta};for(const [key,collection]of [['templateId','templates'],['profileId','profiles']])if(safeMeta[key]&&!workspace.data[collection]?.some(item=>item.id===safeMeta[key]&&item.confirmed))safeMeta[key]='';const selectedDossier=workspace.data.dossiers?.find(item=>item.id===safeMeta.dossierId&&item.owner===job.owner);if(safeMeta.dossierId&&(!selectedDossier||safeMeta.dossierEntityId&&!selectedDossier.entities?.some(entity=>entity.id===safeMeta.dossierEntityId))){safeMeta.dossierId='';safeMeta.dossierEntityId='';}
 const library=createContextLibrarySnapshot(workspace,safeMeta,job.id,job.owner);
 if(Object.hasOwn(old,'baseLayout'))library.base.layout=structuredClone(old.baseLayout);else if(meta.templateId&&!safeMeta.templateId||meta.profileId&&!safeMeta.profileId)library.base.layout=structuredClone(old.layout||null);
 if(old.template)library.base.template=structuredClone(old.template);if(old.profile)library.base.profile=structuredClone(old.profile);
 const context=resolveContextSnapshot(library,meta);
 r.rulePreview={id:randomUUID(),version,payload:{metadata:meta,contextLibrarySnapshot:library,contextSnapshot:context},questions:[]};return r.rulePreview;
}
export function resolveRuleApplicationPreview(job,input,glossaryQuestions){
 const r=reviewState(job),preview=r.rulePreview;if(!preview||preview.id!==input.previewId||preview.version!==r.version||input.version!==r.version||r.busy||r.proposal)throw new Error('Reload the current rule preview.');
 const answers=input.answers||[];if(!Array.isArray(answers)||answers.length>100||answers.some(answer=>!answer||typeof answer.context!=='string'||typeof answer.answer!=='string'||answer.answer.length>300||!preview.questions.some(question=>question.context===answer.context)))throw new Error('Invalid rule clarification.');
 const retained=new Map((preview.payload.metadata.clarifications||[]).map(answer=>[answer.context,answer]));for(const answer of answers)retained.set(answer.context,{context:answer.context,answer:answer.answer});preview.payload.metadata.clarifications=[...retained.values()];
 const checked=personalRuleQuestions(preview.payload,preview.payload.contextSnapshot);preview.payload.contextSnapshot=checked.context;
 preview.questions=[...checked.questions,...glossaryQuestions(preview.payload,checked.context)];return preview;
}
function linguistic(context={}){return {style:[...new Set(context.personalStyleRules||[])].sort(),order:context.personalFieldOrder||[],terms:(context.terms||[]).map(({source,target,allowedVariants})=>({source,target,allowedVariants:[...(allowedVariants||[])].sort()})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))};}
export function ruleApplicationNeedsProvider(before,after){return JSON.stringify(linguistic(before))!==JSON.stringify(linguistic(after));}
export function ruleApplicationContext(before,context){
 return {...before,...context,layout:{...context.layout},certificationConfirmed:false,contextVersions:{...before.contextVersions,rules:(context.appliedRules||[]).map(({id,version})=>({id,version})),glossary:(context.terms||[]).map(({id,version})=>({id,version:version||1})),learning:(context.appliedLearning||[]).map(({id,profileVersion})=>({id,version:profileVersion}))}};
}
export function ruleApplicationPreviewDTO(job,preview){const context=preview.payload.contextSnapshot;return {previewId:preview.id,version:preview.version,questions:preview.questions,appliedRules:(context.appliedRules||[]).map(rule=>({...rule,title:context.ruleResolution?.decisions.find(item=>item.id===rule.id)?.title||rule.id})),decisions:context.ruleResolution?.decisions||[],layout:context.layout,requiresProvider:ruleApplicationNeedsProvider(job.result.context,context)};}
export async function stageRuleLayoutApplication(job,context,rebuild,{version,requestId}){
 const r=reviewState(job);if(r.version!==version||r.busy||r.proposal||r.segmentedRevision||r.hasQuestions||typeof requestId!=='string'||!/^[-a-zA-Z0-9]{1,100}$/.test(requestId))throw new Error('Reload the completed translation before applying rules.');
 if(r.requests.includes(requestId))return;
 r.busy=true;try{const candidate=await rebuild(job.result.text,{...job.result,context:ruleApplicationContext(job.result.context,context)});if(!candidate.pdf||!candidate.word)throw new Error('Both exports are required.');proposeRevision(job,candidate);r.requests.push(requestId);r.requests=r.requests.slice(-20);delete r.rulePreview;}finally{r.busy=false;job.reviewBytes=Buffer.byteLength(JSON.stringify(r));}
}
