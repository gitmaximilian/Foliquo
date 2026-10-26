// Curated distributions: project inputs are explicitly listed; npm supplies locked production dependencies.
import {readFile,writeFile,mkdir,rm,cp,readdir,lstat,chmod} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {join,resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CURRENT_VERSION} from '../lib/version.mjs';
export const root=fileURLToPath(new URL('..',import.meta.url));
export const applicationInputs=['bin','lib','dist','server.mjs','package.json','package-lock.json','LICENSE','scripts/check-install.mjs','scripts/install-linux.mjs','docs/BROWSER-SETUP.md','docs/THIRD-PARTY.md'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function listFiles(directory,prefix='') {
 const files=[];
 for(const entry of await readdir(join(directory,prefix),{withFileTypes:true})){
  const name=join(prefix,entry.name),info=await lstat(join(directory,name));
  if(info.isSymbolicLink()){
   // npm's executable links are unnecessary at runtime; reject any other link.
   if(name.split(/[\\/]/).includes('.bin'))continue;
   throw new Error('Distribution contains a symbolic link: '+name);
  }
  if(info.isDirectory())files.push(...await listFiles(directory,name));else if(info.isFile())files.push(name.replaceAll('\\','/'));else throw new Error('Unsupported distribution entry.');
 }
 return files.sort();
}
export async function buildPackage({output=join(root,'release'),stage=join(root,'.packaging',`${process.platform}-${process.arch}`)}={}) {
 if(!['darwin','linux','win32'].includes(process.platform)||!['arm64','x64'].includes(process.arch))throw new Error('Unsupported build platform.');
 // Never delete caller-controlled directories: the stage is restricted to this project's build tree.
 if(!resolve(stage).startsWith(join(root,'.packaging')+sep))throw new Error('Stage must be inside .packaging.');
 await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true});await mkdir(output,{recursive:true});
 for(const name of applicationInputs){const target=name==='docs/BROWSER-SETUP.md'?'INSTALL.md':name==='docs/THIRD-PARTY.md'?'THIRD-PARTY.md':name;await mkdir(join(stage,target,'..'),{recursive:true});await cp(join(root,name),join(stage,target),{recursive:true});}
 const npm=spawnSync(process.platform==='win32'?'cmd.exe':'npm',process.platform==='win32'?['/d','/s','/c','npm.cmd ci --omit=dev --ignore-scripts --no-audit --no-fund']:['ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],{cwd:stage,stdio:'inherit'});
 if(npm.status!==0)throw new Error('Production dependency installation failed.');
 await rm(join(stage,'node_modules','.bin'),{recursive:true,force:true});
 if(process.platform==='linux'){await cp(join(root,'packaging/linux/install.sh'),join(stage,'install.sh'));await chmod(join(stage,'install.sh'),0o755);}
 if(process.platform==='win32'||process.platform==='darwin'){
  const pinned=(await readFile(join(root,'.node-version'),'utf8')).trim();if(process.versions.node!==pinned)throw new Error('Build with the exact Node version in .node-version.');
  if(process.config.variables.node_shared_openssl)throw new Error('A portable official Node.js distribution is required; do not bundle a Homebrew/shared-library runtime.');
  await mkdir(join(stage,'runtime'));await cp(process.execPath,join(stage,'runtime',process.platform==='win32'?'node.exe':'node'));
  if(process.platform!=='win32')await chmod(join(stage,'runtime','node'),0o755);
  // Include the official Node distribution's complete license, including bundled components.
  await cp(process.platform==='win32'?join(process.execPath,'..','LICENSE'):join(process.execPath,'..','..','LICENSE'),join(stage,'runtime','LICENSE'));
 }
 if(process.platform==='win32'){
  await cp(join(root,'packaging/windows/WINDOWS-INSTALL.txt'),join(stage,'WINDOWS-INSTALL.txt'));
  const compiler=join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe');
  const assemblyInfo=join(root,'.packaging','Foliquo.AssemblyInfo.cs');
  await writeFile(assemblyInfo,`using System.Reflection;\n[assembly: AssemblyVersion("${CURRENT_VERSION}.0")]\n[assembly: AssemblyFileVersion("${CURRENT_VERSION}.0")]\n[assembly: AssemblyInformationalVersion("${CURRENT_VERSION}")]\n`);
  const compiled=spawnSync(compiler,['/nologo','/target:exe','/out:'+join(stage,'Foliquo.exe'),'/win32icon:'+join(root,'dist/brand/community/favicons/favicon.ico'),join(root,'packaging/windows/Foliquo.cs'),assemblyInfo],{stdio:'inherit'});
  if(compiled.status!==0)throw new Error('Windows launcher compilation failed.');
 }
 await chmod(join(stage,'bin','foliquo.mjs'),0o755);
 const files=await listFiles(stage),checksums={};
 for(const name of files){if(/(^|\/)(\.local|\.git|\.env|outputs|tests|benchmarks|service\.json)(\/|$)/.test(name)||/TranslateOCR/.test(name))throw new Error('Forbidden distribution path: '+name);checksums[name]=hash(await readFile(join(stage,name)));}
 await writeFile(join(stage,'distribution.json'),JSON.stringify({application:'foliquo',version:CURRENT_VERSION,platform:process.platform,arch:process.arch,node:process.versions.node,files:checksums},null,2)+'\n');
 const smoke=spawnSync(process.execPath,['--input-type=module','-e',"import sharp from 'sharp'; await sharp({create:{width:1,height:1,channels:3,background:'white'}}).png().toBuffer(); await import('./server.mjs');"],{cwd:stage,stdio:'inherit'});
 if(smoke.status!==0)throw new Error('Packaged native dependencies or server failed to load.');
 const platform={darwin:'macOS',linux:'Linux',win32:'Windows'}[process.platform];
 const name=`Foliquo-Community-${CURRENT_VERSION}-${platform}-${process.arch}`;
 if(process.platform!=='win32'){
  const artifact=join(output,name+'.tar.gz');
  const result=spawnSync('python3',[join(root,'scripts/archive-release.py'),stage,artifact],{cwd:root,stdio:'inherit'});if(result.status!==0)throw new Error('Archive creation failed.');
  console.log('Created '+artifact);
 }
 return {stage,output,name};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildPackage();
