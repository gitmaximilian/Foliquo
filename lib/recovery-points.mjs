import {createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID} from 'node:crypto';
import {constants} from 'node:fs';
import {chmod,copyFile,lstat,mkdir,readdir,link,readFile,rename,rm,stat,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join} from 'node:path';

const FORMAT=Buffer.from('TOCR1');
const MAX_POINTS=7;
const MAX_BYTES=4*1024*1024*1024;
const ROOT_FILES=new Set(['workspace.key','workspace.enc']);
const STORE_DIRS=new Set(['record','original','working','export','checkpoint','recovery','backup']);
const POINT=/^\d{13}-[a-f0-9-]{36}$/;
const COPY_FALLBACK=new Set(['EXDEV','EPERM','EACCES','ENOTSUP','EMLINK','ENOSYS']);

function seal(bytes,key){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([FORMAT,iv,cipher.update(bytes),cipher.final(),cipher.getAuthTag()]);}
function unseal(bytes,key){if(bytes.length<33||!bytes.subarray(0,5).equals(FORMAT))throw new Error('Recovery metadata is invalid.');const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(5,17));decipher.setAuthTag(bytes.subarray(-16));try{return Buffer.concat([decipher.update(bytes.subarray(17,-16)),decipher.final()]);}catch{throw new Error('Recovery metadata authentication failed.');}}
async function ensurePrivateDirectory(path){await mkdir(path,{recursive:true,mode:0o700});const info=await lstat(path);if(info.isSymbolicLink()||!info.isDirectory())throw new Error('Recovery path must be a regular directory.');await chmod(path,0o700);}
function validRelative(path){if(typeof path!=='string'||path.includes('\\')||path.startsWith('/')||path.split('/').some(part=>!part||part==='.'||part==='..'))return false;const [first,...rest]=path.split('/');return ROOT_FILES.has(first)&&rest.length===0||STORE_DIRS.has(first)&&rest.length>0;}
async function digestFile(path){const hash=createHash('sha256');let bytes=0;for await(const chunk of createReadStream(path)){hash.update(chunk);bytes+=chunk.length;}return {bytes,sha256:hash.digest('hex')};}
async function walkFiles(root,base=''){
 const entries=[];let names;try{names=await readdir(join(root,base));}catch(error){if(error.code==='ENOENT')return entries;throw error;}
 for(const name of names){const rel=base?`${base}/${name}`:name;if(base===''&&!ROOT_FILES.has(name)&&!STORE_DIRS.has(name))continue;const path=join(root,...rel.split('/')),info=await lstat(path);if(info.isSymbolicLink())throw new Error('Recovery snapshot refuses symbolic links.');if(info.isDirectory())entries.push(...await walkFiles(root,rel));else if(info.isFile())entries.push({rel,path});else throw new Error('Recovery snapshot contains an unsupported filesystem entry.');}
 return entries;
}
async function uniqueBytes(root,names=null){let total=0;const seen=new Set();for(const point of names||await readdir(root)){if(!POINT.test(point))continue;const directory=join(root,point),files=await walkFiles(directory);files.push({path:join(directory,'state.enc')});for(const file of files){let info;try{info=await stat(file.path);}catch(error){if(error.code==='ENOENT')continue;throw error;}const key=info.ino?`${info.dev}:${info.ino}`:file.path;if(!seen.has(key)){seen.add(key);total+=info.size;}}}return total;}
async function points(root){const names=await readdir(root);const items=[];for(const name of names){if(!POINT.test(name))continue;const path=join(root,name),info=await lstat(path);if(info.isSymbolicLink()||!info.isDirectory())continue;items.push({id:name,path,mtime:info.mtimeMs});}return items.sort((a,b)=>a.id.localeCompare(b.id));}

