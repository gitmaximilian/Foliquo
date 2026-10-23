import {spawn} from 'node:child_process';
import {access} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const port=Number(process.env.TRANSLATEOCR_PORT||4318);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('TranslateOCR-Port ist ungültig.');
try{await access(join(root,'node_modules','pdf-lib','package.json'));}catch{throw new Error('TranslateOCR ist noch nicht eingerichtet. Starte zuerst Setup-Windows.cmd oder npm run setup.');}
const url=`http://127.0.0.1:${port}/`;
async function isTranslateOCR(){try{const response=await fetch(url,{signal:AbortSignal.timeout(700)});return response.ok&&(await response.text()).includes('<title>TranslateOCR');}catch{return false;}}
if(!await isTranslateOCR()){
  const child=spawn(process.execPath,['server.mjs'],{cwd:root,detached:true,stdio:'ignore',windowsHide:true});
  child.unref();
  let ready=false;for(let i=0;i<40;i++){await new Promise(resolve=>setTimeout(resolve,250));if(await isTranslateOCR()){ready=true;break;}}
  if(!ready)throw new Error('Der lokale Dienst konnte nicht starten. Prüfe Node.js, LibreOffice und ob Port 4318 frei ist.');
}
const command=process.platform==='win32'?['cmd.exe',['/d','/s','/c',`start "" "${url}"`]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];
const opened=spawn(command[0],command[1],{stdio:'ignore',detached:true,windowsHide:true});opened.unref();
