const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const collectionLimits={templates:300,examples:300,glossary:300,profiles:300,dossiers:100,learning:60,importBatches:1000,usage:5000,jobs:10000,sessions:1000};
const fail=()=>{throw new Error('Ungültige Workspace-Struktur. Die gespeicherte Datei bleibt unverändert.');};

function validateItems(name,items){
 if(!Array.isArray(items)||items.length>collectionLimits[name])fail();
 for(const item of items){
  if(name==='sessions'){
   if(!Array.isArray(item)||item.length!==2||typeof item[0]!=='string'||item[0].length>200||!record(item[1]))fail();
   if(item[1].csrf!==undefined&&(typeof item[1].csrf!=='string'||item[1].csrf.length>200))fail();
   if(item[1].expiresAt!==undefined&&(!Number.isFinite(item[1].expiresAt)||item[1].expiresAt<0))fail();
   continue;
  }
  if(!record(item))fail();
  if(item.id!==undefined&&(typeof item.id!=='string'||item.id.length>100))fail();
  if(item.name!==undefined&&(typeof item.name!=='string'||item.name.length>120))fail();
  if(item.version!==undefined&&(!Number.isSafeInteger(item.version)||item.version<1))fail();
  if(['templates','profiles'].includes(name)){
   if(item.fields!==undefined&&(!Array.isArray(item.fields)||item.fields.length>60))fail();
   if(item.formFields!==undefined&&(!Array.isArray(item.formFields)||item.formFields.length>100))fail();
   if(item.layout!==undefined&&!record(item.layout))fail();
  }
  if(name==='examples'){
   if(item.originals!==undefined&&(!Array.isArray(item.originals)||item.originals.length>2))fail();
   if(item.sourceText!==undefined&&(typeof item.sourceText!=='string'||item.sourceText.length>20000))fail();
   if(item.translation!==undefined&&(typeof item.translation!=='string'||item.translation.length>30000))fail();
   if(item.approved!==undefined&&typeof item.approved!=='boolean')fail();
  }
  if(name==='glossary'){
   for(const key of ['source','target','scope','jobId','targetLanguage','sourceLanguage','documentType','scopeId','profileId','note','matchMode','status'])if(item[key]!==undefined&&(typeof item[key]!=='string'||item[key].length>500))fail();
   if(item.createdAt!==undefined&&(!Number.isFinite(item.createdAt)||item.createdAt<0))fail();
   if(item.updatedAt!==undefined&&(!Number.isFinite(item.updatedAt)||item.updatedAt<0))fail();
  }
  if(name==='dossiers'&&item.facts!==undefined&&(!Array.isArray(item.facts)||item.facts.length>50||item.facts.some(fact=>!record(fact))))fail();
  if(name==='dossiers'){
   if(item.owner!==undefined&&(typeof item.owner!=='string'||item.owner.length>200))fail();
   for(const fact of item.facts||[])for(const key of ['id','key','label','value'])if(fact[key]!==undefined&&(typeof fact[key]!=='string'||fact[key].length>300))fail();
  }
  if(name==='learning'){
   if(item.rules!==undefined&&(!Array.isArray(item.rules)||item.rules.length>80))fail();
   if(item.fieldLabels!==undefined&&(!Array.isArray(item.fieldLabels)||item.fieldLabels.length>120))fail();
   if(item.analysis!==undefined&&!record(item.analysis))fail();
   if(item.source!==undefined&&!record(item.source))fail();
   if(item.sources!==undefined&&(!Array.isArray(item.sources)||item.sources.length>10))fail();
   if(item.analysis?.observations!==undefined&&(!Array.isArray(item.analysis.observations)||item.analysis.observations.length>240))fail();
   if(item.analysis?.terminology!==undefined&&(!Array.isArray(item.analysis.terminology)||item.analysis.terminology.length>100))fail();
  }
  if(name==='jobs'){
   if(item.payload!==undefined&&item.payload!==null&&!record(item.payload))fail();
   if(item.result!==undefined&&item.result!==null&&!record(item.result))fail();
  }
  if(name==='usage'){
   for(const key of ['startedAt','finishedAt'])if(item[key]!==undefined&&item[key]!==null&&(!Number.isFinite(item[key])||item[key]<0))fail();
   for(const key of ['inputTokens','outputTokens','totalTokens','cachedInputTokens','cacheWriteTokens','cacheWrite5mTokens','cacheWrite1hTokens','cacheWrite12hTokens','reasoningTokens'])if(item[key]!==undefined&&item[key]!==null&&(!Number.isSafeInteger(item[key])||item[key]<0))fail();
   if(item.estimatedCost!==undefined&&item.estimatedCost!==null&&(!record(item.estimatedCost)||!Number.isFinite(item.estimatedCost.low)||!Number.isFinite(item.estimatedCost.high)||item.estimatedCost.low<0||item.estimatedCost.high<item.estimatedCost.low))fail();
  }
  if(name==='importBatches'){
   if(item.sources!==undefined&&(!Array.isArray(item.sources)||item.sources.length>1000||item.sources.some(source=>!record(source))))fail();
   if(item.groups!==undefined&&(!Array.isArray(item.groups)||item.groups.length>1000||item.groups.some(group=>!record(group))))fail();
  }
 }
}

export function validateWorkspaceData(value){
 if(!record(value)||![1,2,3,4].includes(value.schema))fail();
 if(value._jobStoreGeneration!==undefined&&(typeof value._jobStoreGeneration!=='string'||value._jobStoreGeneration.length!==36||!/^[a-f0-9-]{36}$/.test(value._jobStoreGeneration)))fail();
 for(const [name,limit]of Object.entries(collectionLimits)){
  if(value[name]===undefined)continue;
  if(!Array.isArray(value[name])||value[name].length>limit)fail();
  validateItems(name,value[name]);
 }
 if(value.settings!==undefined&&!record(value.settings))fail();
 const settings=value.settings||{};
 if(settings.retentionDays!==undefined&&(!Number.isInteger(settings.retentionDays)||settings.retentionDays<1||settings.retentionDays>365))fail();
 if(settings.apiBudgetUSDMonthly!==undefined&&(!Number.isFinite(settings.apiBudgetUSDMonthly)||settings.apiBudgetUSDMonthly<0||settings.apiBudgetUSDMonthly>10000||Math.round(settings.apiBudgetUSDMonthly*100)!==settings.apiBudgetUSDMonthly*100))fail();
 if(settings.provider!==undefined&&(typeof settings.provider!=='string'||settings.provider.length>40))fail();
 if(settings.locale!==undefined&&!['en','de','ar'].includes(settings.locale))fail();
 if(settings.displayName!==undefined&&(typeof settings.displayName!=='string'||settings.displayName.length>80||/[\r\n\0]/.test(settings.displayName)))fail();
 if(settings.introComplete!==undefined&&typeof settings.introComplete!=='boolean')fail();
 if(settings.apiProviders!==undefined&&!record(settings.apiProviders))fail();
 for(const [provider,config]of Object.entries(settings.apiProviders||{}))if(!['openai','anthropic','deepseek'].includes(provider)||!record(config)||config.apiKey!==undefined&&(typeof config.apiKey!=='string'||config.apiKey.length>4000))fail();
 if(value.usageLimitStates!==undefined&&!record(value.usageLimitStates))fail();
 return value;
}
