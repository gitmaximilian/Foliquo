import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {createTranslationPDF} from '../lib/documents.mjs';
import {createTranslationWord,outputBundle} from '../lib/word.mjs';
import {officeToPDF} from '../lib/formats.mjs';
import {zipSync,strToU8} from 'fflate';

const root=fileURLToPath(new URL('..',import.meta.url)),out=join(root,'dist/demo/assets');
await mkdir(out,{recursive:true});
const locales={
 de:{target:'Deutsch',source:'Englisch',name:'Name',birth:'Geburtsdatum',number:'Dokumentnummer',features:'Merkmale',none:'keine besonderen Merkmale',front:'(Vorderseite)',back:'(Rückseite)',stamp:'[Stempel: Fiktive Demo-Behörde]',signature:'[Unterschrift vorhanden]',sample:'FIKTIVES MUSTERDOKUMENT',original:'FICTIONAL SAMPLE DRIVING LICENCE'},
 en:{target:'English',source:'Arabisch',name:'Name',birth:'Date of birth',number:'Document number',features:'Features',none:'No distinguishing features',front:'(Front)',back:'(Back)',stamp:'[Stamp: fictional demo authority]',signature:'[Signature present]',sample:'FICTIONAL SAMPLE TRANSLATION',original:'نموذج خيالي لرخصة قيادة'},
 ar:{target:'Arabisch',source:'Englisch',name:'الاسم',birth:'تاريخ الميلاد',number:'رقم الوثيقة',features:'السمات',none:'لا توجد سمات مميزة',front:'(الوجه الأمامي)',back:'(الوجه الخلفي)',stamp:'[الختم: جهة تجريبية خيالية]',signature:'[يوجد توقيع]',sample:'مستند نموذجي خيالي',original:'FICTIONAL SAMPLE DRIVING LICENCE'}
};

async function makeOriginal(locale){
 if(locale==='en'){
  const escape=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const paragraph=(s,bold=false)=>`<w:p><w:pPr><w:bidi/><w:jc w:val="right"/><w:spacing w:after="260"/></w:pPr><w:r><w:rPr><w:rtl/>${bold?'<w:b/><w:bCs/>':''}</w:rPr><w:t xml:space="preserve">${escape(s)}</w:t></w:r></w:p>`;
  const front=['رخصة قيادة مصرية نموذجية','الوجه الأمامي','الاسم: عمر حسن','تاريخ الميلاد: 7 مارس 1998','رقم الرخصة: DEMO-12345','مستند خيالي لأغراض العرض فقط'].map((s,i)=>paragraph(s,i===0)).join('');
  const back=['الوجه الخلفي','الختم: جهة تجريبية خيالية','يوجد توقيع','لا يمثل شخصًا أو جهة حقيقية'].map(paragraph).join('');
  const document=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${front}<w:p><w:r><w:br w:type="page"/></w:r></w:p>${back}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1200" w:right="1200" w:bottom="1200" w:left="1200"/></w:sectPr></w:body></w:document>`;
  const types='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const docx=Buffer.from(zipSync({'[Content_Types].xml':strToU8(types),'_rels/.rels':strToU8(rels),'word/document.xml':strToU8(document)}));
  return Buffer.from(await officeToPDF(docx,'docx'));
 }
 const original=await PDFDocument.create(),font=await original.embedFont(StandardFonts.Helvetica);
 for(const side of ['FRONT','BACK']){
  const page=original.addPage([595,842]);page.drawRectangle({x:0,y:0,width:595,height:842,color:rgb(.97,.96,.99)});
  for(const[i,line]of ['FICTIONAL EGYPTIAN SAMPLE DRIVING LICENCE',side,'Name: Omar Hassan','Date of birth: 7 March 1998','Licence number: DEMO-12345','Stamp: fictional demo authority','No real person or authority'].entries())page.drawText(line,{x:55,y:760-i*75,size:i===0?16:14,font});
 }
 return Buffer.from(await original.save());
}

for(const [locale,labels] of Object.entries(locales)){
 const source=await makeOriginal(locale);
 await writeFile(join(out,`original-${locale}.pdf`),source);
 for(const version of ['initial','final']){
  const name=version==='final'?'Omar Hasan':'Omar Hassan';
  const translatedName=locale==='ar'?`عمر حسن (${name})`:name;
  const text=[labels.sample,labels.front,`${labels.name} | ${translatedName}`,`${labels.birth} | 07.03.1998`,`${labels.number} | DEMO-12345`,`${labels.features} | ${labels.none}`,labels.back,labels.stamp,labels.signature].join('\n');
  const metadata={language:labels.source,targetLanguage:labels.target,example:true};
  const pdf=await createTranslationPDF(text,[{type:'application/pdf',name:`fictional-driving-licence-${locale}.pdf`,bytes:source}],metadata);
  const word=createTranslationWord(text,metadata);
  const stem=`${locale}-${version}`;
  await writeFile(join(out,`${stem}.pdf`),pdf);
  await writeFile(join(out,`${stem}.docx`),word);
  await writeFile(join(out,`${stem}.zip`),outputBundle(pdf,word));
 }
}

// Only the explicit public fixture directory is packaged. Never read the local workspace.
const archive={};
for(const name of ['index.html','demo.css','demo.js'])archive[name]=new Uint8Array(await readFile(join(root,'dist/demo',name)));
for(const name of [...Object.keys(locales).map(locale=>`original-${locale}.pdf`),...Object.keys(locales).flatMap(locale=>['initial','final'].flatMap(version=>[`${locale}-${version}.pdf`,`${locale}-${version}.docx`,`${locale}-${version}.zip`]))])archive[`assets/${name}`]=new Uint8Array(await readFile(join(out,name)));
await mkdir(join(root,'outputs'),{recursive:true});
await writeFile(join(root,'outputs/TranslateOCR-Demo.zip'),zipSync(archive,{level:6}));
console.log('Public fixture demo built in English, German, and Arabic: dist/demo; outputs/TranslateOCR-Demo.zip. No private files read.');
