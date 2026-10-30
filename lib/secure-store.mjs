import {createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto';
import {constants} from 'node:fs';
import {chmod,lstat,mkdir,open,readFile,readdir,rename,unlink} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join} from 'node:path';

const MAGIC=Buffer.from('FQOBJ1\r\n');
const TYPES=new Set(['record','original','working','export','checkpoint','recovery','backup']);
const ID=/^[A-Za-z0-9_-]{16,80}$/;

function validate(id,type,key){
 if(!ID.test(id))throw new Error('Invalid secure object id.');
 if(!TYPES.has(type))throw new Error('Invalid secure object type.');
 if(!Buffer.isBuffer(key)||key.length!==32)throw new Error('Invalid workspace key.');
}
function associatedData(id,type){return Buffer.from(JSON.stringify({format:1,id,type}));}
async function privateEntries(path){try{const info=await lstat(path);if(info.isSymbolicLink()||!info.isDirectory())throw new Error('Secure staging path is not a regular directory.');return await readdir(path);}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function privateDirectory(path){
 await mkdir(path,{recursive:true,mode:0o700});
 const info=await lstat(path);
 if(info.isSymbolicLink()||!info.isDirectory())throw new Error('Secure object directory is not a private directory.');
 await chmod(path,0o700);
}

/** Encrypted, atomically replaced per-object storage for a local workspace. */
export class SecureStore {
 constructor(directory,key){this.directory=directory;this.key=key;}
 path(id,type){validate(id,type,this.key);return join(this.directory,type,`${id}.enc`);}
 async cleanupInterruptedWrites(){
  for(const type of TYPES){const directory=join(this.directory,type),names=await privateEntries(directory);if(!names)continue;for(const name of names){if(!/^\.[a-f0-9-]{36}\.tmp$/.test(name))continue;const path=join(directory,name);try{const info=await lstat(path);if(info.isFile()&&!info.isSymbolicLink())await unlink(path);}catch(error){if(error.code!=='ENOENT')throw error;}}}
  const staging=join(this.directory,'staging'),names=await privateEntries(staging);if(!names)return;
  for(const name of names){if(!/^\.[a-f0-9-]{36}\.plain\.tmp$/.test(name))continue;const path=join(staging,name);try{const info=await lstat(path);if(info.isFile()&&!info.isSymbolicLink())await unlink(path);}catch(error){if(error.code!=='ENOENT')throw error;}}
 }
 async write(id,type,source){
  const target=this.path(id,type),directory=join(this.directory,type);await privateDirectory(this.directory);await privateDirectory(directory);
  const temp=join(directory,`.${randomUUID()}.tmp`),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv);cipher.setAAD(associatedData(id,type));
  let handle;
  try{
   handle=await open(temp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|(constants.O_NOFOLLOW||0),0o600);
   await handle.writeFile(Buffer.concat([MAGIC,iv]));
   const chunks=Buffer.isBuffer(source)||source instanceof Uint8Array?[source]:(async function*(){for await(const chunk of source){if(!(Buffer.isBuffer(chunk)||chunk instanceof Uint8Array))throw new Error('Secure object source must provide bytes.');yield chunk;}})();
   for await(const chunk of chunks){const encrypted=cipher.update(chunk);if(encrypted.length)await handle.writeFile(encrypted);}
   const final=cipher.final();if(final.length)await handle.writeFile(final);await handle.writeFile(cipher.getAuthTag());await handle.sync();await handle.close();handle=null;
   await rename(temp,target);
   return {id,type,path:target};
  }catch(error){if(handle)await handle.close().catch(()=>{});await unlink(temp).catch(()=>{});throw error;}
 }
 async read(id,type){
  const path=this.path(id,type),info=await lstat(path);
  if(info.isSymbolicLink()||!info.isFile())throw new Error('Secure object is not a regular file.');
  if(info.size<MAGIC.length+12+16)throw new Error('Secure object is incomplete.');
  const bytes=await readFile(path);
  if(!bytes.subarray(0,MAGIC.length).equals(MAGIC))throw new Error('Unsupported secure object format.');
  const decipher=createDecipheriv('aes-256-gcm',this.key,bytes.subarray(MAGIC.length,MAGIC.length+12));decipher.setAAD(associatedData(id,type));decipher.setAuthTag(bytes.subarray(-16));
  try{return Buffer.concat([decipher.update(bytes.subarray(MAGIC.length+12,-16)),decipher.final()]);}
  catch{throw new Error('Secure object authentication failed.');}
 }
 /**
  * Decrypts large objects into a short-lived private staging file, verifies the
  * GCM tag, then calls the consumer. Unauthenticated plaintext is never handed
  * to the consumer; the staging file is removed even when it throws.
  */
 async withDecryptedObject(id,type,consume){
  if(typeof consume!=='function')throw new Error('A secure object consumer is required.');
  const path=this.path(id,type),info=await lstat(path);
  if(info.isSymbolicLink()||!info.isFile())throw new Error('Secure object is not a regular file.');
  if(info.size<MAGIC.length+12+16)throw new Error('Secure object is incomplete.');
  const staging=join(this.directory,'staging');await privateDirectory(staging);const temp=join(staging,`.${randomUUID()}.plain.tmp`);
  let output,source;
  try{
   output=await open(temp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|(constants.O_NOFOLLOW||0),0o600);
   source=createReadStream(path,{flags:constants.O_RDONLY|(constants.O_NOFOLLOW||0)});
   const iterator=source[Symbol.asyncIterator]();let prefix=Buffer.alloc(0),done=false;
   while(prefix.length<MAGIC.length+12){const next=await iterator.next();if(next.done){done=true;break;}prefix=Buffer.concat([prefix,next.value]);}
   if(done||prefix.length<MAGIC.length+12||!prefix.subarray(0,MAGIC.length).equals(MAGIC))throw new Error('Secure object header is invalid.');
   const decipher=createDecipheriv('aes-256-gcm',this.key,prefix.subarray(MAGIC.length,MAGIC.length+12));decipher.setAAD(associatedData(id,type));
   let tail=Buffer.alloc(0);
   const decryptChunk=async chunk=>{const combined=tail.length?Buffer.concat([tail,chunk]):chunk;if(combined.length<=16){tail=combined;return;}const split=combined.length-16,clear=decipher.update(combined.subarray(0,split));if(clear.length)await output.writeFile(clear);tail=combined.subarray(split);};
   await decryptChunk(prefix.subarray(MAGIC.length+12));
   if(!done)for(;;){const next=await iterator.next();if(next.done)break;await decryptChunk(next.value);}
   if(tail.length!==16)throw new Error('Secure object is incomplete.');
   decipher.setAuthTag(tail);
   let final;try{final=decipher.final();}catch{throw new Error('Secure object authentication failed.');}
   if(final.length)await output.writeFile(final);await output.sync();await output.close();output=null;
   return await consume(temp);
  }finally{
   source?.destroy();if(output)await output.close().catch(()=>{});await unlink(temp).catch(()=>{});
  }
 }
 async remove(id,type){const path=this.path(id,type);try{const info=await lstat(path);if(info.isSymbolicLink()||!info.isFile())throw new Error('Secure object is not a regular file.');await unlink(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
}
