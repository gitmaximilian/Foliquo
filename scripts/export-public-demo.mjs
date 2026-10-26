// Only explicit fictional demo assets are copied. Never package the local workspace.
import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const destination=process.argv[2];
if(!destination)throw new Error('Usage: node scripts/export-public-demo.mjs <destination>');
const out=resolve(destination);await mkdir(out,{recursive:true});
for(const name of ['demo.css','demo.js','assets'])await cp(join(root,'dist/demo',name),join(out,name),{recursive:true});
const html=(await readFile(join(root,'dist/demo/index.html'),'utf8'))
 .replace('<body>','<body data-return="projects">')
 .replace('id="back-to-app" href="/">Back to Foliquo','id="back-to-app" href="../../?lang=en">Back to projects')
 .replace('id="demo-exit" href="/">Back to Foliquo','id="demo-exit" href="../../?lang=en">Back to projects')
 .replace('id="demo-home" href="/"','id="demo-home" href="../../?lang=en"');
await writeFile(join(out,'index.html'),html);
console.log('Public fictional demo exported. No account or local service required.');
