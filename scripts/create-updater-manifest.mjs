import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

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
  manifest.platforms[target]={signature,url:`https://github.com/${repository}/releases/download/${tag}/${file}`};
}
await writeFile(join(directory,'latest.json'),`${JSON.stringify(manifest,null,2)}\n`);
