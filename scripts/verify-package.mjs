import {readFile,readdir,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(process.argv[2]||'.');
const manifest=JSON.parse(await readFile(join(root,'distribution.json'),'utf8'));
if(manifest.application!=='foliquo'||!/^\d+\.\d+\.\d+$/.test(manifest.version))throw new Error('Invalid distribution manifest.');
async function files(prefix=''){const all=[];for(const name of await readdir(join(root,prefix))){const rel=prefix?prefix+'/'+name:name,stat=await lstat(join(root,rel));if(stat.isSymbolicLink())throw new Error('Symlink in distribution.');if(stat.isDirectory())all.push(...await files(rel));else if(stat.isFile())all.push(rel);else throw new Error('Special file in distribution.');}return all;}
const names=(await files()).filter(n=>n!=='distribution.json').sort();
if(JSON.stringify(names)!==JSON.stringify(Object.keys(manifest.files).sort()))throw new Error('Distribution has missing or unexpected files.');
for(const name of names){if(name.startsWith('/')||name.includes('..')||name.includes('\\'))throw new Error('Invalid distribution path.');if(createHash('sha256').update(await readFile(join(root,name))).digest('hex')!==manifest.files[name])throw new Error('Hash mismatch: '+name);}
for(const name of ['LICENSE','THIRD-PARTY.md','INSTALL.md','bin/foliquo.mjs','server.mjs'])if(!manifest.files[name])throw new Error('Required file missing: '+name);
if(process.platform!=='win32'&&!((await lstat(join(root,'bin/foliquo.mjs'))).mode&0o111))throw new Error('CLI is not executable.');
console.log(`Verified ${names.length} files: Foliquo ${manifest.version}, ${manifest.platform}/${manifest.arch}.`);
