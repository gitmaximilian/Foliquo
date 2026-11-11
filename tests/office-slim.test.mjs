import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,access,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {slimTargets,slimOffice,pdfSignature,verifySlimOffice} from '../scripts/office-slim.mjs';
import {findOffice} from '../lib/formats.mjs';

const exists=path=>access(path).then(()=>true,()=>false);

test('slimming never touches macOS and names platform libraries correctly',()=>{
 assert.deepEqual(slimTargets('/office','darwin'),[]);
 assert.ok(slimTargets('/office','linux').some(path=>path.endsWith(join('program','libsclo.so'))));
 assert.ok(slimTargets('/office','win32').some(path=>path.endsWith(join('program','sclo.dll'))));
 for(const platform of ['linux','win32'])for(const kept of ['swlo','mergedlo','sw','writerfilter','chart','sweb','swriter','writer.xcd','main.xcd'])assert.ok(!slimTargets('/office',platform).some(path=>path.split(/[\\/]/).pop().replace(/^lib/,'').replace(/\.(so|dll)$/,'')===kept),`${platform} keeps ${kept}`);
});

test('slimming removes unused modules and keeps Writer and the internal HTML template',async t=>{
 const root=await mkdtemp(join(tmpdir(),'foliquo-office-slim-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const file=async(path,content='x')=>{await mkdir(join(root,...path.split('/').slice(0,-1)),{recursive:true});await writeFile(join(root,...path.split('/')),content);};
 for(const path of ['program/libswlo.so','program/libsclo.so','program/libsdlo.so','share/gallery/a.png','share/wizards/w.py','share/template/common/internal/html.stw','share/template/common/presnt/p.otp','share/template/en-US/forms/f.ott','share/config/soffice.cfg/modules/swriter/x.xml','share/config/soffice.cfg/modules/scalc/x.xml','share/registry/writer.xcd','share/registry/calc.xcd'])await file(path);
 const result=await slimOffice(root,'linux');
 assert.ok(result.removed>0);
 for(const kept of ['program/libswlo.so','share/template/common/internal/html.stw','share/config/soffice.cfg/modules/swriter/x.xml','share/registry/writer.xcd'])assert.equal(await exists(join(root,...kept.split('/'))),true,kept);
 for(const removed of ['program/libsclo.so','program/libsdlo.so','share/gallery','share/wizards','share/template/common/presnt','share/template/en-US','share/config/soffice.cfg/modules/scalc','share/registry/calc.xcd'])assert.equal(await exists(join(root,...removed.split('/'))),false,removed);
 assert.deepEqual(await readdir(join(root,'share/template/common')),['internal']);
});

test('PDF signatures ignore metadata but detect content changes',async()=>{
 const make=async(text,title)=>{const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),page=pdf.addPage([300,300]);page.drawText(text,{x:20,y:250,font,size:12});pdf.setTitle(title);pdf.setCreationDate(new Date(title.length*1000));return pdf.save();};
 assert.deepEqual(await pdfSignature(await make('Fictional','A')),await pdfSignature(await make('Fictional','Another title')));
 assert.notDeepEqual(await pdfSignature(await make('Fictional','A')),await pdfSignature(await make('Fictional changed','A')));
});

test('conversion check runs every export and upload format with the installed LibreOffice',{timeout:180000},async t=>{
 let soffice;try{soffice=await findOffice();}catch{t.skip('LibreOffice is not installed.');return;}
 assert.deepEqual(await verifySlimOffice(soffice,soffice),['german.docx','english.docx','arabic.html','note.txt','german.odt','german.rtf','german.doc']);
});
