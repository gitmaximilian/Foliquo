import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
const port=Number(process.env.URKUNDENKLAR_PORT||4318),url=`http://127.0.0.1:${port}/`;
function openBrowser(){
 const opener=process.platform==='win32'?spawn('cmd.exe',['/d','/s','/c','start','""',url],{stdio:'ignore',windowsHide:true}):process.platform==='darwin'?spawn('open',[url],{stdio:'ignore'}):spawn('xdg-open',[url],{stdio:'ignore'});
 opener.on('error',()=>console.log(`Open Foliquo in your browser: ${url}`));opener.unref();
}
let alreadyRunning=false;
try{const response=await fetch(url,{signal:AbortSignal.timeout(700)});alreadyRunning=response.ok;}catch{}
if(alreadyRunning){openBrowser();console.log(`Foliquo is already running: ${url}`);}else{
const child=spawn(process.execPath,['server.mjs'],{stdio:'inherit',env:process.env});
child.on('exit',code=>{process.exitCode=code??0;});
let ready=false;
for(let i=0;i<80&&!ready;i++){if(child.exitCode!==null)throw new Error('Foliquo could not start. Check the setup output above.');try{const r=await fetch(url,{signal:AbortSignal.timeout(500)});ready=r.ok;}catch{}if(!ready)await delay(250);}
if(!ready){child.kill();throw new Error('Foliquo did not start in time.');}
openBrowser();console.log(`Foliquo is open in your browser: ${url}`);
process.on('SIGINT',()=>child.kill('SIGINT'));process.on('SIGTERM',()=>child.kill('SIGTERM'));
}
