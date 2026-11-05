import {createHash} from 'node:crypto';
import {normalizeRuleDefinition,proposeRule,reviewRuleProposal,proposedGlossaryTerm} from './personal-rules.mjs';
import {createContextLibrarySnapshot,resolveContextSnapshot} from './context.mjs';
import {languageKey,documentTypeKey} from './context-keys.mjs';

function page(url){const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||50);if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('Invalid rule page.');return {offset,limit};}
function paged(items,{offset,limit}){return {items:items.slice(offset,offset+limit),offset,total:items.length,hasMore:offset+limit<items.length};}
function plain(value){return value&&typeof value==='object'&&!Array.isArray(value);}
function error(message,code='ERR_RULE_VALIDATION'){throw Object.assign(new Error(message),{code});}

export function personalRuleRead(req,url,workspace,json,res){
 if(req.method!=='GET'||!['/api/personal-rules','/api/personal-rules/proposals'].includes(url.pathname))return false;
 if(!workspace)throw new Error('Workspace erforderlich.');
 const sampleId=url.searchParams.get('sampleId')||'';if(sampleId.length>100)error('Invalid source sample.');
 const pagination=page(url),query=(url.searchParams.get('q')||'').trim().toLocaleLowerCase();if(query.length>200)error('Rule search is too long.');
 if(url.pathname.endsWith('/proposals')){
  const ids=url.searchParams.get('ids')?.split(',');if(ids&&(ids.length>20||ids.some(id=>!id||id.length>100)))error('Invalid proposal selection.');
  const status=url.searchParams.get('status')||'pending';if(!['pending','accepted','rejected','all'].includes(status)||status==='all'&&!ids&&!sampleId)error('Invalid proposal status.');
  json(res,{...paged((workspace.data.ruleProposals||[]).filter(item=>(status==='all'||item.status===status)&&(!ids||ids.includes(item.id))&&(!sampleId||item.definition?.origins.some(origin=>origin.kind==='sample'&&origin.id===sampleId)||workspace.data.personalRules.some(rule=>rule.id===item.targetId&&rule.origins.some(origin=>origin.kind==='sample'&&origin.id===sampleId)))).map(item=>{const requestedId=item.id;if(ids){const visited=new Set();while(item.supersededBy&&!visited.has(item.id)){visited.add(item.id);const next=workspace.data.ruleProposals.find(proposal=>proposal.id===item.supersededBy);if(!next)break;item=next;}}const target=workspace.data.personalRules.find(rule=>rule.id===item.targetId);return {...item,...(ids?{requestedId}:{}),...(target?{target:{id:target.id,title:target.title,...(target.titleMode?{titleMode:target.titleMode}:{}),effect:target.effect,scope:target.scope,version:target.version,status:target.status}}:{})};}),pagination),libraryVersion:workspace.data.ruleLibraryVersion,reviewedCount:workspace.data.ruleProposals.filter(item=>item.status!=='pending').length});return true;
 }
 const status=url.searchParams.get('status')||'all',kind=url.searchParams.get('kind')||'',source=url.searchParams.get('source')||'';
 if(!['all','active','inactive','deleted'].includes(status)||kind&&!['layout','style','fieldOrder','terminology'].includes(kind)||source&&!['manual','chat','sample'].includes(source))error('Invalid rule filter.');
 const target=languageKey(url.searchParams.get('targetLanguage')||''),sourceLanguage=languageKey(url.searchParams.get('sourceLanguage')||''),documentType=documentTypeKey(url.searchParams.get('documentType')||'');
 const rules=(workspace.data.personalRules||[]).filter(rule=>(!sampleId||rule.origins.some(origin=>origin.kind==='sample'&&origin.id===sampleId))&&(status==='all'?rule.status!=='deleted':rule.status===status)&&(!target||!rule.scope.targetLanguage||rule.scope.targetLanguage===target)&&(!sourceLanguage||!rule.scope.sourceLanguage||rule.scope.sourceLanguage===sourceLanguage)&&(!documentType||!rule.scope.documentType||rule.scope.documentType===documentType)&&(!kind||rule.effect.kind===kind)&&(!source||rule.origins.some(origin=>origin.kind===source))&&(!query||`${rule.title} ${rule.effect.text||''} ${JSON.stringify(rule.scope)}`.toLocaleLowerCase().includes(query)));
 json(res,{...paged(rules,pagination),libraryVersion:workspace.data.ruleLibraryVersion,glossary:workspace.data.glossary.filter(term=>rules.slice(pagination.offset,pagination.offset+pagination.limit).some(rule=>rule.effect.kind==='terminology'&&rule.effect.glossaryId===term.id)),scopeProfiles:(workspace.data.profiles||[]).filter(entry=>entry.confirmed).map(({id,name})=>({id,name})),profiles:(workspace.data.learning||[]).map(entry=>({id:entry.id,name:entry.name,active:entry.active,status:entry.status}))});return true;
}

