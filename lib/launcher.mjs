import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {readFile} from 'node:fs/promises';
import {dataDirectory} from './data-directory.mjs';

export const appRoot=fileURLToPath(new URL('..',import.meta.url));
export function servicePort(env=process.env){const port=Number(env.FOLIQUO_PORT||env.URKUNDENKLAR_PORT||4318);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Choose a port between 1024 and 65535.');return port;}
export async function probeService(port) {
 try {
  const response=await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(1200),redirect:'error'});
  const data=await response.json().catch(()=>null);
  if(response.ok&&data?.application==='foliquo'&&data.protocol===1)return data;
  throw new Error('Port '+port+' is used by another application. Set FOLIQUO_PORT to a free port.');
 } catch(e){if(e.cause?.code==='ECONNREFUSED')return null;throw e;}
}
export function openBrowser(url) {
 if(process.env.FOLIQUO_NO_BROWSER==='1')return;
 const opener=process.platform==='win32'?spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{stdio:'ignore',windowsHide:true}):process.platform==='darwin'?spawn('open',[url],{stdio:'ignore'}):spawn('xdg-open',[url],{stdio:'ignore'});
 opener.on('error',()=>console.log(`Open Foliquo in your browser: ${url}`));opener.unref();
}
export async function stopService() {
 const record=JSON.parse(await readFile(join(dataDirectory(),'service.json'),'utf8'));
 const health=await probeService(record.port);
 if(!health||health.instance!==record.instance)throw new Error('No matching Foliquo service is running.');
 const response=await fetch(`http://127.0.0.1:${record.port}/api/lifecycle/stop`,{method:'POST',headers:{authorization:`Bearer ${record.token}`},signal:AbortSignal.timeout(3000)});
 if(!response.ok)throw new Error('Foliquo could not be stopped.');
 console.log('Foliquo is stopping. Your workspace is preserved.');
}
export async function startBrowser() {
 const port=servicePort(),url=`http://127.0.0.1:${port}/`;
 const running=await probeService(port);
 if(running){if(running.workspaceId!==createHash('sha256').update(dataDirectory()).digest('hex'))throw new Error('The running Foliquo service uses another workspace. Stop it before selecting a different data directory.');openBrowser(url);console.log(`Foliquo is already running: ${url}`);return;}
 const {findOffice}=await import('./formats.mjs');
 try{await findOffice();}catch{throw new Error('LibreOffice Writer is required for PDF/Word export. Install it from libreoffice.org or run brew install --cask libreoffice (macOS). Then run foliquo doctor.');}
 const child=spawn(process.execPath,[join(appRoot,'server.mjs')],{cwd:appRoot,stdio:'inherit',env:process.env});
 let spawnError;child.on('error',error=>{spawnError=error;});child.on('exit',code=>{process.exitCode=code??0;});
 const interrupt=()=>child.kill('SIGINT'),terminate=()=>child.kill('SIGTERM');
 process.on('SIGINT',interrupt);process.on('SIGTERM',terminate);
 child.once('exit',()=>{process.off('SIGINT',interrupt);process.off('SIGTERM',terminate);});
 for(let i=0;i<100;i++){
  if(spawnError||child.exitCode!==null)throw new Error('Foliquo could not start. Check the prerequisite or workspace message above.');
  const running=await probeService(port);
 if(running){if(running.workspaceId!==createHash('sha256').update(dataDirectory()).digest('hex'))throw new Error('The running Foliquo service uses another workspace. Stop it before selecting a different data directory.');openBrowser(url);console.log(`Foliquo is open in your browser: ${url}\nKeep this window open. Press Ctrl+C to stop Foliquo.`);return;}
  await delay(200);
 }
 child.kill();throw new Error('Foliquo did not start in time. Run foliquo doctor.');
}
