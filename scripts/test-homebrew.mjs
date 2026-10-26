import {readFile,writeFile,mkdir,cp,rm,lstat,mkdtemp} from 'node:fs/promises';
import {spawnSync,spawn} from 'node:child_process';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {tmpdir} from 'node:os';
const run=(cmd,args,options={})=>{const result=spawnSync(cmd,args,{stdio:'inherit',...options});if(result.status!==0)throw new Error(cmd+' '+args.join(' ')+' failed');};
const version=JSON.parse(await readFile('package.json','utf8')).version;
const repository=spawnSync('brew',['--repository'],{encoding:'utf8'}).stdout.trim();
const tap=join(repository,'Library','Taps','gitmaximilian','homebrew-tap');
// Test a dedicated local tap. Never change a pre-existing user tap.
try{await lstat(tap);throw new Error('A tap already exists; run formula verification in a clean Homebrew environment.');}catch(e){if(e.code!=='ENOENT')throw e;}
if(spawnSync('brew',['list','--versions','foliquo'],{encoding:'utf8'}).stdout.trim())throw new Error('Foliquo is already installed. Use a clean Homebrew environment for verification.');
await mkdir(join(tap,'Formula'),{recursive:true});
const oldConfig=process.env.XDG_CONFIG_HOME,config=await mkdtemp(join(tmpdir(),'foliquo-brew-config-'));
let installed=false;
process.env.XDG_CONFIG_HOME=config;
try{
const production=await readFile('release/homebrew-tap/Formula/foliquo.rb','utf8');
run('git',['init',tap]);
await writeFile(join(tap,'Formula/foliquo.rb'),production);
run('brew',['style','gitmaximilian/tap/foliquo']);
run('brew',['trust','--formula','gitmaximilian/tap/foliquo']);
run('brew',['audit','--strict','gitmaximilian/tap/foliquo']);
// Only the URL is changed for prepublication tests. The production hashes remain identical.
const local=production.replace('  on_macos do',`  version "${version}"\n\n  on_macos do`).replaceAll(/https:\/\/github.com\/gitmaximilian\/Foliquo\/releases\/download\/v[^/]+\/([^"\n]+)/g,(_,name)=>pathToFileURL(resolve('release',name)).href);
await writeFile(join(tap,'Formula/foliquo.rb'),local);
try{
 run('brew',['install','--build-from-source','gitmaximilian/tap/foliquo']);installed=true;
 run('brew',['test','gitmaximilian/tap/foliquo']);
 const environment={...process.env,FOLIQUO_DATA_DIR:resolve('.packaging/brew-persistence'),FOLIQUO_NO_BROWSER:'1',FOLIQUO_PORT:'18321'};
 const prefix=spawnSync('brew',['--prefix'],{encoding:'utf8'}).stdout.trim();
 const cli=join(prefix,'bin','foliquo');
 const child=spawn(cli,[],{env:environment,stdio:'inherit'});
 try{
  let ready=false;
  for(let i=0;i<100;i++){try{const response=await fetch('http://127.0.0.1:18321/api/health');ready=response.ok;}catch{}if(ready)break;await delay(100);}
  if(!ready)throw new Error('Installed formula did not start.');
  run(cli,['stop'],{env:environment});
  await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));
 }finally{if(child.exitCode===null)child.kill();}
 const keyPath=resolve('.packaging/brew-persistence/workspace.key'),key=await readFile(keyPath);
 // Reinstall models replacement of the application keg; the synthetic workspace survives.
 run('brew',['reinstall','gitmaximilian/tap/foliquo'],{env:environment});
 run('brew',['test','gitmaximilian/tap/foliquo']);
 run('brew',['uninstall','gitmaximilian/tap/foliquo']);installed=false;
 if(!(await readFile(keyPath)).equals(key))throw new Error('Homebrew replacement or uninstall changed private data.');
}finally{await writeFile(join(tap,'Formula/foliquo.rb'),production);}
}finally{if(installed)spawnSync('brew',['uninstall','gitmaximilian/tap/foliquo'],{stdio:'inherit'});await rm(tap,{recursive:true,force:true});await rm(config,{recursive:true,force:true});if(oldConfig===undefined)delete process.env.XDG_CONFIG_HOME;else process.env.XDG_CONFIG_HOME=oldConfig;}
console.log('Formula style, audit, native install, functional startup/stop, reinstall and uninstall passed.');
