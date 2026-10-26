import {readFile,mkdir,lstat,cp,rename,symlink,rm,readdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {dataDirectory} from '../lib/data-directory.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
if(process.platform!=='linux')throw new Error('This installer is for Linux.');
if(Number(process.versions.node.split('.')[0])<22)throw new Error('Install Node.js 22+ (24 LTS recommended) from your distribution or nodejs.org.');
const manifest=JSON.parse(await readFile(join(root,'distribution.json'),'utf8'));
if(manifest.application!=='foliquo'||manifest.platform!=='linux'||manifest.arch!==process.arch||!/^\d+\.\d+\.\d+$/.test(manifest.version))throw new Error('This archive does not match your platform.');
for(const [name,hash]of Object.entries(manifest.files)){
 if(name.includes('..')||name.includes('\\')||name.startsWith('/'))throw new Error('Unsafe distribution path.');
 const file=join(root,name),info=await lstat(file);
 if(!info.isFile()||createHash('sha256').update(await readFile(file)).digest('hex')!==hash)throw new Error('Distribution verification failed: '+name);
}
try{const service=JSON.parse(await readFile(join(dataDirectory(),'service.json'),'utf8'));try{process.kill(service.pid,0);throw new Error('Stop Foliquo before installing an update: foliquo stop');}catch(e){if(e.code!=='ESRCH')throw e;}}catch(e){if(e.code!=='ENOENT')throw e;}
const doctor=spawnSync(process.execPath,[join(root,'scripts/check-install.mjs')],{stdio:'inherit'});if(doctor.status!==0)process.exit(doctor.status||1);
const home=homedir(),base=join(home,'.local','share','foliquo-app'),destination=join(base,'versions',manifest.version),bin=join(home,'.local','bin');
await mkdir(dirname(destination),{recursive:true});await mkdir(bin,{recursive:true});
try{await lstat(destination);throw new Error('This version is already installed. Remove its application directory first if reinstalling. Your private data is separate.');}catch(e){if(e.code!=='ENOENT')throw e;}
const stage=destination+'.installing';await mkdir(stage);
try{
 for(const name of [...Object.keys(manifest.files),'distribution.json']){await mkdir(dirname(join(stage,name)),{recursive:true});await cp(join(root,name),join(stage,name));}
 await rename(stage,destination);
 const link=join(bin,'foliquo'),temporary=join(bin,'foliquo.new');
 try{const info=await lstat(link);if(!info.isSymbolicLink())throw new Error('An existing ~/.local/bin/foliquo file will not be replaced.');}catch(e){if(e.code!=='ENOENT')throw e;}
 await symlink(join(destination,'bin','foliquo.mjs'),temporary);await rename(temporary,link);
}finally{await rm(stage,{recursive:true,force:true});}
console.log('Installed Foliquo '+manifest.version+'. Run ~/.local/bin/foliquo (or foliquo if ~/.local/bin is on PATH).\nUpdates preserve your workspace; old application versions remain available for recovery.');
