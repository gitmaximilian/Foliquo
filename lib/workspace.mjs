import {formDefinitions} from './form-fields.mjs';
import {randomBytes,createCipheriv,createDecipheriv,scryptSync,randomUUID} from 'node:crypto';
import {mkdir,mkdtemp,open,readFile,writeFile,rename,chmod,copyFile,stat,rm,lstat,readdir,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createReadStream,createWriteStream} from 'node:fs';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {join} from 'node:path';
import {pruneUsage} from './usage.mjs';
import {validateWorkspaceData} from './workspace-schema.mjs';
import {JobStore} from './job-store.mjs';
import {RecoveryPointStore} from './recovery-points.mjs';
const MAX_BYTES=256*1024*1024;
const MAX_SEALED_BYTES=MAX_BYTES+33;
const MAX_LEGACY_BACKUP_BYTES=MAX_BYTES+58;
const MAX_STREAM_BACKUP_BYTES=16*1024*1024*1024;
const MAX_BACKUP_FRAME_BYTES=512*1024*1024;
const BACKUP_V2=Buffer.from('TOCRBACK2');
export const WORKSPACE_SCHEMA=4;
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
function backupFrame(type,sequence,payload,key){
 const header=Buffer.alloc(9);header.writeUInt8(type,0);header.writeUInt32BE(sequence,1);header.writeUInt32BE(payload.length,5);
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.concat([BACKUP_V2,header]));
 return Buffer.concat([header,iv,cipher.update(payload),cipher.final(),cipher.getAuthTag()]);
}
class BackupFrameReader{
 constructor(source){this.iterator=source[Symbol.asyncIterator]();this.chunks=[];this.bufferedBytes=0;this.done=false;}
 async read(length,{eof=false}={}){
  while(this.bufferedBytes<length&&!this.done){const next=await this.iterator.next();if(next.done){this.done=true;break;}if(!Buffer.isBuffer(next.value)&&!(next.value instanceof Uint8Array))throw new Error('Backup stream returned invalid data.');const chunk=Buffer.isBuffer(next.value)?next.value:Buffer.from(next.value);if(chunk.length){this.chunks.push(chunk);this.bufferedBytes+=chunk.length;}}
  if(this.bufferedBytes<length){if(eof&&this.bufferedBytes===0)return null;throw new Error('Das verschlüsselte Backup ist unvollständig.');}
  const first=this.chunks[0];let value;
  if(first.length>=length){value=first.subarray(0,length);if(first.length===length)this.chunks.shift();else this.chunks[0]=first.subarray(length);}
  else{value=Buffer.allocUnsafe(length);let offset=0;while(offset<length){const chunk=this.chunks[0],take=Math.min(chunk.length,length-offset);chunk.copy(value,offset,0,take);offset+=take;if(take===chunk.length)this.chunks.shift();else this.chunks[0]=chunk.subarray(take);}}
  this.bufferedBytes-=length;return value;
 }
 async assertEnd(){if(this.bufferedBytes)return false;while(!this.done){const next=await this.iterator.next();if(next.done){this.done=true;break;}if(!Buffer.isBuffer(next.value)&&!(next.value instanceof Uint8Array))throw new Error('Backup stream returned invalid data.');const chunk=Buffer.isBuffer(next.value)?next.value:Buffer.from(next.value);if(chunk.length){this.chunks.push(chunk);this.bufferedBytes+=chunk.length;return false;}}return true;}
}
function decryptBackupFrame(header,iv,ciphertext,tag,key){
 const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(Buffer.concat([BACKUP_V2,header]));decipher.setAuthTag(tag);
 try{return Buffer.concat([decipher.update(ciphertext),decipher.final()]);}catch{throw new Error('Backup-Passwort oder Datei ist ungültig.');}
}
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
 constructor(directory,{lazyJobs=false}={}){this.directory=directory;this.lazyJobs=lazyJobs===true;this.replaceAllJobsOnSave=false;this.pendingRestore=null;this.data={schema:WORKSPACE_SCHEMA,templates:[],examples:[],glossary:[],profiles:[],dossiers:[],learning:[],usage:[],usageLimitStates:{},settings:{retentionDays:30,apiBudgetUSDMonthly:0,provider:'chatgpt',apiProviders:{},locale:'en',displayName:'',introComplete:false},jobs:[],sessions:[]};this.tail=Promise.resolve();}
 async cleanupInterruptedFiles(){
  for(const name of await readdir(this.directory)){
   const restoreStaging=/^\.restore-staging-[A-Za-z0-9_-]{6}$/.test(name),metadataTemp=/^workspace\.enc\.tmp-[a-f0-9-]{36}$/.test(name),recoveryStaging=/^\.recovery-restore-[a-f0-9-]{36}$/.test(name),recoveryTemp=/^\.recovery-restore-state\.tmp-[a-f0-9-]{36}$/.test(name);if(!restoreStaging&&!metadataTemp&&!recoveryStaging&&!recoveryTemp)continue;
   const path=join(this.directory,name);try{const info=await lstat(path);if(info.isSymbolicLink())continue;if((restoreStaging||recoveryStaging)&&info.isDirectory())await rm(path,{recursive:true,force:true});else if((metadataTemp||recoveryTemp)&&info.isFile())await unlink(path);}catch(error){if(error.code!=='ENOENT')throw error;}
  }
 }
 async init(){
  await mkdir(this.directory,{recursive:true,mode:0o700});
  this.recoveryPoints=new RecoveryPointStore(this.directory);await this.recoveryPoints.init();const resumedRecovery=await this.recoveryPoints.resumeInterrupted();await this.cleanupInterruptedFiles();this.recoveryPointList=await this.recoveryPoints.list();if(resumedRecovery)this.recoveredFrom=resumedRecovery;
  let workspaceExists=false;try{await stat(join(this.directory,'workspace.enc'));workspaceExists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
  try{this.key=await readFile(join(this.directory,'workspace.key'));}
  catch(error){if(error.code!=='ENOENT')throw error;if(workspaceExists){const recovered=await this.tryRecovery();if(recovered)return this.init();throw new Error('Workspace-Schlüssel fehlt und es gibt keinen verwendbaren lokalen Wiederherstellungspunkt.');}this.key=randomBytes(32);await writeFile(join(this.directory,'workspace.key'),this.key,{mode:0o600,flag:'wx'});}
  if(this.key.length!==32){const recovered=await this.tryRecovery();if(recovered)return this.init();throw new Error('Ungültiger Workspace-Schlüssel.');}
  let bytes;
  try{const info=await stat(join(this.directory,'workspace.enc'));if(info.size>MAX_SEALED_BYTES)throw new Error('Workspace überschreitet die erlaubte Größe. Originaldateien bleiben erhalten.');bytes=await readFile(join(this.directory,'workspace.enc'));}
  catch(error){if(error.code==='ENOENT')bytes=null;else throw error;}
  if(!bytes&&this.recoveryPointList?.length){const recovered=await this.tryRecovery();if(recovered)return this.init();}
  let migrated=false,candidate=this.data;
  if(bytes){
   try{candidate=JSON.parse(unseal(bytes,this.key).toString());}
   catch(error){const recovered=await this.tryRecovery();if(recovered)return this.init();throw new Error('Workspace konnte nicht entschlüsselt werden. Originaldateien bleiben erhalten.',{cause:error});}
   validateWorkspaceData(candidate);
   if(candidate.schema<WORKSPACE_SCHEMA){
    await this.createRecoveryPoint({reason:'migration'});
    const backup=join(this.directory,`workspace.enc.pre-schema-${WORKSPACE_SCHEMA}-${Date.now()}.bak`);
    try{await copyFile(join(this.directory,'workspace.enc'),backup,constants.COPYFILE_EXCL);await chmod(backup,0o600);}
    catch(error){if(error.code!=='EEXIST')throw new Error('Vor der Workspace-Migration konnte keine lokale Sicherung erstellt werden. Der bisherige Workspace bleibt unverändert.');}
    migrated=true;
   }
  }
  this.data=normalizeWorkspace(candidate);
  try{
   this.jobStore=await new JobStore(this.directory,this.key).init({workspaceGeneration:this.data._jobStoreGeneration});
   if(!this.jobStore.index.jobs.length&&this.data.jobs.length)await this.jobStore.migrateFromLegacy(this.data.jobs);
   if(this.lazyJobs){await this.jobStore.pruneExpired({retentionMs:this.data.settings.retentionDays*86400000});this.data.jobs=await this.jobStore.loadByStatuses(['queued','running','cancelling','awaiting_answers']);}
   else this.data.jobs=await this.jobStore.loadAll();
  }catch(error){if(error.code==='ERR_FOLIQUO_JOB_STORE_CORRUPT'){const recovered=await this.tryRecovery();if(recovered)return this.init();}throw error;}
  const jobsBeforePrune=this.data.jobs.length;
  let interruptedLearning=false;
  for(const entry of this.data.learning)if(entry.status==='analyzing'){entry.status='interrupted';entry.lastError='Die Analyse wurde durch einen Neustart unterbrochen. Gesicherte Seiten können ausdrücklich fortgesetzt werden.';entry.active=false;interruptedLearning=true;}
  this.prune();
  if(migrated||interruptedLearning||this.data.jobs.length!==jobsBeforePrune)await this.save();
  return this;
 }
 async tryRecovery(){if(this.recoveryAttempted)return false;this.recoveryAttempted=true;const point=await this.recoveryPoints.restoreLatest();if(point){this.recoveredFrom=point;this.recoveryPointList=await this.recoveryPoints.list();}return Boolean(point);}
 async createRecoveryPoint({reason='daily'}={}){await this.tail;try{await stat(join(this.directory,'workspace.enc'));}catch(error){if(error.code==='ENOENT')return null;throw error;}const point=await this.recoveryPoints.create({key:this.key,reason,generation:this.data?._jobStoreGeneration||null});this.recoveryPointList=await this.recoveryPoints.list();this.recoveryPointError=null;return point;}
 prune(){for(const [id,draft] of Object.entries(this.data.studioDrafts||{}))if(!this.data.sessions.some(([sessionId])=>sessionId===id)||draft.updatedAt<Date.now()-30*86400000)delete this.data.studioDrafts[id];const cutoff=Date.now()-this.data.settings.retentionDays*86400000;this.data.importBatches=this.data.importBatches.filter(batch=>(batch.updatedAt||batch.createdAt||0)>=cutoff);this.data.jobs=this.data.jobs.filter(j=>(j.finishedAt||j.createdAt)>=cutoff);this.data.usage=pruneUsage(this.data.usage);const useIndex=this.lazyJobs&&!this.replaceAllJobsOnSave,retainedJobs=new Set(this.pendingRestore?this.pendingRestore.retainedIds:useIndex?this.jobStore.listSummaries().filter(job=>job.status!=='expired').map(job=>job.id):this.data.jobs.filter(job=>job.status!=='expired').map(job=>job.id));this.data.glossary=this.data.glossary.filter(g=>g.scope!=='job'||retainedJobs.has(g.jobId));this.data.sessions=this.data.sessions.filter(([,s])=>s.expiresAt>Date.now());}
 async writeMetadata(snapshot){const target=join(this.directory,'workspace.enc'),temp=join(this.directory,`workspace.enc.tmp-${randomUUID()}`);try{await writeFile(temp,seal(Buffer.from(snapshot),this.key),{mode:0o600,flag:'wx'});await chmod(temp,0o600);await rename(temp,target);}catch(error){await rm(temp,{force:true}).catch(()=>{});throw error;}}
 async *restoreJobs(pending){for(let index=0;index<pending.count;index++){const bytes=await readFile(join(pending.directory,`job-${String(index).padStart(5,'0')}.json`));yield JSON.parse(bytes.toString());}}
 save(){this.data.schema=WORKSPACE_SCHEMA;const transactionId=randomUUID(),metadata={...this.data,jobs:[],_jobStoreGeneration:transactionId},snapshot=JSON.stringify(metadata),pending=this.pendingRestore,jobs=pending?this.restoreJobs(pending):this.data.jobs,replaceJobs=!this.lazyJobs||this.replaceAllJobsOnSave;if(Buffer.byteLength(snapshot)>MAX_BYTES)throw new Error('Lokales Archiv ist voll. Bitte ältere Einträge sichern und löschen.');const task=this.tail.catch(()=>{}).then(async()=>{let transaction;try{transaction=await this.jobStore?.commitJobs(jobs,{replace:replaceJobs,deferCleanup:true,transactionId});await this.writeMetadata(snapshot);}catch(error){await transaction?.rollback();if(pending===this.pendingRestore&&pending){this.pendingRestore=null;await rm(pending.directory,{recursive:true,force:true});}throw error;}this.data._jobStoreGeneration=transactionId;this.replaceAllJobsOnSave=false;await transaction?.commit().catch(()=>{});if(pending===this.pendingRestore&&pending){this.pendingRestore=null;await rm(pending.directory,{recursive:true,force:true});}try{this.recoveryPointError=null;const point=await this.recoveryPoints.create({key:this.key,reason:'daily',generation:transactionId});if(point)this.recoveryPointList=await this.recoveryPoints.list();}catch(error){this.recoveryPointError=error;}});this.tail=task;return task;}
 library(){const {templates,examples,glossary,profiles,settings}=this.data;const safeSettings={retentionDays:settings.retentionDays,provider:settings.provider||'chatgpt'},recovery={count:this.recoveryPointList?.length||0,maxPoints:7,maxBytes:4*1024*1024*1024,sameDisk:true,lastCreatedAt:this.recoveryPointList?.[0]?.createdAt||null,errorCode:this.recoveryPointError?(this.recoveryPointError.code||'unavailable'):null,recoveredAt:this.recoveredFrom?.createdAt||null};return {templates,examples:examples.map(({originals,...x})=>({...x,originalCount:originals?.length||0})),glossary,profiles,settings:safeSettings,storage:'AES-256-GCM · Schlüssel auf diesem Computer',recovery};}
 preferences(){const s=this.data.settings;return {locale:['en','de','ar'].includes(s.locale)?s.locale:'en',displayName:typeof s.displayName==='string'?s.displayName:'',introComplete:s.introComplete===true};}
 setPreferences(input={}){const locale=input.locale??this.data.settings.locale,name=input.displayName??this.data.settings.displayName,complete=input.introComplete??this.data.settings.introComplete;if(!['en','de','ar'].includes(locale))throw new Error('Unsupported interface language.');if(typeof name!=='string'||name.trim().length>80||/[\r\n\0]/.test(name))throw new Error('Please use a name of 80 characters or fewer.');if(typeof complete!=='boolean')throw new Error('Invalid intro status.');this.data.settings.locale=locale;this.data.settings.displayName=name.trim();this.data.settings.introComplete=complete;return this.preferences();}
 put(kind,input){if(!['templates','examples','glossary','profiles'].includes(kind))throw new Error('Unbekannte Sammlung.');const list=this.data[kind];if(list.length>=300&&!input.id)throw new Error('Maximal 300 Einträge je Sammlung.');const previous=input.id?list.find(x=>x.id===input.id):null;let entry={id:input.id||randomUUID(),name:string(input.name||'',120),updatedAt:Date.now(),version:(previous?.version||0)+1};if(!entry.name)throw new Error('Bitte einen Namen vergeben.');if(input.id&&!previous)throw new Error('Eintrag nicht gefunden.');
 if(['templates','profiles'].includes(kind)){entry={...entry,layout:layoutSettings(input.layout),confirmed:input.confirmed===true,documentType:string(input.documentType||'',120),targetLanguage:string(input.targetLanguage||'',50),formFields:formDefinitions(input.formFields||[]),fields:(input.fields||[]).slice(0,60).map(v=>string(v,120))};}
 if(kind==='examples'){if(input.approved!==true)throw new Error('Nur ausdrücklich freigegebene Beispiele speichern.');entry={...entry,approved:true,templateId:string(input.templateId||'',80),targetLanguage:string(input.targetLanguage||'Deutsch',50),documentType:string(input.documentType||'',120),sourceText:string(input.sourceText||'',20000),translation:string(input.translation,30000),originals:input.originals||[]};if(!entry.translation)throw new Error('Die geprüfte Übersetzung fehlt.');}
 if(kind==='glossary'){entry={...entry,source:string(input.source,300),target:string(input.target,300),targetLanguage:string(input.targetLanguage||'Deutsch',50),scope:input.scope==='job'?'job':'global',jobId:string(input.jobId||'',80),note:string(input.note||'',500)};if(!entry.source||!entry.target||entry.scope==='job'&&!entry.jobId)throw new Error('Begriff, Übersetzung und ggf. Auftrag angeben.');}
 const candidate=list.filter(x=>x.id!==entry.id).concat(entry);if(Buffer.byteLength(JSON.stringify({...this.data,jobs:[],[kind]:candidate}))>MAX_BYTES)throw new Error('Lokales Archiv ist voll. Bitte ältere Einträge sichern und löschen.');const i=list.findIndex(x=>x.id===entry.id);if(i<0)list.push(entry);else list[i]=entry;return entry;}
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
 backup(passphrase,jobs=this.data.jobs){
  if(typeof passphrase!=='string'||passphrase.length<12||passphrase.length>200)throw new Error('Backup-Passwort benötigt mindestens 12 Zeichen.');
  const salt=randomBytes(16),key=scryptSync(passphrase,salt,32),settings={...this.data.settings,apiProviders:{}};
  delete settings.usageBudgetConsentOnce;
  if(!Array.isArray(jobs))throw new Error('Backup job records must be an array.');
  const snapshot=Buffer.from(JSON.stringify({...this.data,jobs,settings,sessions:[]}));
  if(snapshot.length>MAX_BYTES)throw new Error('Lokales Archiv ist voll. Bitte ältere Aufträge löschen.');
  const bytes=Buffer.concat([Buffer.from('TOCRBACK1'),salt,seal(snapshot,key)]);
  if(bytes.length>MAX_LEGACY_BACKUP_BYTES)throw new Error('Backup überschreitet die erlaubte Größe.');
  return bytes;
 }
 backupStream(passphrase){
  if(typeof passphrase!=='string'||passphrase.length<12||passphrase.length>200)throw new Error('Backup-Passwort benötigt mindestens 12 Zeichen.');
  const salt=randomBytes(16),key=scryptSync(passphrase,salt,32),settings={...this.data.settings,apiProviders:{}};delete settings.usageBudgetConsentOnce;
  const {jobs:_jobs,sessions:_sessions,...data}=this.data;data.settings=settings;data.schema=WORKSPACE_SCHEMA;const workspace=this;
  return (async function*(){
   let size=BACKUP_V2.length+salt.length,count=0;
   yield Buffer.concat([BACKUP_V2,salt]);
   const emit=async function*(type,sequence,payload){if(payload.length>MAX_BACKUP_FRAME_BYTES)throw new Error('Ein Backup-Eintrag überschreitet die erlaubte Einzelgröße.');const frame=backupFrame(type,sequence,payload,key);size+=frame.length;if(size>MAX_STREAM_BACKUP_BYTES)throw new Error('Das Backup überschreitet die maximale Archivgröße.');yield frame;};
   yield* emit(1,0,Buffer.from(JSON.stringify(data)));
   const jobs=workspace.lazyJobs?workspace.jobStore.iterateJobs():_jobs||[];
   for await(const job of jobs){if(count>=10000)throw new Error('Das Backup enthält mehr Aufträge als unterstützt werden.');yield* emit(2,count+1,Buffer.from(JSON.stringify(job)));count++;}
   yield* emit(255,count+1,Buffer.from(JSON.stringify({jobs:count})));
  })();
 }
 restore(bytes,passphrase){
  if(!Buffer.isBuffer(bytes)||bytes.length>MAX_LEGACY_BACKUP_BYTES||bytes.length<58||bytes.subarray(0,9).toString()!=='TOCRBACK1')throw new Error('Ungültiges Backup.');
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
  this.replaceAllJobsOnSave=true;
  this.prune();
 }
 async restoreVersion2(path,staging,passphrase,{owner}={}){
  if(owner!==undefined&&(typeof owner!=='string'||owner.length>200))throw new Error('Restore owner is invalid.');
  const source=createReadStream(path),reader=new BackupFrameReader(source),preamble=await reader.read(BACKUP_V2.length+16);
  if(!preamble.subarray(0,BACKUP_V2.length).equals(BACKUP_V2))throw new Error('Ungültiges Backup.');
  const key=scryptSync(passphrase,preamble.subarray(BACKUP_V2.length),32);let metadata=null,totalJobs=0,retainedCount=0,expectedSequence=0,footer=false;
  const ids=new Set(),retainedIds=new Set(),retentionDays=30;
  try{
   for(;;){
    const header=await reader.read(9,{eof:true});if(!header)break;
    const type=header.readUInt8(0),sequence=header.readUInt32BE(1),length=header.readUInt32BE(5);
    if(sequence!==expectedSequence||length>MAX_BACKUP_FRAME_BYTES||footer)throw new Error('Backup frame order or size is invalid.');
    const iv=await reader.read(12),ciphertext=await reader.read(length),tag=await reader.read(16),payload=decryptBackupFrame(header,iv,ciphertext,tag,key);
    if(type===1){
     if(sequence!==0||metadata)throw new Error('Backup metadata frame is invalid.');
     try{metadata=JSON.parse(payload.toString());validateWorkspaceData({...metadata,jobs:[]});}catch{throw new Error('Ungültiger Backup-Inhalt. Der aktuelle Workspace bleibt unverändert.');}
     expectedSequence=1;
    }else if(type===2){
     if(!metadata||sequence===0||totalJobs>=10000)throw new Error('Backup job frame is invalid.');
     let job;try{job=JSON.parse(payload.toString());validateWorkspaceData({schema:metadata.schema,jobs:[job]});}catch{throw new Error('Ungültiger Backup-Auftrag. Der aktuelle Workspace bleibt unverändert.');}
     if(typeof job.id!=='string'||ids.has(job.id))throw new Error('Backup contains a missing or duplicate job id.');ids.add(job.id);totalJobs++;
     if(owner!==undefined)job.owner=owner;
     const cutoff=Date.now()-(metadata.settings?.retentionDays||retentionDays)*86400000;
     if((job.finishedAt||job.createdAt||0)>=cutoff){
      const jobBytes=Buffer.from(JSON.stringify(job)),jobPath=join(staging,`job-${String(retainedCount).padStart(5,'0')}.json`);
      await writeFile(jobPath,jobBytes,{mode:0o600,flag:'wx'});retainedIds.add(job.id);retainedCount++;
     }
     expectedSequence++;
    }else if(type===255){
     if(!metadata||sequence!==expectedSequence)throw new Error('Backup footer is invalid.');
     let footerData;try{footerData=JSON.parse(payload.toString());}catch{throw new Error('Backup footer is invalid.');}
     if(footerData.jobs!==totalJobs)throw new Error('Backup job count does not match its footer.');
     footer=true;expectedSequence++;
     if(!await reader.assertEnd())throw new Error('Backup has unexpected trailing data.');
     break;
    }else throw new Error('Unknown backup frame type.');
   }
   if(!metadata||!footer||!await reader.assertEnd())throw new Error('Backup is incomplete or has trailing data.');
  }finally{source.destroy();}
  const restored=normalizeWorkspace({...metadata,jobs:[]}),apiProviders=this.data.settings.apiProviders||{};
  restored.settings.apiProviders=apiProviders;delete restored.settings.usageBudgetConsentOnce;restored.sessions=this.data.sessions;
  this.data=restored;this.pendingRestore={directory:staging,count:retainedCount,retainedIds};this.replaceAllJobsOnSave=true;this.prune();
 }
 async restoreStream(source,passphrase,options={}){
  if(typeof passphrase!=='string'||passphrase.length<12||passphrase.length>200)throw new Error('Backup-Passwort benötigt mindestens 12 Zeichen.');
  if(this.pendingRestore)throw new Error('Eine geprüfte Wiederherstellung muss zuerst gespeichert werden.');
  await this.createRecoveryPoint({reason:'restore'});
  const staging=await mkdtemp(join(this.directory,'.restore-staging-')),path=join(staging,'backup.enc');let size=0,keepStaging=false;
  const previousData=this.data,previousPendingRestore=this.pendingRestore,previousReplaceAllJobsOnSave=this.replaceAllJobsOnSave;
  try{
   let prefix=Buffer.alloc(0),legacyFormat=null;
   await pipeline(source,new Transform({transform(chunk,encoding,callback){size+=chunk.length;if(legacyFormat===null){const needed=9-prefix.length;prefix=Buffer.concat([prefix,chunk.subarray(0,needed)]);if(prefix.length>=9){const magic=prefix.subarray(0,9).toString();if(magic!=='TOCRBACK1'&&magic!=='TOCRBACK2'){callback(new Error('Ungültiges Backup.'));return;}legacyFormat=magic==='TOCRBACK1';}}const limit=legacyFormat?MAX_LEGACY_BACKUP_BYTES:MAX_STREAM_BACKUP_BYTES;if(size>limit){callback(new Error(legacyFormat?'Die Sicherung im alten Format überschreitet 256 MiB.':'Das Backup überschreitet die maximale Archivgröße.'));return;}callback(null,chunk);}}),createWriteStream(path,{flags:'wx',mode:0o600}));
   const headerHandle=await open(path,constants.O_RDONLY);let header;try{header=Buffer.alloc(BACKUP_V2.length);await headerHandle.read(header,0,header.length,0);}finally{await headerHandle.close();}
   if(header.equals(BACKUP_V2)){
    await this.restoreVersion2(path,staging,passphrase,options);await unlink(path);keepStaging=true;
   }else{
    if(size>MAX_LEGACY_BACKUP_BYTES)throw new Error('Die Sicherung im alten Format überschreitet 256 MiB.');
    this.restore(await readFile(path),passphrase);
   }
  }finally{
   if(!keepStaging){
    await rm(staging,{recursive:true,force:true});
    if(this.pendingRestore?.directory===staging){this.data=previousData;this.pendingRestore=previousPendingRestore;this.replaceAllJobsOnSave=previousReplaceAllJobsOnSave;}
   }
  }
 }
}
