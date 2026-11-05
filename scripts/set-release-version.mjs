import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const root=fileURLToPath(new URL('..',import.meta.url)),requested=process.argv[2];
const paths=['package.json','package-lock.json','desktop/src-tauri/tauri.conf.json'];
const json=await Promise.all(paths.map(async path=>JSON.parse(await readFile(join(root,path),'utf8'))));
const cargoPath=join(root,'desktop/src-tauri/Cargo.toml'),lockPath=join(root,'desktop/src-tauri/Cargo.lock'),cargo=await readFile(cargoPath,'utf8'),lock=await readFile(lockPath,'utf8');
const versions=[json[0].version,json[1].version,json[1].packages[''].version,json[2].version,cargo.match(/^version = "([^"]+)"/m)?.[1],lock.match(/name = "foliquo-desktop"\r?\nversion = "([^"]+)"/)?.[1]];
if(versions.some(version=>version!==versions[0]))throw new Error('Release version metadata is inconsistent.');
if(requested==='--check'){console.log(JSON.stringify({version:versions[0],consistent:true}));}
else{
 if(!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(requested||'')||requested.split('.').some(part=>Number(part)>65535))throw new Error('Use a plain numeric release version.');
 json[0].version=requested;json[1].version=requested;json[1].packages[''].version=requested;json[2].version=requested;
 for(let index=0;index<paths.length;index++)await writeFile(join(root,paths[index]),JSON.stringify(json[index],null,2)+'\n');
 await writeFile(cargoPath,cargo.replace(/^version = "[^"]+"/m,`version = "${requested}"`));
 await writeFile(lockPath,lock.replace(/(name = "foliquo-desktop"\r?\nversion = ")[^"]+("\r?\n)/,(_,prefix,suffix)=>prefix+requested+suffix));
 console.log(JSON.stringify({previous:versions[0],version:requested,consistent:true}));
}
