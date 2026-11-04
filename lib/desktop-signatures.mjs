import {spawnSync} from 'node:child_process';

const nativeRun=(command,args,options={})=>{const result=spawnSync(command,args,{encoding:'utf8',...options});return {status:result.status,stdout:result.stdout||'',stderr:result.stderr||'',error:result.error?.message||''};};
const evidenceText=result=>`${result.stdout||''}\n${result.stderr||''}\n${result.error||''}`;
const aggregate=items=>{const states=new Set(items.map(item=>item.codeSignature));if(!states.size||states.has('unverified'))return 'unverified';if(states.size>1)return 'mixed';return states.values().next().value;};
const aggregateNotarization=items=>{const states=new Set(items.map(item=>item.notarization));if(!states.size||states.has('unverified'))return 'unverified';if(states.size>1)return 'mixed';return states.values().next().value;};

function inspectMac({apps=[],diskImages=[],run=nativeRun}){
 if(!apps.length)return {status:'unverified',platform:'macOS',codeSignature:'unverified',notarization:'unverified',artifacts:[],reason:'No built .app bundle was available for platform verification.'};
 const artifacts=apps.map(path=>{
  const verify=run('codesign',['--verify','--deep','--strict','--verbose=2',path]),details=run('codesign',['--display','--verbose=2',path]),text=evidenceText(verify)+'\n'+evidenceText(details),codeSignature=verify.status===0?'valid':/not signed at all|code object is not signed/i.test(text)?'unsigned':verify.status===null?'unverified':'invalid';
  const gatekeeper=codeSignature==='valid'?run('spctl',['--assess','--type','execute','--verbose=2',path]):null,notary=codeSignature==='valid'?run('xcrun',['stapler','validate',path]):null;
  return {path,codeSignature,identity:(text.match(/Authority=([^\r\n]+)/)||[])[1]||null,gatekeeper:gatekeeper?(gatekeeper.status===0?'accepted':gatekeeper.status===null?'unverified':'rejected'):'not-checked',notarization:!notary?'not-checked':notary.status===0?'ticket-valid':notary.status===null?'unverified':'no-valid-ticket'};
 });
 const imageEvidence=diskImages.map(path=>{const result=run('xcrun',['stapler','validate',path]);return {path,notarization:result.status===0?'ticket-valid':result.status===null?'unverified':'no-valid-ticket'};});
 const codeSignature=aggregate(artifacts),notarization=aggregateNotarization([...artifacts,...imageEvidence]);
 const status=codeSignature!=='valid'?codeSignature:artifacts.some(item=>item.gatekeeper==='rejected')?'signed-but-rejected':artifacts.some(item=>item.gatekeeper==='unverified')||notarization==='unverified'?'unverified':artifacts.every(item=>item.gatekeeper==='accepted')&&notarization==='ticket-valid'?'signed-and-notarized':'signed-not-notarized';
 return {status,platform:'macOS',codeSignature,notarization,artifacts:[...artifacts,...imageEvidence]};
}

function inspectWindows({files=[],run=nativeRun}){
 if(!files.length)return {status:'unverified',platform:'Windows',codeSignature:'unverified',notarization:'not-applicable',artifacts:[],reason:'No Windows executable or installer was available for Authenticode verification.'};
 const script='$s=Get-AuthenticodeSignature -LiteralPath $env:FOLIQUO_SIGNATURE_FILE; [PSCustomObject]@{status=$s.Status.ToString(); subject=$s.SignerCertificate.Subject} | ConvertTo-Json -Compress';
 const artifacts=files.map(path=>{const result=run(process.env.POWERSHELL_EXE||'powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,FOLIQUO_SIGNATURE_FILE:path}});let value=null;try{value=JSON.parse(result.stdout.trim());}catch{}const status=result.status===null?'unverified':value?.status==='Valid'?'valid':value?.status==='NotSigned'?'unsigned':value?.status?'invalid':'unverified';return {path,codeSignature:status,identity:value?.subject||null,error:status==='invalid'?value?.status||evidenceText(result).trim()||'Signature verification failed.':undefined};});
 const codeSignature=aggregate(artifacts);
 return {status:codeSignature==='valid'?'signed':codeSignature,platform:'Windows',codeSignature,notarization:'not-applicable',artifacts};
}

/** Verify signatures from the actual platform artifacts; checksums/updater signatures stay separate. */
export function inspectDesktopSignatures({platform=process.platform,apps=[],diskImages=[],files=[],run=nativeRun}={}){
 if(platform==='darwin')return inspectMac({apps,diskImages,run});
 if(platform==='win32')return inspectWindows({files,run});
 if(platform==='linux')return {status:'not-applicable',platform:'Linux',codeSignature:'not-applicable',notarization:'not-applicable',artifacts:[],reason:'OS package signing is not configured for the local Flatpak bundle.'};
 return {status:'unverified',platform,codeSignature:'unverified',notarization:'unverified',artifacts:[],reason:'Unsupported verification platform.'};
}
