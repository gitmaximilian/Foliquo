import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {JobStore} from '../lib/job-store.mjs';

const directory=await mkdtemp(join(tmpdir(),'foliquo-storage-scale-'));
const objectBytes=11*1024*1024,jobCount=100,totalBytes=objectBytes*jobCount,key=randomBytes(32),expectedHashes=[];
const hash=value=>createHash('sha256').update(value).digest('hex');
try{
 const writer=await new JobStore(directory,key,{cacheBytes:16*1024*1024}).init();
 for(let index=0;index<jobCount;index++){
  const id=`fictional-scale-${String(index).padStart(3,'0')}`,bytes=Buffer.alloc(objectBytes,index%251),digest=hash(bytes);
  expectedHashes.push(digest);
  await writer.commitJob({id,owner:'fictional-scale-owner',status:'succeeded',createdAt:index+1,finishedAt:index+2,names:[`fictional-${index}.bin`],payload:{files:[{name:`fictional-${index}.bin`,type:'application/octet-stream',bytes}]},result:{text:`Fictional result ${index}`},questions:[]});
  writer.dropCache(id);
 }
 const reopened=await new JobStore(directory,key,{cacheBytes:16*1024*1024}).init();
 assert.equal(reopened.listSummaries({owner:'fictional-scale-owner'}).length,jobCount);
 const exportPath=join(directory,'fictional-export.tmp');let restoredBytes=0;
 for(let index=0;index<jobCount;index++){
  const id=`fictional-scale-${String(index).padStart(3,'0')}`,job=await reopened.getJob(id),bytes=job?.payload?.files?.[0]?.bytes;
  assert.ok(Buffer.isBuffer(bytes),`Job ${index} source must rehydrate as a binary Buffer.`);
  assert.equal(bytes.length,objectBytes,`Job ${index} source size must survive restart.`);
  assert.equal(hash(bytes),expectedHashes[index],`Job ${index} bytes must match exactly after restart.`);
  await writeFile(exportPath,bytes,{mode:0o600});const exported=await readFile(exportPath);
  assert.equal(hash(exported),expectedHashes[index],`Job ${index} export must match its stored source.`);
  restoredBytes+=exported.length;reopened.dropCache(id);
 }
 assert.equal(restoredBytes,totalBytes);
 console.log(JSON.stringify({mode:'real-file-encrypted-job-store-scale',jobs:jobCount,bytesPerJob:objectBytes,totalBytes,restoredAndExportedBytes:restoredBytes,records:reopened.listSummaries().length,cacheBytes:reopened.cacheSize,cacheBudget:reopened.cacheBytes}));
}finally{await rm(directory,{recursive:true,force:true});}
