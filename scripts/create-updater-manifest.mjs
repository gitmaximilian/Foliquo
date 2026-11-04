import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {verifyUpdaterSignature} from './check-updater-signatures.mjs';

const directory=process.argv[2]||'release-assets';
const pkg=JSON.parse(await readFile('package.json','utf8'));
const repository=process.env.GITHUB_REPOSITORY||'gitmaximilian/Foliquo';
const tag=process.env.GITHUB_REF_NAME||`desktop-v${pkg.version}`;
if(tag!==`desktop-v${pkg.version}`)throw new Error(`Updater tag ${tag} does not match package version ${pkg.version}.`);
const platforms={
  'windows-x86_64':'Foliquo_'+pkg.version+'_x64-setup.exe',
  'darwin-aarch64':'Foliquo-Desktop-macOS-arm64.app.tar.gz',
  'darwin-x86_64':'Foliquo-Desktop-macOS-x64.app.tar.gz',
};
const manifest={version:pkg.version,notes:`Foliquo Community v${pkg.version}`,pub_date:new Date().toISOString(),platforms:{}};
for(const [target,file] of Object.entries(platforms)){
  const signature=(await readFile(join(directory,`${file}.sig`),'utf8')).trim();
  if(!signature)throw new Error(`Missing updater signature for ${target}.`);
  const configuration=target.startsWith('windows')?'tauri.windows.conf.json':'tauri.macos.conf.json',config=JSON.parse(await readFile(join('desktop/src-tauri',configuration),'utf8'));
  await verifyUpdaterSignature(join(directory,file),signature,config.plugins.updater.pubkey,{version:pkg.version});
  manifest.platforms[target]={signature,url:`https://github.com/${repository}/releases/download/${tag}/${file}`};
}
await writeFile(join(directory,'latest.json'),`${JSON.stringify(manifest,null,2)}\n`);
