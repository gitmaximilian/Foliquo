import {spawn} from 'node:child_process';
const port=Number(process.env.URKUNDENKLAR_PORT||4318);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Ungueltiger Port.');
const url=`http://127.0.0.1:${port}/`;
function open(){spawn('cmd.exe',['/d','/s','/c',`start "" "${url}"`],{stdio:'ignore',windowsHide:true});}
let existing=false;try{const r=await fetch(url,{signal:AbortSignal.timeout(1500)});existing=r.ok&&(await r.text()).includes('<title>TranslateOCR');}catch{}
if(existing){console.log('TranslateOCR laeuft bereits. Browser wird geoeffnet.');open();}else{
 const server=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),stdio:['inherit','pipe','inherit']});let opened=false;
 server.stdout.on('data',data=>{process.stdout.write(data);if(!opened&&data.toString().includes('TranslateOCR bereit:')){opened=true;open();}});
 server.on('error',error=>{console.error('TranslateOCR konnte nicht starten: '+error.message);process.exitCode=1;});server.on('exit',code=>{process.exitCode=code||0;});process.on('SIGINT',()=>server.kill('SIGINT'));process.on('SIGTERM',()=>server.kill('SIGTERM'));
}
