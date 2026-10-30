import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createReadStream,createWriteStream} from 'node:fs';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {Workspace} from '../lib/workspace.mjs';

const MIB=1024*1024,fixtureMiB=Number(process.env.FOLIQUO_BACKUP_SCALE_MIB||260);
if(!Number.isInteger(fixtureMiB)||fixtureMiB<257||fixtureMiB>500)throw new Error('FOLIQUO_BACKUP_SCALE_MIB must be an integer from 257 through 500.');
const sourceDir=await mkdtemp(join(tmpdir(),'foliquo-backup-scale-source-')),restoredDir=await mkdtemp(join(tmpdir(),'foliquo-backup-scale-restored-')),archive=join(tmpdir(),`foliquo-backup-scale-${process.pid}.enc`),passphrase='fictional backup scale passphrase';
try{
 const text='F'.repeat(fixtureMiB*MIB),expectedHash=createHash('sha256').update(text).digest('hex'),source=await new Workspace(sourceDir).init();
 source.data.jobs=[{id:'fictional-backup-scale-job',owner:'fictional-backup-scale-owner',status:'succeeded',createdAt:Date.now(),finishedAt:Date.now(),result:{text},questions:[]}];
 await source.save();
 await pipeline(Readable.from(source.backupStream(passphrase)),createWriteStream(archive,{flags:'wx',mode:0o600}));
 const archiveBytes=(await stat(archive)).size;assert.ok(archiveBytes>256*MIB,`archive should exceed 256 MiB; got ${archiveBytes} bytes`);
 const restored=await new Workspace(restoredDir,{lazyJobs:true}).init();await restored.restoreStream(createReadStream(archive),passphrase,{owner:'fictional-restored-owner'});await restored.save();
 const job=await restored.jobStore.getJob('fictional-backup-scale-job');assert.equal(job.owner,'fictional-restored-owner');assert.equal(job.result.text.length,fixtureMiB*MIB);assert.equal(createHash('sha256').update(job.result.text).digest('hex'),expectedHash);
 console.log(JSON.stringify({mode:'streaming-portable-backup-restore',fixtureMiB,archiveBytes,sha256:expectedHash,sourceAndRestoreTemporaryDirectories:true}));
}finally{await rm(sourceDir,{recursive:true,force:true});await rm(restoredDir,{recursive:true,force:true});await rm(archive,{force:true});}