export async function personalRuleWrite({req,url,workspace,owner,body,json,res,persist,metadata}){
 if(req.method!=='POST'||!['/api/personal-rules/proposals','/api/personal-rules/review','/api/personal-rules/preview','/api/personal-rules/clear-reviewed'].includes(url.pathname))return false;
 if(!workspace)throw new Error('Workspace erforderlich.');
 try{
  const input=await body(req,100000);if(!plain(input))error('Invalid rule request.');
  if(url.pathname.endsWith('/clear-reviewed')){if(input.confirm!==true)error('Confirm clearing reviewed proposals.');const result=await persist(data=>{const before=data.ruleProposals.length;data.ruleProposals=data.ruleProposals.filter(item=>item.status==='pending');return {removed:before-data.ruleProposals.length};});json(res,result);return true;}
  if(url.pathname.endsWith('/preview')){
   if(input.metadata!==undefined&&!plain(input.metadata))error('Invalid rule metadata.');
   const meta=metadata(input.metadata||{}),snapshot=createContextLibrarySnapshot(workspace,meta,'',owner),context=resolveContextSnapshot(snapshot,meta);
   json(res,{...context.ruleResolution,libraryVersion:snapshot.rules.libraryVersion});return true;
  }
  if(url.pathname.endsWith('/proposals')){
   if(typeof input.requestId!=='string'||!/^[a-f0-9-]{36}$/i.test(input.requestId))error('A stable request ID is required.');
   const id=`manual-${createHash('sha256').update(`${owner}\0${input.requestId}`).digest('hex').slice(0,24)}`;
   const operation=input.operation||'create';
   const result=await persist(data=>{
    const previous=operation!=='create'?data.personalRules.find(rule=>rule.id===input.targetId):null;
    const superseded=input.supersedes&&data.ruleProposals.find(proposal=>proposal.id===input.supersedes.id);
    const candidate={operation,...(operation!=='create'?{targetId:input.targetId,targetVersion:input.targetVersion}:{})};
    if(['create','replace'].includes(operation)){
     if(!plain(input.definition))error('A rule definition is required.');
     const definition={...input.definition,origins:[...(previous?.origins||superseded?.definition?.origins||[]).filter(origin=>origin.kind!=='manual'),{kind:'manual',id}]};
     if(previous){definition.profileIds??=previous.profileIds;definition.independent??=previous.independent;if(previous.titleMode==='effect')definition.titleMode??='custom';}
     const termDraft=input.glossaryDraft??superseded?.glossaryDraft;if(termDraft){if(definition.effect?.kind!=='terminology')error('A glossary pair requires a terminology rule.');const term=proposedGlossaryTerm(termDraft,definition.scope);definition.effect={kind:'terminology',glossaryId:term.id};candidate.glossaryDraft=term.pair;}
     candidate.definition=normalizeRuleDefinition(definition);
     if(candidate.definition.effect.kind==='terminology'&&!candidate.glossaryDraft&&!data.glossary.some(term=>term.id===candidate.definition.effect.glossaryId))error('The referenced glossary entry no longer exists.');
     if(candidate.definition.independent)candidate.definition.profileIds=candidate.definition.profileIds.filter(profileId=>workspace.data.learning.some(entry=>entry.id===profileId));else if(candidate.definition.profileIds.some(profileId=>!workspace.data.learning.some(entry=>entry.id===profileId)))error('The selected sample profile no longer exists.');
    }
    const existing=data.ruleProposals.find(proposal=>proposal.id===id);
    if(existing){const comparable=Object.fromEntries(Object.keys(candidate).map(key=>[key,existing[key]]));if(JSON.stringify(comparable)!==JSON.stringify(candidate))error('This request ID was already used for a different proposal.','ERR_RULE_STALE');return {proposal:structuredClone(existing),replayed:true};}
    const proposal=proposeRule(data,candidate,{id});
    if(input.supersedes){if(!plain(input.supersedes)||!superseded||superseded.status!=='pending'||superseded.version!==input.supersedes.version)error('The proposal changed. Reload before adjusting.','ERR_RULE_STALE');reviewRuleProposal(data,superseded.id,{version:superseded.version,accept:false});superseded.supersededBy=id;}
    return {proposal,replayed:false};
   });json(res,result,201);return true;
  }
  const items=input.items||[{id:input.id,version:input.version,accept:input.accept}];
  if(!Array.isArray(items)||!items.length||items.length>100||new Set(items.map(item=>item?.id)).size!==items.length)error('Select between one and 100 distinct proposals.');
  const result=await persist(data=>({results:items.map(item=>{if(!plain(item)||typeof item.id!=='string'||item.id.length>100)error('Invalid proposal approval.');return reviewRuleProposal(data,item.id,{version:item.version,accept:item.accept});})}));
  json(res,{...result,libraryVersion:workspace.data.ruleLibraryVersion});return true;
 }catch(err){if(['ERR_RULE_VALIDATION','ERR_RULE_STALE'].includes(err.code)){json(res,{error:err.message,code:err.code},err.code==='ERR_RULE_STALE'?409:400);return true;}throw err;}
}
