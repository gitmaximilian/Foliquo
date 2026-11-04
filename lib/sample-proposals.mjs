import {createHash} from 'node:crypto';
import {normalizeRuleDefinition,normalizeRuleEffect,normalizeRuleScope,ruleFingerprint,proposeRule,proposedGlossaryTerm,PROPOSAL_LIMIT} from './personal-rules.mjs';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const layoutTitles={lineHeight:'Line spacing',margin:'Page margins',paragraphSpacing:'Paragraph spacing',titleAlign:'Heading alignment',tableLabelWidth:'Field-label column width',keepRows:'Keep table rows together',pageNumbers:'Page numbers'};
const layoutKeys=['lineHeight','margin','paragraphSpacing','titleAlign','tableLabelWidth','keepRows','pageNumbers'];
const normalizeText=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function reusable(value,privateFacts=[]){
 if(typeof value!=='string'||!value.trim()||value.length>500||/[\u0000-\u001f]|\b\d{3,}\b|https?:\/\/|www\.|[\w.+-]+@[\w.-]+\./iu.test(value))return false;
 if(/(?:ignore|disregard).{0,50}(?:previous|system|instructions)|ignoriere.{0,50}(?:anweisung|system)|تجاهل.{0,40}(?:تعليمات|النظام)|system prompt|execute.{0,25}(?:code|command)|run.{0,20}shell/iu.test(value))return false;
 const normalized=normalizeText(value);return !privateFacts.some(fact=>{const secret=normalizeText(fact);return secret.length>=4?normalized.includes(secret):secret.length>=2&&` ${normalized} `.includes(` ${secret} `);});
}
function parsedKeys(value){return Object.keys(value||{}).flatMap(key=>{try{return [JSON.parse(key)];}catch{return [];}});}

/** Translate measured properties and cautious observations into the shared draft format. */
export function sampleProposalCandidates(entry){
 if(entry.canonicalRules!==true||entry.analysis?.complete!==true)return [];
 const analysis=entry.analysis,scope=normalizeRuleScope({sourceLanguage:analysis.sourceLanguage||'',targetLanguage:entry.targetLanguage||'',documentType:entry.documentType||''}),version=analysis.profileVersion||entry.version||1,items=[],seen=new Set(),secrets=entry.privateFacts||[];
 const add=(effect,{pages=[],method='inferred',glossaryDraft}={})=>{
  try{effect=normalizeRuleEffect(effect);}catch{return;}
  if(effect.kind==='style'&&!reusable(effect.text,secrets)||effect.kind==='fieldOrder'&&effect.labels.some(label=>!reusable(label,secrets)))return;
  const definition=normalizeRuleDefinition({title:effect.kind==='layout'?`${layoutTitles[effect.key]}: ${effect.value}`:effect.kind==='style'?effect.text.slice(0,120):effect.kind==='terminology'?`${glossaryDraft.source} → ${glossaryDraft.target}`.slice(0,120):'Field order',effect,scope,origins:[{kind:'sample',id:entry.id,version,method,...(pages.length?{pages:[...new Set(pages)].filter(page=>Number.isInteger(page)&&page>0&&page<=analysis.pageCount).slice(0,50)}:{})}],profileIds:[entry.id],independent:false});
  const fingerprint=ruleFingerprint(definition);if(seen.has(fingerprint))return;seen.add(fingerprint);items.push({definition,...(glossaryDraft?{glossaryDraft}:{}),fingerprint});
 };
 const measured=new Map(),measure=(key,value)=>{try{const effect=normalizeRuleEffect({kind:'layout',key,value});const values=measured.get(key)||new Map();values.set(JSON.stringify(effect.value),effect.value);measured.set(key,values);}catch{/* Unsupported observed properties stay descriptive. */}};
 const word=analysis.localInventory?.finishedTranslationDocx||analysis.localInventory?.docx;
 if(word){
  for(const format of parsedKeys(word.paragraphFormatCounts)){if(format.lineSpacing!==null&&format.lineSpacing!==undefined)measure('lineHeight',format.lineSpacing);if(format.spaceAfter!==null&&format.spaceAfter!==undefined)measure('paragraphSpacing',format.spaceAfter);}
  for(const section of word.sections||[]){const margins=Object.values(section.marginsMm||{}).filter(value=>typeof value==='number');if(margins.length===4&&Math.max(...margins)-Math.min(...margins)<0.1)measure('margin',Math.round(margins[0]*100)/100);}
  for(const pattern of parsedKeys(word.tablePatterns)){const columns=pattern.columnsMm;if(columns?.length===2&&columns.every(value=>Number.isFinite(value)&&value>0))measure('tableLabelWidth',Math.round(10000*columns[0]/(columns[0]+columns[1]))/100);}
  for(const style of word.styles||[])if(/^(?:title|heading ?1)$/iu.test(style.id||style.name||'')&&['left','center','right'].includes(style.alignment))measure('titleAlign',style.alignment);
 }
 for(const [key,values]of measured)for(const value of values.values())add({kind:'layout',key,value},{method:'measured'});
 // Each chunk value remains visible. Never use aggregate()'s median as a decision.
 const chunks=entry.analysisRun?.completedChunks||[];
 for(const chunk of chunks)for(const key of layoutKeys)if(!measured.has(key)&&chunk.value?.layout?.[key]!==undefined)add({kind:'layout',key,value:chunk.value.layout[key]},{pages:chunk.pages||[],method:'uncertain'});
 if(!chunks.length)for(const key of layoutKeys)if(!measured.has(key)&&analysis.layout?.[key]!==undefined)add({kind:'layout',key,value:analysis.layout[key]},{method:'uncertain'});
 for(const text of analysis.rules||entry.rules||[])add({kind:'style',text});
 for(const observation of analysis.observations||[]){
  if(observation.effect?.kind==='layout'&&measured.has(observation.effect.key))continue;
  if(observation.effect&&observation.effect.kind!=='terminology')add(observation.effect,{pages:observation.pages||[],method:observation.certainty||'uncertain'});
  else if(['language','translation','structure'].includes(observation.category))add({kind:'style',text:observation.text},{pages:observation.pages||[],method:observation.certainty||'uncertain'});
 }
 if(entry.fieldLabels?.length)add({kind:'fieldOrder',labels:entry.fieldLabels});
 for(const term of analysis.terminology||[])if(term.evidence==='parallel-source-target'&&scope.sourceLanguage&&scope.targetLanguage&&scope.sourceLanguage!==scope.targetLanguage&&term.pages?.length&&reusable(term.source,secrets)&&reusable(term.target,secrets)){
  const {id,pair}=proposedGlossaryTerm({source:term.source,target:term.target,note:term.note||''},scope);add({kind:'terminology',glossaryId:id},{glossaryDraft:pair,pages:term.pages,method:'inferred'});
 }
 return items;
}

