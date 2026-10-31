import {open,rename as renameFile} from 'node:fs/promises';
import {dirname} from 'node:path';

/**
 * Flushes a directory entry update after an atomic rename or unlink.
 * Windows does not expose portable directory handles through Node's fs API;
 * file contents are still synced before replacement on that platform.
 */
export async function syncDirectory(path){
 if(process.platform==='win32')return false;
 let handle;
 try{
  handle=await open(path,'r');
  await handle.sync();
  return true;
 }catch(error){
  if(['EINVAL','ENOTSUP','EOPNOTSUPP'].includes(error.code))return false;
  throw error;
 }finally{
  await handle?.close().catch(()=>{});
 }
}

export async function renameDurably(source,target,{rename,flushDirectory=syncDirectory}={}){
 await (rename||((from,to)=>renameFile(from,to)))(source,target);
 await flushDirectory(dirname(target));
}
