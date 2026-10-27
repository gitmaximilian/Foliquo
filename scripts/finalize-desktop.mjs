import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readdir,writeFile} from 'node:fs/promises';

const directory=new URL('../release-desktop/final/',import.meta.url);
const files=(await readdir(directory)).filter(name=>!['SHA256SUMS','BUILD-REPORT.txt'].includes(name)).sort();
if(!files.length)throw new Error('No desktop package was built.');
const checks=[];
for(const name of files){
 const hash=createHash('sha256');
 for await(const chunk of createReadStream(new URL(name,directory)))hash.update(chunk);
 checks.push(`${hash.digest('hex')}  ${name}`);
}
await writeFile(new URL('SHA256SUMS',directory),checks.join('\n')+'\n');
await writeFile(new URL('BUILD-REPORT.txt',directory),`Commit: ${process.env.GITHUB_SHA||'local'}\nPlatform: ${process.env.DESKTOP_PLATFORM||process.platform}\nSigned: no\nStore submission: no\n`);
