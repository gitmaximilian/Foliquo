import {spawn,spawnSync} from 'node:child_process';
import {readFile,rm,mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const generated=join(root,'desktop/generated');
const service=join(generated,'service');
const node=join(service,'runtime',process.platform==='win32'?'node.exe':'node');
const office=process.platform==='win32'?join(generated,'office/LibreOffice/program/soffice.exe'):process.platform==='darwin'?join(generated,'office/LibreOffice.app/Contents/MacOS/soffice'):join(generated,'office/libreoffice/program/soffice');
const workspace=await mkdtemp(join(tmpdir(),'foliquo-desktop-smoke-'));
const port=await new Promise((resolve,reject)=>{const server=createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const value=server.address().port;server.close(()=>resolve(value));});});
const origin=`http://127.0.0.1:${port}`;
const child=spawn(node,[join(service,'server.mjs')],{cwd:service,env:{...process.env,FOLIQUO_PORT:String(port),FOLIQUO_DATA_DIR:workspace,TRANSLATEOCR_SOFFICE:office,FOLIQUO_NO_BROWSER:'1'},stdio:'ignore'});
let exited=false;child.once('exit',()=>{exited=true;});
try{
 let ready=false;
 for(let attempt=0;attempt<75;attempt++){
  if(exited)throw new Error('Bundled Foliquo service exited before becoming ready.');
  try{const response=await fetch(`${origin}/api/health`,{signal:AbortSignal.timeout(500)});const health=await response.json();if(response.ok&&health.application==='foliquo'&&health.desktopBridge===1){ready=true;break;}}catch{}
  await delay(200);
 }
 if(!ready)throw new Error('Bundled Foliquo service did not start.');
 const home=await fetch(origin),cookie=home.headers.get('set-cookie')?.split(';')[0];
 if(!cookie)throw new Error('Bundled service did not establish a browser session.');
 const session=await fetch(`${origin}/api/session`,{headers:{cookie}}).then(response=>response.json());
 const response=await fetch(`${origin}/api/pdf`,{method:'POST',headers:{cookie,origin,'content-type':'application/json','x-foliquo-csrf':session.csrf},body:JSON.stringify({text:'Fictional sample translation. No personal information.',files:[{name:'fictional.txt',data:Buffer.from('Fictional source document.').toString('base64')}],metadata:{targetLanguage:'Deutsch'}}),signal:AbortSignal.timeout(90000)});
 const bytes=Buffer.from(await response.arrayBuffer());
 if(!response.ok||bytes.subarray(0,5).toString()!=='%PDF-'){
  let detail='';
  if(process.platform==='linux'){
   const input=join(workspace,'office-probe.txt'),profile=join(workspace,'office-probe-profile');
   await writeFile(input,'Fictional source document.');await mkdir(join(profile,'user'),{recursive:true});
   const probe=spawnSync(office,[`-env:UserInstallation=${pathToFileURL(profile).href}`,'--headless','--nologo','--nodefault','--norestore','--infilter=Text (encoded):UTF8','--convert-to','pdf','--outdir',workspace,input],{encoding:'utf8',timeout:30000,env:{...process.env,TMPDIR:workspace,XDG_CACHE_HOME:join(workspace,'cache')}});
   detail=`; LibreOffice probe exit=${probe.status}, error=${probe.error?.message||''}, stdout=${probe.stdout?.slice(0,500)||''}, stderr=${probe.stderr?.slice(0,1000)||''}`;
  }
  throw new Error(`Bundled PDF export failed: ${response.status} ${bytes.subarray(0,300).toString()}${detail}`);
 }
 console.log(`Bundled Node, LibreOffice, session and fictional PDF export passed on ${process.platform}/${process.arch}.`);
}finally{
 try{const record=JSON.parse(await readFile(join(workspace,'service.json'),'utf8'));await fetch(`${origin}/api/lifecycle/stop`,{method:'POST',headers:{authorization:`Bearer ${record.token}`},signal:AbortSignal.timeout(3000)});}catch{}
 for(let attempt=0;attempt<20&&!exited;attempt++)await delay(100);
 if(!exited)child.kill();
 await rm(workspace,{recursive:true,force:true});
}
