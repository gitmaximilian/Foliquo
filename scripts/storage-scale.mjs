import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pipeline} from 'node:stream/promises';
import {JobStore} from '../lib/job-store.mjs';

const directory=await mkdtemp(join(tmpdir(),'foliquo-storage-scale-'));
const objectBytes=11*1024*1024,jobCount=100,totalBytes=objectBytes*jobCount,key=randomBytes(32),expectedHashes=[];
const hash=value=>createHash('sha256').update(value).digest('hex');
const hashFile=async path=>{const digest=createHash('sha256');for await(const chunk of createReadStream(path))digest.update(chunk);return digest.digest('hex');};
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
 const largeResultBytes=161*1024*1024,largeResult=Buffer.alloc(largeResultBytes,0x5a),largeResultHash=hash(largeResult),largeResultBase64=largeResult.toString('base64'),largeJobId='fictional-large-result-over-cache-limit';
 await writer.commitJob({id:largeJobId,owner:'fictional-scale-owner',status:'succeeded',createdAt:jobCount+1,finishedAt:jobCount+2,result:{text:'Fictional large result',pdf:largeResultBase64},questions:[]});
 assert.equal(writer.getObjectInfo(largeJobId,['result','pdf'],'fictional-scale-owner').size,largeResultBytes);
 const resultStore=await new JobStore(directory,key,{cacheBytes:16*1024*1024}).init();
 const largeResultExport=join(directory,'fictional-large-result-export.tmp');
 await resultStore.withJobObject(largeJobId,['result','pdf'],'fictional-scale-owner',async({tempPath,size})=>{assert.equal(size,largeResultBytes);await pipeline(createReadStream(tempPath),createWriteStream(largeResultExport,{mode:0o600}));});
 assert.equal(await hashFile(largeResultExport),largeResultHash,'a >160 MiB result artifact remains byte-identical after store restart and streamed export.');
 console.log(JSON.stringify({mode:'real-file-encrypted-job-store-scale',jobs:jobCount,bytesPerJob:objectBytes,totalBytes,restoredAndExportedBytes:restoredBytes,largeResultBytes,largeResultExportedBytes:largeResultBytes,largeResultSha256:largeResultHash,records:resultStore.listSummaries().length,cacheBytes:resultStore.cacheSize,cacheBudget:resultStore.cacheBytes}));
}finally{await rm(directory,{recursive:true,force:true});}
