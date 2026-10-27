import {cp,mkdir,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPackage} from './package-release.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const generated=join(root,'desktop/generated');
const stage=join(root,'.packaging',`${process.platform}-${process.arch}`);
const pinned=(await readFile(join(root,'.node-version'),'utf8')).trim();
if(process.versions.node!==pinned)throw new Error(`Desktop packages require official Node ${pinned}.`);
if(process.config.variables.node_shared_openssl)throw new Error('Use official portable Node, not a shared-library build.');
if(!['darwin','win32','linux'].includes(process.platform))throw new Error('Unsupported desktop platform.');
await buildPackage({stage,output:join(root,'release-desktop/intermediate')});
await rm(generated,{recursive:true,force:true});
await mkdir(generated,{recursive:true});
await cp(stage,join(generated,'service'),{recursive:true});
if(process.platform==='linux'){
 const service=join(generated,'service');
 await mkdir(join(service,'runtime'),{recursive:true});
 await cp(process.execPath,join(service,'runtime/node'));
 await cp(resolve(process.execPath,'../../LICENSE'),join(service,'runtime/LICENSE'));
}
const office=join(generated,'office');
await mkdir(office,{recursive:true});
if(process.platform==='darwin'){
 const source='/Applications/LibreOffice.app';
 await stat(join(source,'Contents/MacOS/soffice'));
 await cp(source,join(office,'LibreOffice.app'),{recursive:true,dereference:true});
}else if(process.platform==='win32'){
 const source=join(process.env.ProgramFiles||'C:\\Program Files','LibreOffice');
 await stat(join(source,'program/soffice.exe'));
 await cp(source,join(office,'LibreOffice'),{recursive:true,dereference:true});
}else{
 const source='/usr/lib/libreoffice';
 await stat(join(source,'program/soffice'));
 await cp(source,join(office,'libreoffice'),{recursive:true,dereference:true});
 await cp('/usr/share/libreoffice',join(office,'share'),{recursive:true,dereference:true});
 await cp('/usr/share/doc/libreoffice-common/copyright',join(office,'LIBREOFFICE-COPYRIGHT'));
}
await writeFile(join(office,'SOURCE-AND-LICENSE.txt'),'LibreOffice Writer is distributed under its upstream licenses. See the included LICENSE/NOTICE files and https://www.libreoffice.org/about-us/licenses/ . Source downloads: https://www.libreoffice.org/download/ .\n');
console.log(`Prepared Foliquo desktop resources for ${process.platform}/${process.arch}.`);
