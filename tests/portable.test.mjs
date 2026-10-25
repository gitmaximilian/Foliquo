import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {officeCandidates,specialImageToPNG,prepareDocuments} from '../lib/formats.mjs';
import {PDFDocument} from 'pdf-lib';
test('LibreOffice lookup supports native Windows paths, Linux and explicit overrides',()=>{
 const win=officeCandidates({platform:'win32',env:{ProgramFiles:'C:\\Program Files','ProgramFiles(x86)':'C:\\Program Files (x86)'}});assert.equal(win[0],'C:\\Program Files\\LibreOffice\\program\\soffice.com');assert.ok(win.includes('C:\\Program Files\\LibreOffice\\program\\soffice.exe'));assert.equal(win.some(p=>p.includes('/Users/')),false);
 assert.equal(officeCandidates({platform:'linux',env:{TRANSLATEOCR_SOFFICE:'/custom/soffice'}})[0],'/custom/soffice');assert.ok(officeCandidates({platform:'linux',env:{}}).includes('/usr/bin/libreoffice'));
 assert.ok(officeCandidates({platform:'win32',env:{},resources:'C:\\App\\Resources'}).includes('C:\\App\\Resources\\libreoffice\\program\\soffice.com'));
 assert.ok(officeCandidates({platform:'darwin',env:{},resources:'/Applications/Foliquo.app/Contents/Resources'}).includes('/Applications/Foliquo.app/Contents/Resources/libreoffice/LibreOffice.app/Contents/MacOS/soffice'));
});
test('BMP colours decode correctly without a platform executable',async()=>{
 const bytes=Buffer.alloc(62);bytes.write('BM');bytes.writeUInt32LE(62,2);bytes.writeUInt32LE(54,10);bytes.writeUInt32LE(40,14);bytes.writeInt32LE(2,18);bytes.writeInt32LE(1,22);bytes.writeUInt16LE(1,26);bytes.writeUInt16LE(24,28);bytes.writeUInt32LE(8,34);Buffer.from([0,0,255,255,0,0,0,0]).copy(bytes,54);
 const png=await specialImageToPNG({type:'image/bmp',bytes});assert.deepEqual([...await sharp(png).removeAlpha().raw().toBuffer()],[255,0,0,0,0,255]);const docs=await prepareDocuments([{name:'sample.bmp',type:'image/bmp',extension:'bmp',bytes}]);assert.equal((await PDFDocument.load(docs[0].bytes)).getPageCount(),1);
 await assert.rejects(specialImageToPNG({type:'image/bmp',bytes:Buffer.from('BM')}));
});
test('HEIC decodes to PNG and PDF without macOS sips',async()=>{
 const bytes=await readFile(new URL('./fixtures/portable-red.heic',import.meta.url));const png=await specialImageToPNG({type:'image/heic',bytes});const info=await sharp(png).metadata();assert.equal(info.width,64);assert.equal(info.height,64);const docs=await prepareDocuments([{name:'sample.heic',type:'image/heic',extension:'heic',bytes}]);assert.equal((await PDFDocument.load(docs[0].bytes)).getPageCount(),1);
});
