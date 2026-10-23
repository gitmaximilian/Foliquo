import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import {unzipSync} from 'fflate';
import {translationTitle} from '../lib/translation-policy.mjs';

const read=path=>readFile(new URL(path,import.meta.url));

test('guided demo offers English, German, and Arabic with RTL semantics and localized content',async()=>{
 const html=(await read('../dist/demo/index.html')).toString(),js=(await read('../dist/demo/demo.js')).toString();
 for(const locale of ['en','de','ar'])assert.match(html,new RegExp(`value="${locale}"`));
 assert.match(html,/id="locale"/);assert.match(js,/document\.documentElement\.dir=locale==='ar'\?'rtl':'ltr'/);
 for(const phrase of ['Try it for yourself.','Einmal ausprobieren.','جرّبه بنفسك.','Certified translation from Arabic into English','Beglaubigte Übersetzung aus dem Englischen ins Deutsche','ترجمة مصدّقة من الإنجليزية إلى العربية'])assert.ok(js.includes(phrase),`missing demo localization: ${phrase}`);
});

test('each localized demo export contains its target-language translation and both original pages',async()=>{
 const expected={de:['Beglaubigte Übersetzung aus dem Englischen ins Deutsche','keine besonderen Merkmale'],en:['Certified translation from Arabic into English','No distinguishing features'],ar:['ترجمة مصدّقة من اإلنجليزية إلى العربية','لا توجد سمات مميزة']};
 for(const locale of ['de','en','ar']){
  const original=await PDFDocument.load(await read(`../dist/demo/assets/original-${locale}.pdf`));assert.equal(original.getPageCount(),2,`${locale} source should include front and back`);
  for(const version of ['initial','final']){
   const pdfBytes=await read(`../dist/demo/assets/${locale}-${version}.pdf`),pdf=await PDFDocument.load(pdfBytes);assert.ok(pdf.getPageCount()>=3,`${locale} ${version} PDF should include translation and both source pages`);
   const docx=unzipSync(new Uint8Array(await read(`../dist/demo/assets/${locale}-${version}.docx`))),xml=new TextDecoder().decode(docx['word/document.xml']);
   assert.ok(xml.includes(expected[locale][1]),`${locale} Word output should be translated`);
   const bundle=unzipSync(new Uint8Array(await read(`../dist/demo/assets/${locale}-${version}.zip`)));assert.ok(bundle['uebersetzung.pdf']);assert.ok(bundle['uebersetzung.docx']);
  }
 }
});

test('certification headings use the selected target language and translated source-language name',()=>{
 assert.equal(translationTitle({language:'Arabisch',targetLanguage:'English'}),'Certified translation from Arabic into English');
 assert.equal(translationTitle({language:'Englisch',targetLanguage:'Deutsch'}),'Beglaubigte Übersetzung aus dem Englischen ins Deutsche');
 assert.equal(translationTitle({language:'Englisch',targetLanguage:'Arabisch'}),'ترجمة مصدّقة من الإنجليزية إلى العربية');
});
