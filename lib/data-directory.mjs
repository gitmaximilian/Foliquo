import {homedir} from 'node:os';
import {join,resolve,isAbsolute,dirname,win32,posix,sep} from 'node:path';
import {mkdir,readdir,lstat,readFile,writeFile,chmod,mkdtemp,rename,rm,rmdir} from 'node:fs/promises';
import {createHash,createDecipheriv} from 'node:crypto';

export function dataDirectory({platform=process.platform,env=process.env,home=homedir()}={}) {
 const path=platform==='win32'?win32:posix;
 if(env.FOLIQUO_DATA_DIR){if(!path.isAbsolute(env.FOLIQUO_DATA_DIR))throw new Error('FOLIQUO_DATA_DIR must be an absolute path.');return path.normalize(env.FOLIQUO_DATA_DIR);}
 if(platform==='darwin')return path.join(home,'Library','Application Support','Foliquo');
 if(platform==='win32')return path.join(env.LOCALAPPDATA||path.join(home,'AppData','Local'),'Foliquo');
 if(env.XDG_DATA_HOME&&!path.isAbsolute(env.XDG_DATA_HOME))throw new Error('XDG_DATA_HOME must be an absolute path.');
 return path.join(env.XDG_DATA_HOME||path.join(home,'.local','share'),'foliquo');
}
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function exists(path){try{await lstat(path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
async function snapshot(root,prefix='') {
 const stat=await lstat(join(root,prefix));
 if(stat.isSymbolicLink()||(process.getuid&&stat.uid!==process.getuid()))throw new Error('Workspace must belong to this user and contain no symbolic links.');
 if(stat.isDirectory()){const entries=await readdir(join(root,prefix));const files=[];for(const name of entries.sort())files.push(...await snapshot(root,join(prefix,name)));return files;}
 if(!stat.isFile())throw new Error('Workspace contains an unsupported file.');
 return [{name:prefix,hash:digest(await readFile(join(root,prefix)))}];
}
async function verifyWorkspace(root) {
 const keyPath=join(root,'workspace.key'),encPath=join(root,'workspace.enc');
 if(await exists(encPath)){
  const key=await readFile(keyPath),bytes=await readFile(encPath);
  if(key.length!==32||bytes.subarray(0,5).toString()!=='TOCR1'||bytes.length<33)throw new Error('Invalid legacy workspace. Original files were preserved.');
  const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(5,17));decipher.setAuthTag(bytes.subarray(-16));
  const data=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(17,-16)),decipher.final()]).toString());
  if(data.schema!==1||!Array.isArray(data.jobs))throw new Error('Unsupported workspace schema.');
 }
 if(await exists(join(root,'chatgpt.json')))JSON.parse(await readFile(join(root,'chatgpt.json'),'utf8'));
}
export async function migrateWorkspace(source,target) {
 source=resolve(source);target=resolve(target);
 if(source===target||target.startsWith(source+sep)||source.startsWith(target+sep))throw new Error('Migration requires separate directories.');
 const files=await snapshot(source);if(!files.length)throw new Error('The migration source is empty.');
 await verifyWorkspace(source);
 await mkdir(dirname(target),{recursive:true,mode:0o700});
 const lock=target+'.migration-lock';await mkdir(lock,{mode:0o700}).catch(()=>{throw new Error('Another migration is running. If it was interrupted, inspect the migration lock before retrying.');});
 let stage;
 try {
  if(await exists(target)){if((await lstat(target)).isSymbolicLink()||(await readdir(target)).length)throw new Error('Destination already contains data. Select the existing workspace with --data-dir; migration never overwrites it.');}
  stage=await mkdtemp(join(dirname(target),'.foliquo-migrate-'));await chmod(stage,0o700);
  for(const file of files){const to=join(stage,file.name);await mkdir(dirname(to),{recursive:true,mode:0o700});await writeFile(to,await readFile(join(source,file.name)),{mode:0o600,flag:'wx'});}
  if(JSON.stringify(await snapshot(stage))!==JSON.stringify(files)||JSON.stringify(await snapshot(source))!==JSON.stringify(files))throw new Error('Workspace changed while copying. Stop the old Foliquo service and retry.');
  await verifyWorkspace(stage);
  await writeFile(join(stage,'migration.json'),JSON.stringify({source,createdAt:new Date().toISOString(),files}),{mode:0o600,flag:'wx'});
  if(await exists(target))await rmdir(target);
  await rename(stage,target);stage=null;
  return {migrated:true,fileCount:files.length};
 } finally {if(stage)await rm(stage,{recursive:true,force:true});await rmdir(lock);}
}
export async function prepareDataDirectory(root,{env=process.env,target=dataDirectory({env})}={}) {
 const legacy=join(root,'.local');
 if(!env.FOLIQUO_DATA_DIR&&await exists(legacy)&&(await readdir(legacy)).length){
  let alreadyMigrated=false;
  try{alreadyMigrated=JSON.parse(await readFile(join(target,'migration.json'),'utf8')).source===resolve(legacy);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(!alreadyMigrated)await migrateWorkspace(legacy,target);
 }
 if(await exists(target)){const stat=await lstat(target);if(stat.isSymbolicLink()||(process.getuid&&stat.uid!==process.getuid()))throw new Error('Data directory must belong to this user and must not be a symbolic link.');}
 await mkdir(target,{recursive:true,mode:0o700});await chmod(target,0o700);return target;
}
