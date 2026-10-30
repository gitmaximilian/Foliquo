import {formDefinitions} from './form-fields.mjs';
import {randomBytes,createCipheriv,createDecipheriv,scryptSync,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,chmod,copyFile,stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join} from 'node:path';
import {pruneUsage} from './usage.mjs';
import {validateWorkspaceData} from './workspace-schema.mjs';
const MAX_BYTES=256*1024*1024;
const MAX_SEALED_BYTES=MAX_BYTES+33;
const MAX_BACKUP_BYTES=MAX_BYTES+58;
export const WORKSPACE_SCHEMA=3;
export const defaultLayout={font:'Aptos',fontSize:11,lineHeight:1.45,margin:25,titleAlign:'center',header:'',footer:'',pageNumbers:true,includeOriginals:true,certification:'',tableLabelWidth:38,paragraphSpacing:4.5,keepRows:true};
export function layoutSettings(input={}){
 const result={...defaultLayout};
 if(input.font!==undefined&&!['Aptos','Times New Roman','Arial','Noto Serif'].includes(input.font))throw new Error('Nicht unterstützte Vorlagenschrift.');
 for(const [k,min,max] of [['fontSize',8,16],['lineHeight',1,2],['margin',15,35],['tableLabelWidth',20,65],['paragraphSpacing',0,18]])if(input[k]!==undefined){const n=Number(input[k]);if(!Number.isFinite(n)||n<min||n>max)throw new Error('Ungültiges Layoutmaß.');result[k]=n;}
 if(input.titleAlign!==undefined){if(!['left','center','right'].includes(input.titleAlign))throw new Error('Ungültige Ausrichtung.');result.titleAlign=input.titleAlign;}
 for(const k of ['header','footer','certification'])if(input[k]!==undefined)result[k]=string(input[k],k==='certification'?3000:300);
 for(const k of ['pageNumbers','includeOriginals','keepRows'])if(input[k]!==undefined){if(typeof input[k]!=='boolean')throw new Error('Ungültige Layoutoption.');result[k]=input[k];}
 // The requested document standard takes precedence over typography inferred
 // from older style examples or templates.
 result.font='Aptos';result.fontSize=11;
 // Every exported translation PDF must retain its source pages as an annex.
 // Older saved templates may still contain includeOriginals: false.
 result.includeOriginals=true;
 return result;
}
export function string(v,max=1000){if(typeof v!=='string'||v.length>max)throw new Error('Angabe fehlt oder ist zu lang.');return v.trim();}
function seal(value,key){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([Buffer.from('TOCR1'),iv,cipher.update(value),cipher.final(),cipher.getAuthTag()]);}
function unseal(bytes,key){if(bytes.subarray(0,5).toString()!=='TOCR1')throw new Error('Ungültiges verschlüsseltes Archiv.');const d=createDecipheriv('aes-256-gcm',key,bytes.subarray(5,17));d.setAuthTag(bytes.subarray(-16));return Buffer.concat([d.update(bytes.subarray(17,-16)),d.final()]);}
function normalizeWorkspace(candidate){
 const data={...candidate,schema:WORKSPACE_SCHEMA};
 for(const name of ['templates','examples','glossary','profiles','dossiers','learning','importBatches','usage','jobs','sessions'])if(!Array.isArray(data[name]))data[name]=[];
 data.usageLimitStates=data.usageLimitStates&&typeof data.usageLimitStates==='object'&&!Array.isArray(data.usageLimitStates)?data.usageLimitStates:{};
 data.settings={retentionDays:30,apiBudgetUSDMonthly:0,provider:'chatgpt',apiProviders:{},locale:'en',displayName:'',introComplete:false,...(data.settings||{})};
 if(!data.settings.apiProviders||typeof data.settings.apiProviders!=='object'||Array.isArray(data.settings.apiProviders))data.settings.apiProviders={};
 for(const name of ['templates','profiles','dossiers','learning'])for(const item of data[name])if(!Number.isSafeInteger(item.version)||item.version<1)item.version=1;
 for(const dossier of data.dossiers)for(const fact of dossier.facts||[])if(!Number.isSafeInteger(fact.version)||fact.version<1)fact.version=1;
 return data;
}
export class Workspace {
 constructor(directory){this.directory=directory;this.data={schema:WORKSPACE_SCHEMA,templates:[],examples:[],glossary:[],profiles:[],dossiers:[],learning:[],usage:[],usageLimitStates:{},settings:{retentionDays:30,apiBudgetUSDMonthly:0,provider:'chatgpt',apiProviders:{},locale:'en',displayName:'',introComplete:false},jobs:[],sessions:[]};this.tail=Promise.resolve();}
 async init(){
  await mkdir(this.directory,{recursive:true,mode:0o700});
  try{this.key=await readFile(join(this.directory,'workspace.key'));}
  catch(error){if(error.code!=='ENOENT')throw error;this.key=randomBytes(32);await writeFile(join(this.directory,'workspace.key'),this.key,{mode:0o600,flag:'wx'});}
  if(this.key.length!==32)throw new Error('Ungültiger Workspace-Schlüssel.');
  let bytes;
  try{const info=await stat(join(this.directory,'workspace.enc'));if(info.size>MAX_SEALED_BYTES)throw new Error('Workspace überschreitet die erlaubte Größe. Originaldateien bleiben erhalten.');bytes=await readFile(join(this.directory,'workspace.enc'));}
  catch(error){if(error.code==='ENOENT')bytes=null;else throw error;}
  let migrated=false,candidate=this.data;
  if(bytes){
   try{candidate=JSON.parse(unseal(bytes,this.key).toString());}
   catch{throw new Error('Workspace konnte nicht entschlüsselt werden. Originaldateien bleiben erhalten.');}
   validateWorkspaceData(candidate);
   if(candidate.schema<WORKSPACE_SCHEMA){
    const backup=join(this.directory,`workspace.enc.pre-schema-${WORKSPACE_SCHEMA}-${Date.now()}.bak`);
    try{await copyFile(join(this.directory,'workspace.enc'),backup,constants.COPYFILE_EXCL);await chmod(backup,0o600);}
    catch(error){if(error.code!=='EEXIST')throw new Error('Vor der Workspace-Migration konnte keine lokale Sicherung erstellt werden. Der bisherige Workspace bleibt unverändert.');}
    migrated=true;
   }
  }
  this.data=normalizeWorkspace(candidate);
  let interruptedLearning=false;
  for(const entry of this.data.learning)if(entry.status==='analyzing'){entry.status='interrupted';entry.lastError='Die Analyse wurde durch einen Neustart unterbrochen. Gesicherte Seiten können ausdrücklich fortgesetzt werden.';entry.active=false;interruptedLearning=true;}
  this.prune();
  if(migrated||interruptedLearning)await this.save();
  return this;
 }
 prune(){for(const [id,draft] of Object.entries(this.data.studioDrafts||{}))if(!this.data.sessions.some(([sessionId])=>sessionId===id)||draft.updatedAt<Date.now()-30*86400000)delete this.data.studioDrafts[id];const cutoff=Date.now()-this.data.settings.retentionDays*86400000;this.data.importBatches=this.data.importBatches.filter(batch=>(batch.updatedAt||batch.createdAt||0)>=cutoff);this.data.jobs=this.data.jobs.filter(j=>(j.finishedAt||j.createdAt)>=cutoff);this.data.usage=pruneUsage(this.data.usage);this.data.glossary=this.data.glossary.filter(g=>g.scope!=='job'||this.data.jobs.some(j=>j.id===g.jobId&&j.status!=='expired'));this.data.sessions=this.data.sessions.filter(([,s])=>s.expiresAt>Date.now());}
 save(){const snapshot=JSON.stringify(this.data);if(Buffer.byteLength(snapshot)>MAX_BYTES)throw new Error('Lokales Archiv ist voll. Bitte ältere Aufträge löschen.');const task=this.tail.catch(()=>{}).then(async()=>{const target=join(this.directory,'workspace.enc'),temp=target+'.tmp';await writeFile(temp,seal(Buffer.from(snapshot),this.key),{mode:0o600});await rename(temp,target);await chmod(target,0o600);});this.tail=task;return task;}
 library(){const {templates,examples,glossary,profiles,settings}=this.data;const safeSettings={retentionDays:settings.retentionDays,provider:settings.provider||'chatgpt'};return {templates,examples:examples.map(({originals,...x})=>({...x,originalCount:originals?.length||0})),glossary,profiles,settings:safeSettings,storage:'AES-256-GCM · Schlüssel auf diesem Computer'};}
 preferences(){const s=this.data.settings;return {locale:['en','de','ar'].includes(s.locale)?s.locale:'en',displayName:typeof s.displayName==='string'?s.displayName:'',introComplete:s.introComplete===true};}
 setPreferences(input={}){const locale=input.locale??this.data.settings.locale,name=input.displayName??this.data.settings.displayName,complete=input.introComplete??this.data.settings.introComplete;if(!['en','de','ar'].includes(locale))throw new Error('Unsupported interface language.');if(typeof name!=='string'||name.trim().length>80||/[\r\n\0]/.test(name))throw new Error('Please use a name of 80 characters or fewer.');if(typeof complete!=='boolean')throw new Error('Invalid intro status.');this.data.settings.locale=locale;this.data.settings.displayName=name.trim();this.data.settings.introComplete=complete;return this.preferences();}
 put(kind,input){if(!['templates','examples','glossary','profiles'].includes(kind))throw new Error('Unbekannte Sammlung.');const list=this.data[kind];if(list.length>=300&&!input.id)throw new Error('Maximal 300 Einträge je Sammlung.');const previous=input.id?list.find(x=>x.id===input.id):null;let entry={id:input.id||randomUUID(),name:string(input.name||'',120),updatedAt:Date.now(),version:(previous?.version||0)+1};if(!entry.name)throw new Error('Bitte einen Namen vergeben.');if(input.id&&!previous)throw new Error('Eintrag nicht gefunden.');
 if(['templates','profiles'].includes(kind)){entry={...entry,layout:layoutSettings(input.layout),confirmed:input.confirmed===true,documentType:string(input.documentType||'',120),targetLanguage:string(input.targetLanguage||'',50),formFields:formDefinitions(input.formFields||[]),fields:(input.fields||[]).slice(0,60).map(v=>string(v,120))};}
 if(kind==='examples'){if(input.approved!==true)throw new Error('Nur ausdrücklich freigegebene Beispiele speichern.');entry={...entry,approved:true,templateId:string(input.templateId||'',80),targetLanguage:string(input.targetLanguage||'Deutsch',50),documentType:string(input.documentType||'',120),sourceText:string(input.sourceText||'',20000),translation:string(input.translation,30000),originals:input.originals||[]};if(!entry.translation)throw new Error('Die geprüfte Übersetzung fehlt.');}
 if(kind==='glossary'){entry={...entry,source:string(input.source,300),target:string(input.target,300),targetLanguage:string(input.targetLanguage||'Deutsch',50),scope:input.scope==='job'?'job':'global',jobId:string(input.jobId||'',80),note:string(input.note||'',500)};if(!entry.source||!entry.target||entry.scope==='job'&&!entry.jobId)throw new Error('Begriff, Übersetzung und ggf. Auftrag angeben.');}
 const candidate=list.filter(x=>x.id!==entry.id).concat(entry);if(Buffer.byteLength(JSON.stringify({...this.data,[kind]:candidate}))>MAX_BYTES)throw new Error('Lokales Archiv ist voll. Bitte ältere Einträge sichern und löschen.');const i=list.findIndex(x=>x.id===entry.id);if(i<0)list.push(entry);else list[i]=entry;return entry;}
 remove(kind,id){if(!['templates','examples','glossary','profiles'].includes(kind))throw new Error('Unbekannte Sammlung.');this.data[kind]=this.data[kind].filter(x=>x.id!==id);}
 context(meta={},jobId=meta.jobId||''){
  const template=this.data.templates.find(entry=>entry.id===meta.templateId&&entry.confirmed),profile=this.data.profiles.find(entry=>entry.id===meta.profileId&&entry.confirmed);
  if(meta.templateId&&!template)throw new Error('Die gewählte Vorlage fehlt oder ist nicht bestätigt.');
  if(meta.profileId&&!profile)throw new Error('Das gewählte Profil fehlt oder ist nicht bestätigt.');
  const targetLanguage=meta.targetLanguage||'Deutsch',terms=this.data.glossary.filter(entry=>entry.targetLanguage===targetLanguage&&(entry.scope==='global'||entry.jobId===jobId));
  const query=[meta.documentType,meta.additionalInfo,template?.documentType,profile?.documentType,...(template?.fields||[]),...(profile?.fields||[])].join(' ').toLowerCase(),words=new Set(query.match(/[\p{L}\p{N}]{3,}/gu)||[]),selectedIds=Array.isArray(meta.referenceIds)?new Set(meta.referenceIds):null;
  const examples=meta.useExamples?this.data.examples.filter(entry=>entry.approved&&entry.targetLanguage===targetLanguage&&(!selectedIds||selectedIds.has(entry.id))&&(!template||entry.templateId===template.id||entry.documentType===template.documentType)).map(entry=>({entry,score:[...words].filter(word=>(entry.name+' '+entry.documentType+' '+entry.sourceText).toLowerCase().includes(word)).length+(template&&entry.templateId===template.id?20:0)})).filter(({entry,score})=>selectedIds?selectedIds.has(entry.id):score>0).sort((a,b)=>b.score-a.score).slice(0,2).map(({entry})=>({...entry,originals:(entry.originals||[]).slice(0,2)})):[];
  const layout=template||profile?layoutSettings({...template?.layout,...profile?.layout}):null;
  return {template:template||null,profile:profile||null,layout,terms,examples};
 }
 backup(passphrase){
  if(typeof passphrase!=='string'||passphrase.length<12||passphrase.length>200)throw new Error('Backup-Passwort benötigt mindestens 12 Zeichen.');
  const salt=randomBytes(16),key=scryptSync(passphrase,salt,32),settings={...this.data.settings,apiProviders:{}};
  delete settings.usageBudgetConsentOnce;
  const snapshot=Buffer.from(JSON.stringify({...this.data,settings,sessions:[]}));
  if(snapshot.length>MAX_BYTES)throw new Error('Lokales Archiv ist voll. Bitte ältere Aufträge löschen.');
  const bytes=Buffer.concat([Buffer.from('TOCRBACK1'),salt,seal(snapshot,key)]);
  if(bytes.length>MAX_BACKUP_BYTES)throw new Error('Backup überschreitet die erlaubte Größe.');
  return bytes;
 }
 restore(bytes,passphrase){
  if(!Buffer.isBuffer(bytes)||bytes.length>MAX_BACKUP_BYTES||bytes.length<58||bytes.subarray(0,9).toString()!=='TOCRBACK1')throw new Error('Ungültiges Backup.');
  let candidate;
  try{candidate=JSON.parse(unseal(bytes.subarray(25),scryptSync(passphrase,bytes.subarray(9,25),32)).toString());}
  catch{throw new Error('Backup-Passwort oder Datei ist ungültig.');}
  try{validateWorkspaceData(candidate);}
  catch{throw new Error('Ungültiger Backup-Inhalt. Der aktuelle Workspace bleibt unverändert.');}
  const restored=normalizeWorkspace(candidate),apiProviders=this.data.settings.apiProviders||{};
  restored.settings.apiProviders=apiProviders;
  delete restored.settings.usageBudgetConsentOnce;
  restored.sessions=this.data.sessions;
  this.data=restored;
  this.prune();
 }
}
