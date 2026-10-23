import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {access,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const defaults={
 darwin:join(root,'release-desktop',`mac-${process.arch}`,'TranslateOCR.app','Contents','MacOS','TranslateOCR'),
 win32:join(root,'release-desktop','win-unpacked','TranslateOCR.exe'),
 linux:join(root,'release-desktop','linux-unpacked','translateocr'),
};
const executable=resolve(process.argv[2]||defaults[process.platform]);
await access(executable);
const dataRoot=await mkdtemp(join(tmpdir(),'translateocr-desktop-smoke-'));
const child=spawn(executable,['--disable-gpu'],{env:{...process.env,TRANSLATEOCR_DESKTOP_DATA_DIR:dataRoot},stdio:'ignore'});
let finished=false;
child.once('exit',()=>{finished=true;});
try{
 const deadline=Date.now()+30000;let ready=null;
 while(Date.now()<deadline&&!finished){
  try{await access(join(dataRoot,'.local','workspace.key'));}catch{await new Promise(r=>setTimeout(r,250));continue;}
  for(let port=4318;port<=4330;port++){
   try{const response=await fetch(`http://127.0.0.1:${port}/`,{signal:AbortSignal.timeout(500)});const html=await response.text();if(response.ok&&html.includes('<title>TranslateOCR')){ready={port,cookie:response.headers.get('set-cookie')?.split(';')[0]};break;}}catch{}
  }
  if(ready)break;
  await new Promise(r=>setTimeout(r,250));
 }
 assert.ok(ready,'Desktop-Dienst hat nicht gestartet.');
 const status=await fetch(`http://127.0.0.1:${ready.port}/api/session`,{headers:{cookie:ready.cookie}}).then(r=>r.json());
 assert.equal(status.local,true);assert.equal(status.persistent,true);assert.equal(status.version,'0.8.0');
 console.log(`Desktop-Smoke-Test bestanden: TranslateOCR-Fenster, Loopback-Dienst und lokaler Workspace auf Port ${ready.port}.`);
}finally{
 if(!finished){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,4000))]);if(!finished)child.kill('SIGKILL');}
 await rm(dataRoot,{recursive:true,force:true});
}
