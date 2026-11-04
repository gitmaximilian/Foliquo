import {createHash} from 'node:crypto';
import {languageKey,documentTypeKey} from './context-keys.mjs';
import {normalizeRuleEffect,normalizeRuleScope,validateRuleLibrary} from './personal-rules.mjs';

const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function scopeState(scope,meta){
 let pending=false;
 for(const [key,value]of Object.entries(scope)){
  const actual=key.endsWith('Language')?languageKey(meta[key]):key==='documentType'?documentTypeKey(meta[key]):meta[key]||'';
  if(!actual){if(key==='profileId')return 'not_matching';pending=true;continue;}if(actual!==value)return 'not_matching';
 }
 return pending?'pending_scope':'candidate';
}
// A scope overrides another only if it includes all its conditions. Merely
// counting conditions would arbitrarily rank unrelated overlapping scopes.
function narrower(a,b){const entries=Object.entries(b);return Object.keys(a).length>entries.length&&entries.every(([key,value])=>a[key]===value);}
function resource(rule){const effect=rule.effect;return effect.kind==='layout'?`layout:${effect.key}`:effect.kind==='fieldOrder'?'fieldOrder':effect.kind==='terminology'?`terminology:${effect.glossaryId}`:`style:${effect.text.normalize('NFKC').trim()}`;}

export function resolvePersonalRules(rules=[],meta={},options={}){
 validateRuleLibrary({personalRules:rules});
 const excluded=new Set(options.excludedRuleIds||[]),profiles=new Set(options.activeProfileIds||[]),decisions=[],groups=new Map(),layoutPatch={},styleRules=[],glossaryRuleIds=[],appliedRules=[],conflicts=[];
 const jobLayout=options.layoutOverrides||{};
 for(const [key,value]of Object.entries(jobLayout))layoutPatch[key]=normalizeRuleEffect({kind:'layout',key,value}).value;
 for(const original of rules){
  const rule={...original,scope:normalizeRuleScope(original.scope),effect:normalizeRuleEffect(original.effect)};
  let state=rule.status==='active'?'candidate':rule.status;
  if(state==='candidate'&&excluded.has(rule.id))state='excluded';
  if(state==='candidate'&&!rule.independent&&(meta.useLearning===false||!rule.profileIds.some(id=>profiles.has(id))))state='profile_inactive';
  if(state==='candidate'&&!rule.independent&&options.selectedProfileIds&&!rule.profileIds.some(id=>options.selectedProfileIds.includes(id)))state='profile_not_selected';
  if(state==='candidate')state=scopeState(rule.scope,meta);
  const decision={id:rule.id,version:rule.version,title:rule.title,state,scope:rule.scope};decisions.push(decision);
  if(state!=='candidate')continue;
  if(rule.effect.kind==='layout'&&Object.hasOwn(jobLayout,rule.effect.key)){decision.state='overridden';decision.reason='job_override';continue;}
  const key=resource(rule),group=groups.get(key)||[];group.push({rule,decision});groups.set(key,group);
 }
 let fieldOrder=null;
 for(const [key,group]of groups){
  const finalists=group.filter(item=>!group.some(other=>narrower(other.rule.scope,item.rule.scope)));
  for(const item of group)if(!finalists.includes(item)){item.decision.state='overridden';item.decision.reason='more_specific_rule';item.decision.by=finalists.filter(other=>narrower(other.rule.scope,item.rule.scope)).map(other=>other.rule.id);}
  const values=finalists.map(item=>item.rule.effect);
  if(values.some(value=>!equal(value,values[0]))){
   const choices=finalists.map(({rule})=>({id:rule.id,version:rule.version,title:rule.title,effect:structuredClone(rule.effect)}));
   const id=createHash('sha256').update(JSON.stringify({key,choices:choices.slice().sort((a,b)=>a.id.localeCompare(b.id))})).digest('hex').slice(0,24);
   const chosen=finalists.find(item=>options.conflictDecisions?.[id]===item.rule.id);
   if(!chosen){conflicts.push({id,resource:key,choices});for(const item of finalists)item.decision.state='conflict';continue;}
   for(const item of finalists)if(item!==chosen){item.decision.state='overridden';item.decision.reason='job_choice';}
   finalists.splice(0,finalists.length,chosen);values.splice(0,values.length,chosen.rule.effect);
  }
  const effect=values[0];
  if(effect.kind==='layout')layoutPatch[effect.key]=effect.value;
  else if(effect.kind==='style')styleRules.push(effect.text);
  else if(effect.kind==='fieldOrder')fieldOrder=structuredClone(effect.labels);
  else glossaryRuleIds.push(effect.glossaryId);
  for(const {rule,decision}of finalists){decision.state='effective';appliedRules.push({id:rule.id,version:rule.version,effect:structuredClone(rule.effect)});}
 }
 return {layoutPatch,styleRules:[...new Set(styleRules)],fieldOrder,glossaryRuleIds:[...new Set(glossaryRuleIds)],appliedRules,decisions,conflicts,pending:decisions.some(item=>item.state==='pending_scope')};
}

export function createRuleSnapshot(data,{excludedRuleIds=[],layoutOverrides={}}={}){
 validateRuleLibrary(data);
 if(!Array.isArray(excludedRuleIds)||excludedRuleIds.length>1000||excludedRuleIds.some(id=>typeof id!=='string'||id.length>100))throw new Error('Invalid per-job rule exclusions.');
 const overrides={};for(const [key,value]of Object.entries(layoutOverrides))overrides[key]=normalizeRuleEffect({kind:'layout',key,value}).value;
 return {schema:1,libraryVersion:data.ruleLibraryVersion||1,rules:structuredClone(data.personalRules||[]),activeProfileIds:(data.learning||[]).filter(profile=>profile.active&&(profile.status===undefined||profile.status==='active')&&documentTypeKey(profile.documentType)&&languageKey(profile.targetLanguage)).map(profile=>profile.id),excludedRuleIds:[...new Set(excludedRuleIds)].sort(),layoutOverrides:overrides};
}
export function resolveRuleSnapshot(snapshot,meta={}){
 if(!snapshot||snapshot.schema!==1)throw new Error('Invalid personal rule snapshot.');
 return resolvePersonalRules(snapshot.rules,meta,snapshot);
}
