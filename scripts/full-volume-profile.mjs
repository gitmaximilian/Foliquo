import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {mkdtemp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {SecureStore} from '../lib/secure-store.mjs';

const run=promisify(execFile),id='fictional-full-volume-object-0001',MIB=1024*1024;
const root=await mkdtemp(join(tmpdir(),'foliquo-full-volume-profile-'));
const image=join(root,process.platform==='win32'?'bounded-test.vhd':'bounded-test.sparsebundle');
const mount=join(root,'mount');let cleanup=async()=>{};

async function prepareMac(){
 await mkdir(mount);
 await run('hdiutil',['create','-quiet','-size','192m','-type','SPARSEBUNDLE','-fs','APFS','-volname','Foliquo ENOSPC Test',image]);
 await run('hdiutil',['attach','-quiet','-nobrowse','-mountpoint',mount,image]);
 cleanup=async()=>{await run('hdiutil',['detach','-quiet',mount]).catch(async()=>{await run('hdiutil',['detach','-force','-quiet',mount]);});};
 return mount;
}

async function prepareWindows(){
 let letter;for(const candidate of 'RSTUVWXYZ'){if(!existsSync(`${candidate}:\\`)){letter=candidate;break;}}
 if(!letter)throw new Error('No unused drive letter is available for the isolated full-volume test.');
 const script=join(root,'diskpart.txt');
 await writeFile(script,[`create vdisk file="${image}" maximum=192 type=expandable`,`select vdisk file="${image}"`,'attach vdisk','create partition primary','format fs=ntfs quick label=FoliquoTest',`assign letter=${letter}`,'exit'].join('\r\n')+'\r\n');
 await run('diskpart.exe',['/s',script]);
 const volume=`${letter}:\\`,user=process.env.USERNAME||process.env.USER||'runneradmin';
 await run('icacls.exe',[volume,'/grant',`${user}:(OI)(CI)F`]);
 cleanup=async()=>{
  await writeFile(script,[`select vdisk file="${image}"`,'detach vdisk','exit'].join('\r\n')+'\r\n');
  await run('diskpart.exe',['/s',script]);
  // Windows may keep the detached VHD locked briefly while the virtual disk
  // service releases its handle. Retry removal here so cleanup is included in
  // the profile result instead of turning a successful ENOSPC check into a
  // spurious failure.
  await rm(image,{force:true,maxRetries:20,retryDelay:250});
 };
 return volume;
}

try{
 let directory;
 if(process.platform==='darwin')directory=await prepareMac();
 else if(process.platform==='linux'){
  await run('truncate',['-s','192M',image]);
  const loop=(await run('sudo',['losetup','--find','--show',image])).stdout.trim();
  try{
   await run('sudo',['mkfs.ext4','-F','-m','0',loop]);await mkdir(mount);await run('sudo',['mount',loop,mount]);await run('sudo',['chown',`${process.getuid()}:${process.getgid()}`,mount]);
  }catch(error){await run('sudo',['losetup','-d',loop]).catch(()=>{});throw error;}
  cleanup=async()=>{await run('sudo',['umount',mount]).catch(()=>{});await run('sudo',['losetup','-d',loop]).catch(()=>{});};directory=mount;
 }else if(process.platform==='win32')directory=await prepareWindows();
 else throw new Error(`The genuine full-volume profile is unsupported on ${process.platform}.`);

 const key=randomBytes(32),store=new SecureStore(join(directory,'workspace'),key),previous=Buffer.from('previous committed fictional value');
 await store.write(id,'record',previous);
 let filled=0;
 for(;;){
  try{await writeFile(join(directory,`filler-${String(filled).padStart(4,'0')}`),randomBytes(MIB),{flag:'wx'});filled++;}
  catch(error){if(error.code==='ENOSPC')break;throw error;}
  if(filled>220)throw new Error('The bounded test volume did not reach ENOSPC within its 192 MiB limit.');
 }
 let observed;
 try{await store.write(id,'record',randomBytes(16*MIB));}
 catch(error){observed=error.code;}
 assert.equal(observed,'ENOSPC','replacement must fail on the genuinely full mounted filesystem');
 assert.deepEqual(await store.read(id,'record'),previous,'the last committed encrypted object must survive disk full');
 const names=await readdir(join(directory,'workspace','record'));
 assert.deepEqual(names,[`${id}.enc`],'failed replacement must leave no temporary ciphertext');
 console.log(JSON.stringify({mode:'genuine-full-volume-atomic-replacement',platform:`${process.platform}/${process.arch}`,volume:`isolated 192 MiB ${process.platform==='darwin'?'APFS sparsebundle':process.platform==='win32'?'NTFS VHD':'ext4 loopback image'}`,fillerFiles:filled,replaceBytes:16*MIB,error:observed,previousObjectPreserved:true,temporaryFilesRemaining:0,providerRequests:0}));
}finally{
 try{await cleanup();}finally{await rm(root,{recursive:true,force:true});}
}
