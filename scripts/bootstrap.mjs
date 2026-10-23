import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
if(Number(process.versions.node.split('.')[0])<22)throw new Error('Node.js ab 22 erforderlich; Node 24 LTS empfohlen.');
const root=fileURLToPath(new URL('..',import.meta.url));
const npm=spawnSync(process.platform==='win32'?'cmd.exe':'npm',process.platform==='win32'?['/d','/s','/c','npm.cmd ci --ignore-scripts']:['ci','--ignore-scripts'],{cwd:root,stdio:'inherit'});
if(npm.status!==0)process.exit(npm.status||1);
const doctor=spawnSync(process.execPath,['scripts/check-install.mjs'],{cwd:root,stdio:'inherit'});if(doctor.status!==0)process.exit(doctor.status||1);
console.log('Einrichtung geprüft. Mit npm start öffnen; Demo ohne Konto verfügbar.');
