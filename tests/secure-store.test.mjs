import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFile,mkdir,mkdtemp,readFile,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {SecureStore} from '../lib/secure-store.mjs';

const id='fictional-object-id-0001';
async function fixture(t){const directory=await mkdtemp(join(tmpdir(),'foliquo-secure-store-')),key=randomBytes(32),store=new SecureStore(directory,key);t.after(()=>rm(directory,{recursive:true,force:true}));return {directory,key,store};}

test('secure objects stream writes, encrypt at rest, and bind identity and type to authentication',async t=>{
 const {directory,key,store}=await fixture(t),source=Buffer.from('fictional document bytes');
 async function* chunks(){yield source.subarray(0,7);yield source.subarray(7);}
 await store.write(id,'original',chunks());const path=join(directory,'original',`${id}.enc`),sealed=await readFile(path);
 assert.equal(sealed.includes(source),false);assert.deepEqual(await store.read(id,'original'),source);
 await mkdir(join(directory,'working'));await copyFile(path,join(directory,'working',`${id}.enc`));await assert.rejects(()=>store.read(id,'working'),/authentication/);
 await assert.rejects(()=>new SecureStore(directory,randomBytes(32)).read(id,'original'),/authentication/);
 assert.equal(key.length,32);
});

test('secure object ids, types, tampering, and symlinks are rejected',async t=>{
 const {directory,store}=await fixture(t);await assert.rejects(()=>store.write('../private','original',Buffer.from('x')),/id/);await assert.rejects(()=>store.write(id,'unknown',Buffer.from('x')),/type/);
 await store.write(id,'record',Buffer.from('fictional record'));const path=join(directory,'record',`${id}.enc`),bytes=await readFile(path);bytes[bytes.length-1]^=1;await writeFile(path,bytes);await assert.rejects(()=>store.read(id,'record'),/authentication/);
 await rm(path);const outside=join(directory,'outside');await writeFile(outside,'not encrypted');await symlink(outside,path);await assert.rejects(()=>store.read(id,'record'),/regular file/);await assert.rejects(()=>store.remove(id,'record'),/regular file/);
});
