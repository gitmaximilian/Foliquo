import {cp,mkdir,rm,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {findOffice} from '../lib/formats.mjs';

if(Number(process.versions.node.split('.')[0])<22)throw new Error('Der Desktop-Build benötigt Node.js 22 oder neuer.');
const root=fileURLToPath(new URL('..',import.meta.url));
const resources=join(root,'build','required','libreoffice');
const platform=process.platform;
await rm(resources,{recursive:true,force:true});
await mkdir(resources,{recursive:true});

if(platform==='win32'){
 const office=await findOffice();
 await cp(dirname(dirname(office)),join(resources),{recursive:true});
}else if(platform==='darwin'){
 const office=await findOffice();
 const match=office.match(/(.+?\/LibreOffice(?:Dev)?\.app)\/Contents\/MacOS\/soffice$/);
 if(!match)throw new Error('LibreOffice.app konnte nicht als vollständiges macOS-Paket gefunden werden.');
 await cp(match[1],join(resources,'LibreOffice.app'),{recursive:true});
}else{
 // Linux packages declare LibreOffice Writer as an installer-managed dependency.
 // The build host does not need LibreOffice installed to create those packages.
 await writeFile(join(resources,'.keep'),'');
}

const target=platform==='win32'?'--win':platform==='darwin'?'--mac':'--linux';
const executable=platform==='win32'?'npx.cmd':'npx';
const result=spawnSync(executable,['electron-builder',target,'--publish','never'],{cwd:root,stdio:'inherit',shell:platform==='win32'});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status||1);
console.log(`Desktop-Pakete erstellt. Installer liegen unter ${join(root,'release-desktop')}.`);
