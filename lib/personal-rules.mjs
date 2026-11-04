import {createHash,randomUUID} from 'node:crypto';
import {languageKey,documentTypeKey} from './context-keys.mjs';

export const RULE_LIMIT=1000,PROPOSAL_LIMIT=500;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
function fail(message='Invalid personal rule.'){throw Object.assign(new Error(message),{code:'ERR_RULE_VALIDATION'});}
function text(value,max,empty=false){if(typeof value!=='string'||value.length>max||/[\0\u0001-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)||(!empty&&!value.trim()))fail();return value.trim();}
function keys(value,allowed){if(!plain(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail();}
const clone=value=>structuredClone(value);
function positive(value){if(!Number.isSafeInteger(value)||value<1)fail();return value;}
function timestamp(value){if(!Number.isSafeInteger(value)||value<0)fail();return value;}
export function normalizeRuleScope(value={}){
 keys(value,['sourceLanguage','targetLanguage','documentType','profileId']);
 const scope={};for(const key of ['sourceLanguage','targetLanguage','documentType','profileId'])if(value[key]!==undefined){const raw=text(value[key],120,true),v=key.endsWith('Language')?languageKey(raw):key==='documentType'?documentTypeKey(raw):raw;if(v)scope[key]=v;}
 return scope;
}
const numbers={lineHeight:[1,2],margin:[15,35],tableLabelWidth:[20,65],paragraphSpacing:[0,18]};
export function normalizeRuleEffect(value){
 if(!plain(value))fail();
 if(value.kind==='layout'){
  keys(value,['kind','key','value']);const key=value.key;let v=value.value;
  if(Object.hasOwn(numbers,key)){if(typeof v==='string'&&/^\d+(?:[.,]\d+)?$/.test(v))v=Number(v.replace(',','.'));const [min,max]=numbers[key];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail();}
  else if(key==='titleAlign'){if(!['left','center','right'].includes(v))fail();}
  else if(['keepRows','pageNumbers'].includes(key)){if(typeof v!=='boolean')fail();}
  else fail('This layout property is not configurable as a rule.');
  return {kind:'layout',key,value:v};
 }
 if(value.kind==='style'){keys(value,['kind','text']);return {kind:'style',text:text(value.text,500)};}
 if(value.kind==='fieldOrder'){keys(value,['kind','labels']);if(!Array.isArray(value.labels)||!value.labels.length||value.labels.length>40)fail();return {kind:'fieldOrder',labels:value.labels.map(label=>text(label,120))};}
 if(value.kind==='terminology'){keys(value,['kind','glossaryId']);return {kind:'terminology',glossaryId:text(value.glossaryId,100)};}
 fail();
}
export function normalizeRuleOrigin(value){
 keys(value,['kind','id','version','pages','method']);if(!['manual','chat','sample'].includes(value.kind))fail();
 const origin={kind:value.kind,id:text(value.id,100)};
 if(value.version!==undefined)origin.version=positive(value.version);
 if(value.pages!==undefined){if(!Array.isArray(value.pages)||value.pages.length>50||value.pages.some(p=>!Number.isSafeInteger(p)||p<1))fail();origin.pages=[...new Set(value.pages)].sort((a,b)=>a-b);}
 if(value.method!==undefined){if(!['measured','observed','inferred','uncertain','legacy-approved'].includes(value.method))fail();origin.method=value.method;}
 return origin;
}
export function normalizeRuleDefinition(value){
 keys(value,['title','effect','scope','origins','profileIds','independent']);
 if(!Array.isArray(value.origins)||!value.origins.length||value.origins.length>40)fail();
 const profileIds=value.profileIds??[];if(!Array.isArray(profileIds)||profileIds.length>60)fail();
 if(value.independent!==undefined&&typeof value.independent!=='boolean')fail();
 return {title:text(value.title,120),effect:normalizeRuleEffect(value.effect),scope:normalizeRuleScope(value.scope),origins:value.origins.map(normalizeRuleOrigin),profileIds:[...new Set(profileIds.map(id=>text(id,100)))].sort(),independent:value.independent??profileIds.length===0};
}
export function ruleFingerprint(rule){return createHash('sha256').update(JSON.stringify({effect:normalizeRuleEffect(rule.effect),scope:normalizeRuleScope(rule.scope)})).digest('hex');}
export function initializeRuleLibrary(data){data.personalRules??=[];data.ruleProposals??=[];data.ruleLibraryVersion??=1;return data;}
export function validateRuleLibrary(data){
 for(const [key,limit]of [['personalRules',RULE_LIMIT],['ruleProposals',PROPOSAL_LIMIT]])if(data[key]!==undefined&&(!Array.isArray(data[key])||data[key].length>limit))fail();
 if(data.ruleLibraryVersion!==undefined)positive(data.ruleLibraryVersion);
 for(const rule of data.personalRules||[]){
  keys(rule,['id','title','effect','scope','origins','profileIds','independent','status','version','createdAt','updatedAt','approvedAt']);
  text(rule.id,100);normalizeRuleDefinition(Object.fromEntries(['title','effect','scope','origins','profileIds','independent'].map(k=>[k,rule[k]])));positive(rule.version);if(!['active','inactive','deleted'].includes(rule.status))fail();for(const key of ['createdAt','updatedAt','approvedAt'])timestamp(rule[key]);
 }
 for(const proposal of data.ruleProposals||[]){
  keys(proposal,['id','operation','definition','targetId','targetVersion','version','status','createdAt','updatedAt','resultRuleId','resultRuleVersion']);
  text(proposal.id,100);if(!['create','replace','enable','disable','delete'].includes(proposal.operation)||!['pending','accepted','rejected'].includes(proposal.status))fail();positive(proposal.version);timestamp(proposal.createdAt);timestamp(proposal.updatedAt);
  if(['create','replace'].includes(proposal.operation))normalizeRuleDefinition(proposal.definition);
  else if(proposal.definition!==undefined)fail();
  if(proposal.operation!=='create'){text(proposal.targetId,100);positive(proposal.targetVersion);}else if(proposal.targetId!==undefined||proposal.targetVersion!==undefined)fail();
  if(proposal.status==='accepted'){text(proposal.resultRuleId,100);positive(proposal.resultRuleVersion);}
 }
 for(const key of ['personalRules','ruleProposals'])if(new Set((data[key]||[]).map(item=>item.id)).size!==(data[key]||[]).length)fail();
 return data;
}
export function proposeRule(data,input,{now=Date.now(),id=randomUUID()}={}){
 keys(input,['operation','definition','targetId','targetVersion']);const operation=input.operation||'create';
 const draft={id,operation,version:1,status:'pending',createdAt:now,updatedAt:now};
 if(['create','replace'].includes(operation))draft.definition=normalizeRuleDefinition(input.definition);
 if(operation!=='create'){draft.targetId=input.targetId;draft.targetVersion=input.targetVersion;}
 const proposals=data.ruleProposals||[];if(proposals.length>=PROPOSAL_LIMIT)fail('The proposal library is full. Remove reviewed proposals first.');
 validateRuleLibrary({personalRules:data.personalRules||[],ruleProposals:[...proposals,draft]});
 initializeRuleLibrary(data);data.ruleProposals.push(draft);return clone(draft);
}
function stale(){throw Object.assign(new Error('The rule or proposal changed. Reload before approving.'),{code:'ERR_RULE_STALE'});}
export function reviewRuleProposal(data,id,{version,accept,now=Date.now()}={}){
 const proposal=(data.ruleProposals||[]).find(item=>item.id===id);if(!proposal)fail('Rule proposal not found.');
 if(typeof accept!=='boolean')fail('Explicit approval or rejection is required.');
 if(proposal.status==='accepted'&&accept)return {proposal:clone(proposal),rule:clone(data.personalRules.find(rule=>rule.id===proposal.resultRuleId)),replayed:true};
 if(proposal.status==='rejected'&&!accept)return {proposal:clone(proposal),replayed:true};
 if(proposal.status!=='pending'||version!==proposal.version)stale();
 if(!accept){proposal.status='rejected';proposal.version++;proposal.updatedAt=now;return {proposal:clone(proposal)};}
 let rule;
 if(proposal.operation==='create'){
  const fingerprint=ruleFingerprint(proposal.definition),existing=(data.personalRules||[]).find(item=>ruleFingerprint(item)===fingerprint);
  // Repeated evidence must never re-enable an inactive or deleted rule.
  if(existing){
   const origins=[...existing.origins];for(const origin of proposal.definition.origins)if(!origins.some(item=>JSON.stringify(item)===JSON.stringify(origin)))origins.push(origin);
   rule={...existing,origins,version:existing.version+1,updatedAt:now};
  }else{if((data.personalRules||[]).length>=RULE_LIMIT)fail('The rule library is full.');rule={id:randomUUID(),...clone(proposal.definition),status:'active',version:1,createdAt:now,updatedAt:now,approvedAt:now};}
 }else{
  const existing=data.personalRules.find(item=>item.id===proposal.targetId);if(!existing||existing.version!==proposal.targetVersion||existing.status==='deleted')stale();
  rule={...existing,...(proposal.operation==='replace'?clone(proposal.definition):{}),status:proposal.operation==='disable'?'inactive':proposal.operation==='enable'?'active':proposal.operation==='delete'?'deleted':existing.status,version:existing.version+1,updatedAt:now,approvedAt:now};
 }
 const nextRules=[...(data.personalRules||[]).filter(item=>item.id!==rule.id),rule];validateRuleLibrary({personalRules:nextRules});
 data.personalRules=nextRules;data.ruleLibraryVersion=(data.ruleLibraryVersion||1)+1;
 Object.assign(proposal,{status:'accepted',version:proposal.version+1,updatedAt:now,resultRuleId:rule.id,resultRuleVersion:rule.version});
 return {proposal:clone(proposal),rule:clone(rule),replayed:false};
}
