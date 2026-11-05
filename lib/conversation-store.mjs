import {createHash,randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {lstat,readdir,readFile} from 'node:fs/promises';
import {SecureStore} from './secure-store.mjs';

export const MAX_CONVERSATIONS=20,MAX_CHAT_MESSAGES=200,MAX_CHAT_BYTES=1024*1024;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const states=['idle','queued','running','complete','interrupted_unknown','failed','cancelled'];
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function invalid(){throw Object.assign(new Error('Invalid encrypted Foli conversation.'),{code:'ERR_FOLI_CONTENT'});}
function text(value,max){if(typeof value!=='string'||value.length>max||value.includes('\0'))invalid();}
function number(value){if(!Number.isSafeInteger(value)||value<0)invalid();}
function fields(value,allowed){if(!plain(value)||Object.keys(value).some(key=>!allowed.includes(key)))invalid();}
function stale(){throw Object.assign(new Error('This Foli conversation changed. Reload its current version.'),{code:'ERR_FOLI_STALE'});}
export function conversationOwnerKey(owner){text(owner,200);return createHash('sha256').update(`foli-owner\0${owner}`).digest('hex');}
const ownerKey=conversationOwnerKey;
function notFound(){throw Object.assign(new Error('Foli conversation not found.'),{code:'ERR_FOLI_NOT_FOUND'});}

export function validateConversationIndex(entries=[]){
 if(!Array.isArray(entries)||entries.length>MAX_CONVERSATIONS)invalid();const seen=new Set();
 for(const entry of entries){
  fields(entry,['id','owner','recordId','title','version','createdAt','updatedAt','bytes','status','messageCount']);
  if(!UUID.test(entry.id)||seen.has(entry.id)||!/^foli-chat-[a-f0-9-]{36}$/.test(entry.recordId)||!/^[a-f0-9]{64}$/.test(entry.owner)||!states.includes(entry.status))invalid();seen.add(entry.id);
  text(entry.title,120);for(const key of ['version','createdAt','updatedAt','bytes','messageCount'])number(entry[key]);if(!entry.version||entry.bytes>MAX_CHAT_BYTES||entry.messageCount>MAX_CHAT_MESSAGES)invalid();
 }
 return entries;
}
export function validateConversation(record){
 fields(record,['schema','id','owner','title','version','createdAt','updatedAt','messages','turn']);
 if(record.schema!==1||!UUID.test(record.id)||!/^[a-f0-9]{64}$/.test(record.owner)||!Array.isArray(record.messages)||record.messages.length>MAX_CHAT_MESSAGES)invalid();
 text(record.title,120);for(const key of ['version','createdAt','updatedAt'])number(record[key]);if(!record.version)invalid();
 const ids=new Set();
 for(const message of record.messages){
  fields(message,['id','role','text','createdAt','source','proposalIds','requestId','provider','model']);
  if(!UUID.test(message.id)||ids.has(message.id)||!['user','assistant'].includes(message.role)||!['local','provider'].includes(message.source))invalid();ids.add(message.id);text(message.text,8000);number(message.createdAt);
  if(message.requestId!==undefined&&!UUID.test(message.requestId))invalid();
  if(message.provider!==undefined)text(message.provider,40);if(message.model!==undefined)text(message.model,180);
  if(message.proposalIds!==undefined&&(!Array.isArray(message.proposalIds)||message.proposalIds.length>20||message.proposalIds.some(id=>typeof id!=='string'||id.length>100)))invalid();
 }
 if(record.turn!==null){const turn=record.turn;fields(turn,['requestId','status','provider','model','startedAt','finishedAt','errorCode','error','usageId']);if(!UUID.test(turn.requestId)||!states.includes(turn.status))invalid();text(turn.provider,40);text(turn.model,180);number(turn.startedAt);if(turn.finishedAt!==null)number(turn.finishedAt);if(turn.error!==undefined)text(turn.error,500);if(turn.errorCode!==undefined)text(turn.errorCode,100);if(turn.usageId!==undefined)text(turn.usageId,100);}
 if(Buffer.byteLength(JSON.stringify(record))>MAX_CHAT_BYTES)throw new Error('This conversation is full. Start a new Foli chat.');return record;
}

/** Immutable encrypted chat records; only their bounded index enters metadata. */
export class ConversationStore{
 constructor(workspace){this.workspace=workspace;this.secure=new SecureStore(join(workspace.directory,'foli-chats'),workspace.key);this.tail=Promise.resolve();this.leases=new Map();this.pendingRemoval=new Set();this.recoveryErrors=new Map();}
 serial(operation){const task=this.tail.then(operation);this.tail=task.catch(()=>{});return task;}
 async init(){
  validateConversationIndex(this.workspace.data.foliConversations||[]);await this.secure.cleanupInterruptedWrites();
  const keep=new Set((this.workspace.data.foliConversations||[]).map(entry=>entry.recordId));
  let names;try{names=await readdir(join(this.secure.directory,'record'));}catch(error){if(error.code!=='ENOENT')throw error;return this;}
  for(const name of names)if(/^foli-chat-[a-f0-9-]{36}\.enc$/.test(name)&&!keep.has(name.slice(0,-4)))await this.secure.remove(name.slice(0,-4),'record');return this;
 }
 list(owner){const key=ownerKey(owner);return (this.workspace.data.foliConversations||[]).filter(entry=>entry.owner===key).map(({owner,recordId,bytes,...entry})=>({...entry,...(this.recoveryErrors.has(entry.id)?{status:'unavailable'}:{})})).sort((a,b)=>b.updatedAt-a.updatedAt);}
 entry(owner,id){if(!UUID.test(id))notFound();const entry=(this.workspace.data.foliConversations||[]).find(entry=>entry.id===id&&entry.owner===ownerKey(owner));if(!entry)notFound();return entry;}
 async readEntry(entry){
  const info=await lstat(this.secure.path(entry.recordId,'record'));if(info.size>MAX_CHAT_BYTES+36)invalid();
  const bytes=await this.secure.read(entry.recordId,'record'),record=validateConversation(JSON.parse(bytes.toString()));
  if(record.id!==entry.id||record.owner!==entry.owner||record.version!==entry.version||bytes.length!==entry.bytes)invalid();return record;
 }
 async read(owner,id){const entry=this.entry(owner,id);try{const record=await this.readEntry(entry);this.recoveryErrors.delete(id);return record;}catch(error){this.recoveryErrors.set(id,error.code||'ERR_FOLI_CONTENT');throw error;}}
 async dispose(recordId){if(this.leases.get(recordId)){this.pendingRemoval.add(recordId);return;}await this.secure.remove(recordId,'record').catch(()=>{});}
 retain(entries){
  for(const entry of entries)this.leases.set(entry.recordId,(this.leases.get(entry.recordId)||0)+1);
  let released=false;return async()=>{if(released)return;released=true;for(const entry of entries){const count=(this.leases.get(entry.recordId)||1)-1;if(count)this.leases.set(entry.recordId,count);else{this.leases.delete(entry.recordId);if(this.pendingRemoval.delete(entry.recordId))await this.dispose(entry.recordId);}}};
 }
 async commit(record,previous=null,{ruleOperation}={}){
  validateConversation(record);const bytes=Buffer.from(JSON.stringify(record)),recordId=`foli-chat-${randomUUID()}`,entry={id:record.id,owner:record.owner,title:record.title,recordId,version:record.version,createdAt:record.createdAt,updatedAt:record.updatedAt,bytes:bytes.length,messageCount:record.messages.length,status:record.turn?.status||'idle'};
  await this.secure.write(recordId,'record',bytes);
  try{
   await this.workspace.save({ruleOperation,conversationOperation:data=>{
    const current=data.foliConversations.find(item=>item.id===record.id);
    if(previous?(!current||current.recordId!==previous.recordId||current.version!==previous.version):Boolean(current))stale();
    const entries=[...data.foliConversations.filter(item=>item.id!==record.id),entry];validateConversationIndex(entries);data.foliConversations=entries;
   }});
  }catch(error){await this.secure.remove(recordId,'record').catch(()=>{});throw error;}
  if(previous)await this.dispose(previous.recordId);return structuredClone(record);
 }
 create(owner,title='Foli'){return this.serial(async()=>{text(title,120);const now=Date.now();return this.commit({schema:1,id:randomUUID(),owner:ownerKey(owner),title:title.trim()||'Foli',version:1,createdAt:now,updatedAt:now,messages:[],turn:null});});}
 update(owner,id,version,mutate,options={}){return this.serial(async()=>{const entry=this.entry(owner,id);if(entry.version!==version)stale();const record=await this.readEntry(entry),identity={id:record.id,owner:record.owner};const result=mutate(record);if(result&&typeof result.then==='function')invalid();if(record.id!==identity.id||record.owner!==identity.owner)invalid();record.version++;record.updatedAt=Date.now();return this.commit(record,entry,options);});}
 remove(owner,id,version){return this.serial(async()=>{const previous=this.entry(owner,id);if(previous.version!==version)stale();if(['queued','running'].includes(previous.status)&&!this.recoveryErrors.has(id))throw new Error('Cancel the running reply before deleting this chat.');await this.workspace.save({conversationOperation:data=>{const entry=data.foliConversations.find(item=>item.id===id);if(!entry||entry.recordId!==previous.recordId)stale();data.foliConversations=data.foliConversations.filter(item=>item.id!==id);}});await this.dispose(previous.recordId);this.recoveryErrors.delete(id);});}
 async prepareRestore(pending,expectedEntries){
  const created=[],entries=[];
  try{
   if(expectedEntries.length!==pending.conversationCount)invalid();
   for(let index=0;index<pending.conversationCount;index++){
    const record=validateConversation(JSON.parse(await readFile(join(pending.directory,`chat-${index}.json`),'utf8'))),expected=expectedEntries.find(entry=>entry.id===record.id);
    if(!expected||expected.owner!==record.owner||expected.version!==record.version)invalid();
    if(pending.owner!==undefined)record.owner=ownerKey(pending.owner);
    if(['queued','running'].includes(record.turn?.status)){record.turn.status='interrupted_unknown';record.turn.errorCode='BACKUP_RESTORED';record.turn.error='This reply came from a backup and must not restart automatically.';record.version++;record.updatedAt=Date.now();}
    const bytes=Buffer.from(JSON.stringify(record)),recordId=`foli-chat-${randomUUID()}`;await this.secure.write(recordId,'record',bytes);created.push(recordId);entries.push({...expected,owner:record.owner,version:record.version,updatedAt:record.updatedAt,recordId,bytes:bytes.length,status:record.turn?.status||'idle',messageCount:record.messages.length});
   }
   validateConversationIndex(entries);
   return {entries,rollback:async()=>{for(const id of created)await this.dispose(id);},commit:async()=>{for(const entry of pending.previousData?.foliConversations||[])await this.dispose(entry.recordId);}};
  }catch(error){for(const id of created)await this.dispose(id);throw error;}
 }
 async recoverInterrupted(){
  for(const entry of [...this.workspace.data.foliConversations||[]])if(['queued','running'].includes(entry.status))await this.serial(async()=>{const current=(this.workspace.data.foliConversations||[]).find(item=>item.id===entry.id);if(!current||!['queued','running'].includes(current.status))return;let record;try{record=await this.readEntry(current);}catch(error){this.recoveryErrors.set(entry.id,error.code||'ERR_FOLI_CONTENT');return;}record.turn.status='interrupted_unknown';record.turn.errorCode='PROCESS_INTERRUPTED';record.turn.error='The previous reply was interrupted. It may already have used quota. Retry only after explicit confirmation.';record.version++;record.updatedAt=Date.now();await this.commit(record,current);});
 }
}
