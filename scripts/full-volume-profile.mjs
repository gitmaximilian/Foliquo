import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {mkdtemp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {SecureStore} from '../lib/secure-store.mjs';

const run=promisify(execFile),id='fictional-full-volume-object-0001',MIB=1024*1024;
if(process.platform!=='darwin')throw new Error('The genuine full-volume profile requires macOS hdiutil.');
const root=await mkdtemp(join(tmpdir(),'foliquo-full-volume-profile-'));
const image=join(root,'bounded-test.sparsebundle'),mount=join(root,'mount');
let attached=false;
try{
 await mkdir(mount);
 await run('hdiutil',['create','-quiet','-size','192m','-type','SPARSEBUNDLE','-fs','APFS','-volname','Foliquo ENOSPC Test',image]);
 await run('hdiutil',['attach','-quiet','-nobrowse','-mountpoint',mount,image]);attached=true;
 const key=randomBytes(32),store=new SecureStore(join(mount,'workspace'),key),previous=Buffer.from('previous committed fictional value');
 await store.write(id,'record',previous);
 let filled=0;
 for(;;){
  try{await writeFile(join(mount,`filler-${String(filled).padStart(4,'0')}`),randomBytes(MIB),{flag:'wx'});filled++;}
  catch(error){if(error.code==='ENOSPC')break;throw error;}
  if(filled>220)throw new Error('The bounded test volume did not reach ENOSPC within its 192 MiB limit.');
 }
 let observed;
 try{await store.write(id,'record',randomBytes(16*MIB));}
 catch(error){observed=error.code;}
 assert.equal(observed,'ENOSPC','replacement must fail on the genuinely full mounted filesystem');
 assert.deepEqual(await store.read(id,'record'),previous,'the last committed encrypted object must survive disk full');
 const names=await readdir(join(mount,'workspace','record'));
 assert.deepEqual(names,[`${id}.enc`],'failed replacement must leave no temporary ciphertext');
 console.log(JSON.stringify({mode:'genuine-full-volume-atomic-replacement',platform:`${process.platform}/${process.arch}`,volume:'isolated 192 MiB APFS sparsebundle',fillerFiles:filled,replaceBytes:16*MIB,error:observed,previousObjectPreserved:true,temporaryFilesRemaining:0,providerRequests:0}));
}finally{
 if(attached)await run('hdiutil',['detach','-quiet',mount]).catch(async()=>{await run('hdiutil',['detach','-force','-quiet',mount]);});
 await rm(root,{recursive:true,force:true});
}
