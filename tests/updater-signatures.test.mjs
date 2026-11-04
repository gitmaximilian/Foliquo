import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {verifyUpdaterSignature} from '../scripts/check-updater-signatures.mjs';

test('updater verification binds artifact bytes, application key and signed release version',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-updater-signature-'));t.after(()=>rm(directory,{recursive:true,force:true}));const file=join(directory,'fictional-update.bin'),bytes=Buffer.from('FICTIONAL UPDATE ARTIFACT'),{publicKey,privateKey}=generateKeyPairSync('ed25519'),id=Buffer.alloc(8,0x37),keyPacket=Buffer.concat([Buffer.from('Ed'),id,publicKey.export({format:'der',type:'spki'}).subarray(-32)]),messageSignature=sign(null,createHash('blake2b512').update(bytes).digest(),privateKey),packet=Buffer.concat([Buffer.from('ED'),id,messageSignature]),comment='timestamp:0\tfile:fictional-update.bin\tversion:0.12.0',globalSignature=sign(null,Buffer.concat([messageSignature,Buffer.from(comment)]),privateKey),encodedKey=Buffer.from('untrusted comment: fictional key\n'+keyPacket.toString('base64')+'\n').toString('base64'),signatureText='untrusted comment: fictional signature\n'+packet.toString('base64')+'\ntrusted comment: '+comment+'\n'+globalSignature.toString('base64')+'\n',encodedSignature=Buffer.from(signatureText).toString('base64');await writeFile(file,bytes);
 assert.deepEqual(await verifyUpdaterSignature(file,encodedSignature,encodedKey,{version:'0.12.0'}),{version:'0.12.0',verified:true});await assert.rejects(verifyUpdaterSignature(file,encodedSignature,encodedKey,{version:'0.12.1'}),/announced version/);await assert.rejects(verifyUpdaterSignature(file,Buffer.from(signatureText.replace('version:0.12.0','version:0.12.1')).toString('base64'),encodedKey,{version:'0.12.1'}),/trusted-comment signature/);
 const wrongKey=Buffer.from('untrusted comment: fictional key\n'+Buffer.concat([Buffer.from('Ed'),Buffer.alloc(8,0x38),keyPacket.subarray(10)]).toString('base64')+'\n').toString('base64');await assert.rejects(verifyUpdaterSignature(file,encodedSignature,wrongKey,{version:'0.12.0'}),/public key/);await writeFile(file,'CHANGED FICTIONAL ARTIFACT');await assert.rejects(verifyUpdaterSignature(file,encodedSignature,encodedKey,{version:'0.12.0'}),/artifact signature/);
});
