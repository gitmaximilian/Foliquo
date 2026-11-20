import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import sharp from 'sharp';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {createTranslationWord} from '../lib/word.mjs';
import {sourcePageImages} from '../lib/source-page-images.mjs';

async function fictionalPdf(pages){const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);for(let index=0;index<pages;index++)pdf.addPage([595,842]).drawText(`Fictional source page ${index+1}`,{x:60,y:760,font,size:14});return Buffer.from(await pdf.save());}

test('source PDFs and photos become one page image each, in order, at print resolution',async()=>{
 const photo=await sharp({create:{width:900,height:1200,channels:3,background:'#dddddd'}}).jpeg().toBuffer();
 const pages=await sourcePageImages([{name:'fictional.pdf',type:'application/pdf',bytes:await fictionalPdf(2)},{name:'fictional.jpg',type:'image/jpeg',bytes:photo}]);
 assert.equal(pages.length,3);
 assert.deepEqual(pages.map(page=>page.type),['image/jpeg','image/jpeg','image/jpeg']);
 assert.equal(Math.max(pages[0].width,pages[0].height),1754);
 assert.deepEqual([pages[2].width,pages[2].height],[900,1200]);
});

test('the Word download appends every source page after the translation without the translation header',async()=>{
 const pages=await sourcePageImages([{name:'fictional.pdf',type:'application/pdf',bytes:await fictionalPdf(2)}]);
 const files=unzipSync(createTranslationWord('FIKTIVE URKUNDE\nName | Alex Example',{language:'Arabisch',targetLanguage:'Deutsch',originalPages:pages}));
 const xml=strFromU8(files['word/document.xml']),rels=strFromU8(files['word/_rels/document.xml.rels']),types=strFromU8(files['[Content_Types].xml']);
 assert.ok(files['word/media/original-1.jpeg']&&files['word/media/original-2.jpeg']);
 assert.ok(xml.indexOf('Alex Example')<xml.indexOf('r:embed="rIdOriginal1"'),'translation comes first');
 assert.ok(xml.indexOf('rIdOriginal1')<xml.indexOf('rIdOriginal2'),'source pages keep their order');
 assert.match(xml,/descr="Ausgangsdokument, Seite 2"/);
 assert.equal((xml.match(/<w:sectPr>/g)||[]).length,2,'translation and source pages are separate sections');
 assert.match(xml.slice(xml.lastIndexOf('<w:sectPr>')),/r:id="rIdOriginalHeader"/);
 assert.doesNotMatch(strFromU8(files['word/header-original.xml']),/Beglaubigte/);
 assert.match(rels,/Target="media\/original-1\.jpeg"/);assert.match(types,/Extension="jpeg"/);
});

test('without source pages the Word file is unchanged in structure',()=>{
 const files=unzipSync(createTranslationWord('Name | Alex Example',{language:'Arabisch',targetLanguage:'Deutsch'}));
 assert.equal(Object.keys(files).some(name=>name.startsWith('word/media/')),false);
 assert.equal((strFromU8(files['word/document.xml']).match(/<w:sectPr>/g)||[]).length,1);
});

test('LibreOffice opens the Word file with the source pages as separate pages',{timeout:180000},async t=>{
 const {findOffice}=await import('../lib/formats.mjs');try{await findOffice();}catch{t.skip('LibreOffice is not installed.');return;}
 const {officeToPDF}=await import('../lib/formats.mjs');
 const pages=await sourcePageImages([{name:'fictional.pdf',type:'application/pdf',bytes:await fictionalPdf(2)}]);
 const pdf=await PDFDocument.load(await officeToPDF(createTranslationWord('FIKTIVE URKUNDE\nName | Alex Example',{language:'Arabisch',targetLanguage:'Deutsch',originalPages:pages}),'docx'));
 assert.equal(pdf.getPageCount(),3);
});