/** Local encrypted snapshots of the committed workspace generation. */
export class RecoveryPointStore{
 constructor(workspaceDirectory){this.workspaceDirectory=workspaceDirectory;this.directory=join(workspaceDirectory,'.recovery-points');}
 async init(){await ensurePrivateDirectory(this.directory);for(const name of await readdir(this.directory)){if(!/^\.pending-[a-f0-9-]{36}$/.test(name))continue;const path=join(this.directory,name);const info=await lstat(path);if(info.isDirectory()&&!info.isSymbolicLink())await rm(path,{recursive:true,force:true});}return this;}
 async resumeInterrupted(){const marker=join(this.workspaceDirectory,'.recovery-restore.pending');let info;try{info=await lstat(marker);}catch(error){if(error.code==='ENOENT')return null;throw error;}if(info.isSymbolicLink()||!info.isFile())throw new Error('Recovery transaction marker is invalid.');let state;try{state=JSON.parse((await readFile(marker)).toString());}catch{throw new Error('Recovery transaction marker is invalid.');}if(state?.schema!==1||!Number.isSafeInteger(state.startedAt))throw new Error('Recovery transaction marker is invalid.');const recovered=await this.restoreLatest();if(!recovered)throw new Error('An interrupted local recovery could not be resumed.');return recovered;}
 async create({key,reason='daily',generation=null,now=Date.now()}={}){
  if(!Buffer.isBuffer(key)||key.length!==32)throw new Error('A valid workspace key is required for recovery.');
  if(!['daily','migration','restore','manual'].includes(reason))throw new Error('Invalid recovery point reason.');
  if(!Number.isSafeInteger(now)||now<0)throw new Error('Invalid recovery point time.');
  await this.init();
  const existing=await points(this.directory);
  if(reason==='daily'&&existing.some(item=>now>=item.mtime&&now-item.mtime<24*60*60*1000))return null;
  const id=`${String(now).padStart(13,'0')}-${randomUUID()}`,pending=join(this.directory,`.pending-${randomUUID()}`),target=join(this.directory,id);
  await mkdir(pending,{mode:0o700});const files=[];
  try{
   const sourceFiles=await walkFiles(this.workspaceDirectory);
   if(!sourceFiles.some(file=>file.rel==='workspace.key')||!sourceFiles.some(file=>file.rel==='workspace.enc'))throw new Error('A recovery point requires a committed workspace and key.');
   for(const source of sourceFiles){if(!validRelative(source.rel))throw new Error('Recovery snapshot contains an unsafe path.');const destination=join(pending,...source.rel.split('/'));await ensurePrivateDirectory(join(destination,'..'));const info=await lstat(source.path);if(info.isSymbolicLink()||!info.isFile())throw new Error('Recovery snapshot source must be a regular file.');try{await link(source.path,destination);}catch(error){if(!COPY_FALLBACK.has(error.code))throw error;await copyFile(source.path,destination,constants.COPYFILE_EXCL);await chmod(destination,0o600);}const digest=await digestFile(destination);files.push({path:source.rel,...digest});}
   files.sort((a,b)=>a.path.localeCompare(b.path));const manifest={schema:1,id,createdAt:now,reason,generation,files};await writeFile(join(pending,'state.enc'),seal(Buffer.from(JSON.stringify(manifest)),key),{flag:'wx',mode:0o600});await chmod(pending,0o700);await rename(pending,target);
   const pointBytes=await uniqueBytes(this.directory,[id]);if(pointBytes>MAX_BYTES){await rm(target,{recursive:true,force:true});throw new Error('This recovery point exceeds the 4 GiB local storage budget; previous points were kept.');}
   const committed=await points(this.directory);let bytes=await uniqueBytes(this.directory),older=committed.filter(item=>item.id!==id);
   while(committed.length>MAX_POINTS||bytes>MAX_BYTES){const oldest=older.shift();if(!oldest)break;await rm(oldest.path,{recursive:true,force:true});committed.splice(committed.findIndex(item=>item.id===oldest.id),1);bytes=await uniqueBytes(this.directory);}
   if(bytes>MAX_BYTES)throw new Error('Recovery points exceed the 4 GiB local storage budget; the new point is retained.');
   return {id,createdAt:now,reason,generation,files:files.length,bytes};
  }catch(error){await rm(pending,{recursive:true,force:true}).catch(()=>{});throw error;}
 }
 async list(){await this.init();const output=[];for(const point of await points(this.directory)){try{const key=await readFile(join(point.path,'workspace.key'));const manifest=JSON.parse(unseal(await readFile(join(point.path,'state.enc')),key).toString());if(manifest.schema!==1||manifest.id!==point.id||!Array.isArray(manifest.files))continue;output.push({id:point.id,createdAt:manifest.createdAt,reason:manifest.reason,generation:manifest.generation,files:manifest.files.length,bytes:manifest.files.reduce((sum,file)=>sum+file.bytes,0)});}catch{continue;}}return output.reverse();}
 async restoreLatest(){
  await this.init();const candidates=(await points(this.directory)).reverse();
  for(const point of candidates){let stage;
   try{
    const key=await readFile(join(point.path,'workspace.key'));if(key.length!==32)continue;
    const manifest=JSON.parse(unseal(await readFile(join(point.path,'state.enc')),key).toString());
    if(manifest.schema!==1||manifest.id!==point.id||!Array.isArray(manifest.files)||!manifest.files.length)continue;
    for(const file of manifest.files){if(!validRelative(file.path)||!Number.isSafeInteger(file.bytes)||file.bytes<0||!/^[a-f0-9]{64}$/.test(file.sha256))throw new Error('Recovery file list is invalid.');const path=join(point.path,...file.path.split('/')),info=await lstat(path);if(info.isSymbolicLink()||!info.isFile())throw new Error('Recovery snapshot contains a non-regular file.');const digest=await digestFile(path);if(digest.bytes!==file.bytes||digest.sha256!==file.sha256)throw new Error('Recovery snapshot integrity check failed.');}
    stage=join(this.workspaceDirectory,`.recovery-restore-${randomUUID()}`);await mkdir(stage,{mode:0o700});
    for(const file of manifest.files){const source=join(point.path,...file.path.split('/')),target=join(stage,...file.path.split('/'));await ensurePrivateDirectory(join(target,'..'));await copyFile(source,target,constants.COPYFILE_EXCL);await chmod(target,0o600);}
    const marker=join(this.workspaceDirectory,'.recovery-restore.pending');try{await lstat(marker);}catch(error){if(error.code!=='ENOENT')throw error;const temp=join(this.workspaceDirectory,`.recovery-restore-state.tmp-${randomUUID()}`);await writeFile(temp,JSON.stringify({schema:1,startedAt:Date.now()}),{flag:'wx',mode:0o600});await rename(temp,marker);}
    const directories=[...STORE_DIRS];
    for(const name of directories){const source=join(stage,name);try{const info=await lstat(source);if(info.isSymbolicLink()||!info.isDirectory())throw new Error('Recovery staging entry is invalid.');}catch(error){if(error.code==='ENOENT')continue;throw error;}const target=join(this.workspaceDirectory,name);await rm(target,{recursive:true,force:true});await rename(source,target);}
    for(const name of ['workspace.key','workspace.enc']){const source=join(stage,name);try{await lstat(source);}catch(error){if(error.code==='ENOENT')continue;throw error;}const target=join(this.workspaceDirectory,name);await rm(target,{force:true});await rename(source,target);}
    await rm(marker,{force:true});return {id:point.id,createdAt:manifest.createdAt,reason:manifest.reason};
   }catch{ /* Try the next older fully authenticated recovery point. */ }
   finally{if(stage)await rm(stage,{recursive:true,force:true}).catch(()=>{});}
  }
  return null;
 }
}