export function synchronizeSampleProposals(data){
 data.sampleProposalHistory??=[];
 for(const entry of data.learning||[])if(entry.canonicalRules===true&&['pending_review','active'].includes(entry.status)&&!entry.pendingEdit){
  for(const candidate of sampleProposalCandidates(entry)){
   if(data.sampleProposalHistory.some(item=>item.profileId===entry.id&&item.fingerprint===candidate.fingerprint))continue;
   if(data.ruleProposals.length>=PROPOSAL_LIMIT||data.sampleProposalHistory.length>=30000)throw Object.assign(new Error('The proposal library is full. Clear reviewed proposal history, then resume the sample analysis.'),{code:'ERR_RULE_VALIDATION'});
   const id=`sample-proposal-${hash({profileId:entry.id,fingerprint:candidate.fingerprint}).slice(0,32)}`;
   if(!data.ruleProposals.some(item=>item.id===id))proposeRule(data,{operation:'create',definition:candidate.definition,...(candidate.glossaryDraft?{glossaryDraft:candidate.glossaryDraft}:{})},{id});
   data.sampleProposalHistory.push({profileId:entry.id,fingerprint:candidate.fingerprint,proposalId:id});
  }
 }
 return data;
}

export function sourceRuleImpact(data,id){
 return (data.personalRules||[]).filter(rule=>rule.status!=='deleted'&&rule.profileIds.includes(id)).map(rule=>({id:rule.id,title:rule.title,version:rule.version,status:rule.status,soleDependent:!rule.independent&&rule.profileIds.length===1}));
}
export function detachSampleRules(data,id,{choice,versions}={}){
 const affected=sourceRuleImpact(data,id);if(affected.some(rule=>rule.soleDependent)&&!['independent','deactivate'].includes(choice))throw Object.assign(new Error('Choose whether the source-dependent rules should remain independent or be deactivated.'),{code:'ERR_RULE_VALIDATION'});
 if(!Array.isArray(versions)||affected.some(rule=>!versions.some(item=>item.id===rule.id&&item.version===rule.version)))throw Object.assign(new Error('The source rules changed. Review their current versions before removing the sample.'),{code:'ERR_RULE_STALE'});
 const now=Date.now();for(const impact of affected){const rule=data.personalRules.find(rule=>rule.id===impact.id);rule.profileIds=rule.profileIds.filter(profileId=>profileId!==id);if(impact.soleDependent){if(choice==='independent')rule.independent=true;else rule.status='inactive';}rule.version++;rule.updatedAt=now;}
 for(const proposal of data.ruleProposals||[])if(proposal.status==='pending'&&proposal.definition?.profileIds.includes(id)&&!proposal.definition.independent){proposal.status='rejected';proposal.version++;proposal.updatedAt=now;}
 if(affected.length)data.ruleLibraryVersion++;
 // Origins retain only existing dataless IDs, versions and page references.
 data.sampleProposalHistory=(data.sampleProposalHistory||[]).filter(item=>item.profileId!==id);
 return {affected:affected.length};
}
