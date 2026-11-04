import {createReadStream} from 'node:fs';
import {readFile,realpath} from 'node:fs/promises';
import {createHash,createPublicKey,verify} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CURRENT_VERSION} from '../lib/version.mjs';

const decode=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9+/=\s]+$/.test(value))throw new Error('Invalid updater signature encoding.');return Buffer.from(value,'base64');};
/** Verify the same prehashed Minisign packet used by the Tauri updater. */
export async function verifyUpdaterSignature(file,signature,publicKey,{version=CURRENT_VERSION}={}){
 const keyLines=decode(publicKey).toString('utf8').trim().split(/\r?\n/),lines=decode(signature).toString('utf8').trim().split(/\r?\n/);
 if(keyLines.length!==2||lines.length!==4||!lines[2].startsWith('trusted comment: '))throw new Error('Invalid updater signature packet.');
 const key=decode(keyLines[1]),packet=decode(lines[1]),globalSignature=decode(lines[3]);
 if(key.length!==42||!['Ed','ED'].includes(key.subarray(0,2).toString())||packet.length!==74||packet.subarray(0,2).toString()!=='ED'||globalSignature.length!==64||!key.subarray(2,10).equals(packet.subarray(2,10)))throw new Error('The updater signature does not match the application public key.');
 const verifier=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),key.subarray(10)]),format:'der',type:'spki'}),comment=lines[2].slice(17),signedVersion=comment.match(/(?:^|\t)version:([^\t]+)(?:\t|$)/)?.[1];
 if(signedVersion!==version)throw new Error('The updater signature does not bind the announced version.');
 if(!verify(null,Buffer.concat([packet.subarray(10),Buffer.from(comment)]),verifier,globalSignature))throw new Error('Invalid updater trusted-comment signature.');
 const hash=createHash('blake2b512');for await(const chunk of createReadStream(file))hash.update(chunk);
 if(!verify(null,hash.digest(),verifier,packet.subarray(10)))throw new Error('The updater artifact signature is invalid.');
 return {version,verified:true};
}

const entryPath=process.argv[1]?await realpath(process.argv[1]).catch(()=>resolve(process.argv[1])):null,modulePath=fileURLToPath(import.meta.url),legacyMain=entryPath&&(process.platform==='win32'?entryPath.toLowerCase()===modulePath.toLowerCase():entryPath===modulePath);
if(import.meta.main??legacyMain){
 const windows=process.platform==='win32',configuration=windows?'tauri.windows.conf.json':'tauri.macos.conf.json',file=process.argv[2]||join('desktop/src-tauri/target/release/bundle',windows?`nsis/Foliquo_${CURRENT_VERSION}_x64-setup.exe`:'macos/Foliquo.app.tar.gz'),config=JSON.parse(await readFile(join('desktop/src-tauri',configuration),'utf8'));
 console.log(JSON.stringify(await verifyUpdaterSignature(file,(await readFile(file+'.sig','utf8')).trim(),config.plugins.updater.pubkey,{version:process.argv[3]||CURRENT_VERSION})));
}
