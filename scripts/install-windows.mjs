import {cp,mkdir,access,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath} from 'node:url';
if(process.platform!=='win32')throw new Error('Dieser Installer ist für Windows.');
const source=fileURLToPath(new URL('..',import.meta.url)),defaultTarget=join(process.env.LOCALAPPDATA||process.env.USERPROFILE,'TranslateOCR');
const rl=createInterface({input:process.stdin,output:process.stdout});let target;try{target=resolve((await rl.question(`Installationsordner [${defaultTarget}]: `)).trim()||defaultTarget);}finally{rl.close();}
if(target===resolve(source))throw new Error('Bitte einen anderen Installationsordner wählen.');
try{await access(join(target,'package.json'));throw new Error('Dort liegt bereits eine Installation. Bitte Update-Windows.cmd verwenden.');}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(target,{recursive:true});
for(const name of ['.gitignore','lib','dist','scripts','tests','benchmarks','.github','docs','package.json','package-lock.json','server.mjs','AGENTS.md','README.md','FEATURES.md','CONTRIBUTING.md','CODEX-HANDOVER.md','WINDOWS-START.md','Start-TranslateOCR.cmd','Setup-Windows.cmd','Update-Windows.cmd'])await cp(join(source,name),join(target,name),{recursive:true,errorOnExist:true});
const setup=spawnSync('cmd.exe',['/d','/s','/c','Setup-Windows.cmd'],{cwd:target,stdio:'inherit'});if(setup.status!==0)throw new Error('Einrichtung nicht abgeschlossen. Setup-Windows.cmd im Zielordner erneut starten.');const check=spawnSync(process.execPath,['scripts/check-install.mjs'],{cwd:target,stdio:'inherit'});if(check.status!==0)throw new Error('Installationsprüfung fehlgeschlagen.');
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const shortcut=`$s=(New-Object -ComObject WScript.Shell).CreateShortcut([IO.Path]::Combine([Environment]::GetFolderPath('Desktop'),'TranslateOCR.lnk'));$s.TargetPath=${quote(join(target,'Start-TranslateOCR.cmd'))};$s.WorkingDirectory=${quote(target)};$s.Save()`;
const result=spawnSync('powershell.exe',['-NoProfile','-Command',shortcut],{stdio:'inherit'});if(result.status!==0)console.log('Desktop-Verknuepfung konnte nicht erstellt werden. Startdatei im Zielordner verwenden.');
console.log('Installiert: '+target);console.log('Die Anmeldung erfolgt beim ersten Start persönlich im Browser.');
