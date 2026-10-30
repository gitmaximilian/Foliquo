import {createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto';
import {constants} from 'node:fs';
import {chmod,lstat,mkdir,open,readFile,rename,unlink} from 'node:fs/promises';
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
 async remove(id,type){const path=this.path(id,type);try{const info=await lstat(path);if(info.isSymbolicLink()||!info.isFile())throw new Error('Secure object is not a regular file.');await unlink(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
}
