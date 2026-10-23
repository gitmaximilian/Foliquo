import {createHash} from 'node:crypto';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {zipSync} from 'fflate';
const root=fileURLToPath(new URL('..',import.meta.url)),files={};
async function add(path){const full=join(root,path);files['TranslateOCR/'+path.replaceAll('\\','/')]=new Uint8Array(await readFile(full));}
async function walk(path){for(const entry of await readdir(join(root,path),{withFileTypes:true})){if(entry.isSymbolicLink())throw new Error('Symlinks werden nicht verpackt.');const next=path+'/'+entry.name;if(entry.isDirectory())await walk(next);else if(entry.isFile())await add(next);}}
for(const name of ['AGENTS.md','CODEX-HANDOVER.md','WINDOWS-START.md','README.md','FEATURES.md','CONTRIBUTING.md','IMPLEMENTATION.md','SECURITY.md','Install-Desktop.command','package.json','package-lock.json','server.mjs','.gitignore','Setup-Windows.cmd','Start-TranslateOCR.cmd','Install-Windows.cmd','Update-Windows.cmd'])await add(name);
for(const dir of ['lib','dist','scripts','tests','benchmarks','.github','docs','desktop'])await walk(dir);
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));const manifest={name:pkg.name,version:pkg.version,files:Object.fromEntries(Object.entries(files).filter(([n])=>!n.endsWith('/Install-Windows.cmd')).map(([n,b])=>[n.replace(/^TranslateOCR\//,''),createHash('sha256').update(b).digest('hex')]))};files['TranslateOCR/release-manifest.json']=new TextEncoder().encode(JSON.stringify(manifest,null,2));
const destination=resolve(root,'outputs/TranslateOCR-Windows.zip');await mkdir(join(root,'outputs'),{recursive:true});await writeFile(destination,zipSync(files,{level:6}));console.log(JSON.stringify({archive:destination,fileCount:Object.keys(files).length,excluded:['.local','.git','.openai','node_modules','outputs','private documents']}));
