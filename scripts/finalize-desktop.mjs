import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectDesktopSignatures} from '../lib/desktop-signatures.mjs';

const directory=process.env.FOLIQUO_DESKTOP_FINAL_DIR?resolve(process.env.FOLIQUO_DESKTOP_FINAL_DIR):fileURLToPath(new URL('../release-desktop/final/',import.meta.url));
const files=(await readdir(directory)).filter(name=>!['SHA256SUMS','BUILD-REPORT.txt','BUILD-REPORT.json'].includes(name)).sort();
if(!files.length)throw new Error('No desktop package was built.');
const hasUpdaterSignature=files.some(name=>name.endsWith('.sig'));
const platform=process.env.DESKTOP_PLATFORM||process.platform,appRoot=resolve(process.env.FOLIQUO_DESKTOP_MACOS_APP_ROOT||'desktop/src-tauri/target/release/bundle/macos');let apps=[];
if(process.platform==='darwin'){try{apps=(await readdir(appRoot,{withFileTypes:true})).filter(entry=>entry.isDirectory()&&entry.name.endsWith('.app')).map(entry=>join(appRoot,entry.name));}catch(error){if(error.code!=='ENOENT')throw error;}}
const signature=inspectDesktopSignatures({platform:process.platform,apps,diskImages:files.filter(name=>name.endsWith('.dmg')).map(name=>join(directory,name)),files:files.filter(name=>/\.(?:exe|msix)$/i.test(name)).map(name=>join(directory,name))});
const checks=[];
for(const name of files){
 const hash=createHash('sha256');
 for await(const chunk of createReadStream(join(directory,name)))hash.update(chunk);
 checks.push(`${hash.digest('hex')}  ${name}`);
}
await writeFile(join(directory,'SHA256SUMS'),checks.join('\n')+'\n');
const report={commit:process.env.GITHUB_SHA||'local',platform,signatureVerificationPlatform:signature.platform,osSignature:signature,tauriUpdaterSignature:hasUpdaterSignature?'present':'absent',storeSubmission:'no',checksums:Object.fromEntries(checks.map(line=>{const [digest,name]=line.split(/\s{2}/);return [name,digest];}))};
await writeFile(join(directory,'BUILD-REPORT.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(join(directory,'BUILD-REPORT.txt'),`Commit: ${report.commit}\nBuild target: ${platform}\nSignature verification platform: ${signature.platform}\nOS code signature: ${signature.status}\nTauri updater signature: ${hasUpdaterSignature?'present':'absent'}\nStore submission: no\n`);
