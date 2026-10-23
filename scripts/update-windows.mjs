import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {applyRelease} from '../lib/release.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));let supplied=process.argv[2];if(!supplied){const rl=createInterface({input:process.stdin,output:process.stdout});try{supplied=await rl.question('Entpackter neuer TranslateOCR-Ordner: ');}finally{rl.close();}}
try{await fetch(`http://127.0.0.1:${Number(process.env.URKUNDENKLAR_PORT||4318)}/`,{signal:AbortSignal.timeout(1000)});throw new Error('Bitte TranslateOCR vor dem Update beenden.');}catch(e){if(e.message.startsWith('Bitte TranslateOCR'))throw e;}
const result=await applyRelease(root,resolve(supplied||''),{install(directory){const npm=process.platform==='win32'?'npm.cmd':'npm';if(spawnSync(npm,['ci','--ignore-scripts'],{cwd:directory,stdio:'inherit',shell:process.platform==='win32'}).status!==0)throw new Error('Abhängigkeiten konnten nicht installiert werden.');},check(directory){if(spawnSync(process.execPath,['scripts/check-install.mjs'],{cwd:directory,stdio:'inherit'}).status!==0)throw new Error('Installationsprüfung fehlgeschlagen.');}});console.log('Update erfolgreich: '+result.version+'; Quellcode-Sicherung: '+result.backup);
