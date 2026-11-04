import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join,resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const alive=pid=>{try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}};
const versionParts=value=>/^\d+\.\d+\.\d+$/.test(value||'')?value.split('.').map(Number):null;
function olderThan(oldVersion,newVersion){const a=versionParts(oldVersion),b=versionParts(newVersion);if(!a||!b)return false;for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]<b[i];return false;}

/** Stop only the authenticated previous service, then wait for its process to exit. */
export async function stopPreviousService(directory,{expectedInstance=null,newVersion=null,installedNodeOnly=false,timeoutMs=10000}={}){
 if(!isAbsolute(directory))throw new Error('An absolute Foliquo data directory is required.');
 let record;try{record=JSON.parse(await readFile(join(directory,'service.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return {stopped:false};throw new Error('The previous Foliquo service record could not be verified. Close Foliquo before updating.');}
 if(!Number.isInteger(record.pid)||record.pid<1||record.pid===process.pid||!Number.isInteger(record.port)||record.port<1024||record.port>65535||typeof record.instance!=='string'||typeof record.token!=='string'||record.token.length<16)throw new Error('The previous Foliquo service record is invalid. Close Foliquo before updating.');
 if(!alive(record.pid))return {stopped:false};
 const endpoint=`http://127.0.0.1:${record.port}`,response=await fetch(endpoint+'/api/health',{signal:AbortSignal.timeout(3000),redirect:'error'}),health=await response.json();
 if(!response.ok||health.application!=='foliquo'||health.protocol!==1||health.instance!==record.instance||health.workspaceId!==createHash('sha256').update(directory).digest('hex')||expectedInstance!==null&&health.instance!==expectedInstance||newVersion!==null&&!olderThan(health.version,newVersion))throw new Error('The running service does not match the previous Foliquo installation. Close it before updating.');
 if(installedNodeOnly){
  if(process.platform!=='win32')throw new Error('The installer service check requires Windows.');
  const powershell=join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),command=`$p = Get-CimInstance Win32_Process -Filter 'ProcessId = ${record.pid}'; [Console]::Write($p.ExecutablePath)`;
  const {stdout}=await promisify(execFile)(powershell,['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:5000,maxBuffer:8192});
  if(!stdout.trim()||resolve(stdout.trim()).toLowerCase()!==resolve(process.execPath).toLowerCase())throw new Error('Another Foliquo installation owns the running service. Close it before updating.');
 }
 const stopped=await fetch(endpoint+'/api/lifecycle/stop',{method:'POST',headers:{authorization:`Bearer ${record.token}`},signal:AbortSignal.timeout(5000),redirect:'error'});
 if(!stopped.ok)throw new Error('Foliquo could not save and stop its previous service. Close Foliquo before updating.');
 const deadline=Date.now()+Math.max(100,Math.min(timeoutMs,30000));while(alive(record.pid)&&Date.now()<deadline)await delay(100);
 if(alive(record.pid))throw new Error('The previous Foliquo service is still finishing work. Wait for it to close before updating.');
 return {stopped:true};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const directory=process.env.FOLIQUO_DATA_DIR||join(process.env.LOCALAPPDATA||join(process.env.USERPROFILE||'','AppData','Local'),'Foliquo');await stopPreviousService(directory,{installedNodeOnly:true});}
 catch{console.error('Close all Foliquo windows and its browser service, then run the installer again. Your saved data is retained.');process.exitCode=1;}
}
