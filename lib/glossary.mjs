const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const lang=value=>clean(value,50).normalize('NFKC').toLocaleLowerCase().replace(/[\s_-]+/g,' ').trim();
const termKey=(value,mode='phrase')=>{const normalized=clean(value,300).normalize('NFKC').replace(/\s+/g,' ');return mode==='case-sensitive'?normalized:normalized.toLocaleLowerCase();};

export function normalizeGlossaryEntry(input={}){
 const scope=['global','profile','job'].includes(input.scope)?input.scope:input.jobId?'job':'global';
 const status=['approved','proposed','disabled'].includes(input.status)?input.status:'approved';
 const matchMode=['word','phrase','case-sensitive'].includes(input.matchMode)?input.matchMode:'phrase';
 return {
  ...input,
  source:clean(input.source,300),target:clean(input.target,300),
  sourceLanguage:clean(input.sourceLanguage,50)||'any',targetLanguage:clean(input.targetLanguage,50)||'Deutsch',
  documentType:clean(input.documentType,120)||'any',scope,scopeId:clean(input.scopeId||(scope==='job'?input.jobId:input.profileId)||'',100),
  jobId:scope==='job'?clean(input.scopeId||input.jobId||'',100):'',
  profileId:scope==='profile'?clean(input.scopeId||input.profileId||'',100):'',
  note:clean(input.note,500),matchMode,status,
  createdAt:Number.isFinite(input.createdAt)?input.createdAt:Date.now(),updatedAt:Number.isFinite(input.updatedAt)?input.updatedAt:Date.now(),
  version:Number.isSafeInteger(input.version)&&input.version>0?input.version:1,
 };
}

function matches(entry,meta,jobId){
 const sourceLanguage=lang(meta.sourceLanguage||'any'),targetLanguage=lang(meta.targetLanguage||'Deutsch'),documentType=lang(meta.documentType||'any');
 if(entry.status!=='approved'||(lang(entry.targetLanguage)!==targetLanguage))return false;
 if(lang(entry.sourceLanguage)!=='any'&&sourceLanguage!=='any'&&lang(entry.sourceLanguage)!==sourceLanguage)return false;
 if(lang(entry.documentType)!=='any'&&lang(entry.documentType)!==documentType)return false;
 if(entry.scope==='job')return Boolean(jobId)&&entry.scopeId===jobId;
 if(entry.scope==='profile')return Boolean(meta.profileId)&&entry.scopeId===meta.profileId;
 return entry.scope==='global';
}

export function selectGlossary(entries=[],meta={},jobId=meta.jobId||''){
 const priority={global:1,profile:2,job:3},groups=new Map();
 for(const raw of entries){
  const entry=normalizeGlossaryEntry(raw);
  if(!entry.source||!entry.target||!matches(entry,meta,jobId))continue;
  const key=`${termKey(entry.source,entry.matchMode)}\u0000${lang(entry.targetLanguage)}\u0000${entry.matchMode}`;
  const group=groups.get(key)||[];group.push(entry);groups.set(key,group);
 }
 const terms=[],conflicts=[];
 for(const candidates of groups.values()){
  const best=Math.max(...candidates.map(entry=>priority[entry.scope]||0));
  const top=candidates.filter(entry=>priority[entry.scope]===best),targets=new Map();
  for(const entry of top){const key=termKey(entry.target,entry.matchMode),same=targets.get(key)||[];same.push(entry);targets.set(key,same);}
  if(targets.size>1){conflicts.push({source:top[0].source,sourceLanguage:top[0].sourceLanguage,targetLanguage:top[0].targetLanguage,matchMode:top[0].matchMode,scope:top[0].scope,entries:top.map(({id,name,target,note,version})=>({id,name,target,note,version}))});continue;}
  const chosen=top[0];terms.push({...chosen,conflictingIds:candidates.filter(entry=>priority[entry.scope]<best&&termKey(entry.target,entry.matchMode)!==termKey(chosen.target,chosen.matchMode)).map(entry=>entry.id)});
 }
 return {terms,conflicts};
}
