import {createHash} from 'node:crypto';
import {normalizeRuleDefinition,normalizeRuleEffect,normalizeRuleScope,ruleFingerprint,validateRuleLibrary} from './personal-rules.mjs';
import {normalizeGlossaryEntry} from './glossary.mjs';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,24);
const managedLayout=['lineHeight','margin','titleAlign','pageNumbers','tableLabelWidth','paragraphSpacing','keepRows'];

/** Only existing approved/effective data is migrated. New observations still
 * require the normal visible review, never a model-controlled activation. */
export function approvedSampleDefinitions(original){
 const entry=original.pendingEdit?{...original,...original.pendingEdit,analysis:{...original.analysis,...original.pendingEdit.analysis},status:'active'}:original;
 if(!['active',undefined].includes(entry.status))return [];
 const version=entry.analysis?.profileVersion||entry.version||1;
 const scope=normalizeRuleScope({sourceLanguage:entry.analysis?.sourceLanguage||entry.sourceLanguage||'',targetLanguage:entry.targetLanguage||'',documentType:entry.documentType||''});
 const origin={kind:'sample',id:entry.id,version,method:'legacy-approved'},definitions=[];
 const add=(effect,pages=[],method='legacy-approved')=>{
  const definition=normalizeRuleDefinition({title:effect.kind==='layout'?`${effect.key}: ${effect.value}`:effect.kind==='style'?effect.text.slice(0,120):'Field order',effect,scope,origins:[{...origin,method,...(pages.length?{pages}: {})}],profileIds:[entry.id],independent:false});
  if(!definitions.some(item=>ruleFingerprint(item)===ruleFingerprint(definition)))definitions.push(definition);
 };
 for(const text of entry.rules||[])add({kind:'style',text});
 for(const observation of entry.analysis?.observations||[])if(observation.approved===true)add({kind:'style',text:observation.text},observation.pages||[],['observed','inferred','uncertain'].includes(observation.certainty)?observation.certainty:'legacy-approved');
 if(entry.fieldLabels?.length)add({kind:'fieldOrder',labels:entry.fieldLabels});
 if(entry.layoutApproved!==false)for(const key of managedLayout)if(entry.layout?.[key]!==undefined)add(normalizeRuleEffect({kind:'layout',key,value:entry.layout[key]}));
 return definitions;
}

export function synchronizeSampleRules(data,{now=Date.now()}={}){
 const rules=structuredClone(data.personalRules||[]),glossary=structuredClone(data.glossary||[]);let changed=false;
 for(const entry of data.learning||[]){
  if(!['active',undefined].includes(entry.status)&&!entry.pendingEdit)continue;
  const definitions=approvedSampleDefinitions(entry);
  const sample=entry.pendingEdit?{...entry,...entry.pendingEdit,analysis:{...entry.analysis,...entry.pendingEdit.analysis}}:entry;
  const version=sample.analysis?.profileVersion||sample.version||1;
  const scope=normalizeRuleScope({sourceLanguage:sample.analysis?.sourceLanguage||sample.sourceLanguage||'',targetLanguage:sample.targetLanguage||'',documentType:sample.documentType||''});
  for(const term of sample.analysis?.terminology||[]){
   if(term.approved!==true)continue;
   const id=`sample-term-${hash({scope,source:term.source,target:term.target})}`;
   if(!glossary.some(item=>item.id===id)){
    glossary.push(normalizeGlossaryEntry({id,name:term.source,source:term.source,target:term.target,note:term.note||'',sourceLanguage:sample.analysis?.sourceLanguage||sample.sourceLanguage||'any',targetLanguage:sample.targetLanguage||'Deutsch',documentType:sample.documentType||'any',scope:'global',ruleManaged:true,createdAt:now,updatedAt:now}));changed=true;
   }
   definitions.push(normalizeRuleDefinition({title:`${term.source} → ${term.target}`.slice(0,120),effect:{kind:'terminology',glossaryId:id},scope,origins:[{kind:'sample',id:entry.id,version,method:'legacy-approved',pages:term.pages||[]}],profileIds:[entry.id],independent:false}));
  }
  const wanted=new Set(definitions.map(ruleFingerprint));
  for(const rule of rules)if(rule.profileIds.includes(entry.id)&&!wanted.has(ruleFingerprint(rule))&&!(rule.sourceBindings||[]).some(binding=>binding.profileId===entry.id&&wanted.has(binding.fingerprint))){rule.profileIds=rule.profileIds.filter(id=>id!==entry.id);rule.version++;rule.updatedAt=now;changed=true;}
  for(const definition of definitions){
   const fingerprint=ruleFingerprint(definition);let rule=rules.find(item=>(item.sourceBindings||[]).some(binding=>binding.profileId===entry.id&&binding.fingerprint===fingerprint))||rules.find(item=>ruleFingerprint(item)===fingerprint);
   if(!rule){
    const explicit=Boolean(sample.analysis?.approvedAt||sample.analysis?.profileVersion);
    rule={id:`sample-rule-${hash({fingerprint,profileId:entry.id})}`,...definition,sourceBindings:[{profileId:entry.id,fingerprint}],status:'active',version:1,createdAt:now,updatedAt:now,approvedAt:explicit?sample.analysis.approvedAt||sample.updatedAt||sample.createdAt||0:0,approvalMode:explicit?'explicit':'legacy-effective'};rules.push(rule);changed=true;
   }else{
    const origins=rule.origins.filter(origin=>!(origin.kind==='sample'&&origin.id===entry.id));origins.push(...definition.origins);origins.sort((a,b)=>`${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
    const profiles=[...new Set([...rule.profileIds,entry.id])].sort();
    const bindings=(rule.sourceBindings||[]).filter(binding=>binding.profileId!==entry.id);bindings.push({profileId:entry.id,fingerprint});bindings.sort((a,b)=>a.profileId.localeCompare(b.profileId));
    if(JSON.stringify(origins)!==JSON.stringify(rule.origins)||JSON.stringify(profiles)!==JSON.stringify(rule.profileIds)||JSON.stringify(bindings)!==JSON.stringify(rule.sourceBindings)){rule.origins=origins;rule.profileIds=profiles;rule.sourceBindings=bindings;rule.version++;rule.updatedAt=now;changed=true;}
   }
   // Explicitly inactive/deleted records retain that decision on re-analysis.
  }

 }
 validateRuleLibrary({personalRules:rules,ruleProposals:data.ruleProposals||[]});
 if(glossary.length>10000)throw new Error('The glossary is full; sample migration was not applied.');
 if(changed){data.personalRules=rules;data.glossary=glossary;data.ruleLibraryVersion=(data.ruleLibraryVersion||1)+1;}
 data.sampleRulesVersion=1;return {changed,ruleCount:rules.length};
}

/** Capture execution-relevant sample data without duplicating document bytes. */
export function sampleRuleState(entries=[]){
 return entries.map(entry=>{
  const select=value=>Object.fromEntries(['id','status','active','version','documentType','sourceLanguage','targetLanguage','rules','fieldLabels','layout','layoutApproved','createdAt','updatedAt'].filter(key=>value[key]!==undefined).map(key=>[key,structuredClone(value[key])]));
  const analysis=value=>Object.fromEntries(['profileVersion','approvedAt','sourceLanguage','observations','terminology'].filter(key=>value?.[key]!==undefined).map(key=>[key,structuredClone(value[key])]));
  return {...select(entry),analysis:analysis(entry.analysis),...(entry.pendingEdit?{pendingEdit:{...select(entry.pendingEdit),analysis:analysis(entry.pendingEdit.analysis)}}:{})};
 });
}
