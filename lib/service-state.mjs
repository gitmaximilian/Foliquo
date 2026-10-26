import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
export async function acquireServiceLock(directory) {
 const lock=join(directory,'service.lock');
 try{await mkdir(lock,{mode:0o700});}catch(e){
  if(e.code!=='EEXIST')throw e;
  let owner;try{owner=JSON.parse(await readFile(join(lock,'owner.json'),'utf8'));}catch{throw new Error('Incomplete service.lock. Confirm Foliquo is stopped before removing this lock directory.');}
  if(!Number.isInteger(owner.pid)||owner.pid<1)throw new Error('Invalid service lock.');
  try{process.kill(owner.pid,0);throw new Error('Foliquo already uses this workspace. Open the existing browser window or stop the old service.');}catch(error){if(error.code!=='ESRCH')throw error;}
  await rm(lock,{recursive:true});await mkdir(lock,{mode:0o700});
 }
 await writeFile(join(lock,'owner.json'),JSON.stringify({pid:process.pid}),{mode:0o600,flag:'wx'});
 return ()=>rm(lock,{recursive:true,force:true});
}
