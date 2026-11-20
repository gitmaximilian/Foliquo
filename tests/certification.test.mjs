import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {certificationClause,certificationClauseFor,certifiedHeaderLines,certificationChecks,certificationChoices,validateCertificationProfile,normalizeCertificationProfile,formatCertificationDate} from '../lib/certification.mjs';
import {createTranslationWord} from '../lib/word.mjs';
import {translationTitle} from '../lib/translation-policy.mjs';

const plain=xml=>xml.replace(/<w:p[ >]/g,'\n$&').replace(/<[^>]+>/g,'').replace(/[ \t]+/g,' ');
const date=new Date(2026,10,20,12);

test('the German clause follows the § 190 AußStrG wording for each source form (guide B 2)',()=>{
 const clause=form=>certificationClause({language:'Ukrainisch',targetLanguage:'Deutsch',certification:{sourceForm:form}},{place:'Wien'},date)[0].text;
 assert.equal(clause('attached-original'),'Die genaue Übereinstimmung der vorstehenden Übersetzung mit dem angehefteten Original bestätige ich unter Berufung auf meinen Eid.');
 assert.match(clause('presented-original'),/mit dem vorliegenden Original bestätige ich/);
 assert.match(clause('attached-copy'),/mit der angehefteten Kopie bestätige ich/);
 assert.match(clause('attached-certified-copy'),/mit der angehefteten beglaubigten Kopie bestätige ich/);
});

test('place and production date are part of the clause; seal and signature are never generated (guide B 2, C)',()=>{
 const paragraphs=certificationClause({language:'Ukrainisch',targetLanguage:'Deutsch'},{place:'Graz'},date);
 assert.equal(paragraphs.at(-1).text,'Graz, 20.11.2026');
 assert.equal(formatCertificationDate(new Date(2026,0,5)),'05.01.2026');
 assert.doesNotMatch(paragraphs.map(item=>item.text).join(' '),/Siegel|Unterschrift|seal|signature/i);
});

test('the clause is bilingual for English and Arabic and the foreign version is labelled as a translation (guide B 7)',()=>{
 const en=certificationClause({language:'Englisch',targetLanguage:'Deutsch'},{place:'Wien'},date),ar=certificationClause({language:'Deutsch',targetLanguage:'Arabisch',certification:{sourceForm:'attached-copy'}},{place:'Wien'},date);
 assert.equal(en.length,3);assert.match(en[1].text,/^\[Translation of the certification clause\] I confirm, invoking my oath, that the foregoing translation corresponds exactly to the attached original\.$/);
 assert.equal(ar[1].language,'ar');assert.match(ar[1].text,/^\[ترجمة صيغة التصديق\] .*النسخة المرفقة\.$/);
 assert.equal(certificationClause({language:'Englisch',targetLanguage:'Deutsch'},{place:'Wien',bilingual:false},date).length,2);
 assert.equal(certificationClause({language:'Ukrainisch',targetLanguage:'Deutsch'},{place:'Wien'},date).length,2);
});

test('headers use the guide wording in German plus the other language, and mark excerpts (guide D 4)',()=>{
 assert.deepEqual(certifiedHeaderLines({language:'Arabisch',targetLanguage:'Deutsch'}).map(line=>line.text),['Beglaubigte Übersetzung aus der arabischen Sprache in die deutsche Sprache','ترجمة مصدّقة من اللغة العربية إلى اللغة الألمانية']);
 assert.deepEqual(certifiedHeaderLines({language:'Deutsch',targetLanguage:'Englisch',certification:{excerpt:true}}).map(line=>line.text),['Certified partial translation from German into English','Beglaubigte auszugsweise Übersetzung aus der deutschen Sprache in die englische Sprache']);
 assert.equal(certifiedHeaderLines({language:'Französisch',targetLanguage:'Deutsch'})[1].text,'Traduction certifiée du français vers l’allemand');
 assert.equal(certifiedHeaderLines({language:'Ukrainisch',targetLanguage:'Deutsch'}).length,1);
 assert.equal(translationTitle({language:'Deutsch',targetLanguage:'Italienisch'}),'Traduzione certificata dal tedesco in italiano');
});

test('profiles and per-export choices are validated',()=>{
 assert.deepEqual(validateCertificationProfile({place:' Wien ',languages:['Arabisch','Deutsch'],sourceForm:'attached-copy'}),{place:'Wien',languages:['Arabisch'],bilingual:true,sourceForm:'attached-copy',route:'paper'});
 assert.throws(()=>validateCertificationProfile({languages:['Klingonisch']}),/Sprachauswahl/);
 assert.throws(()=>validateCertificationProfile({sourceForm:'stapled'}),/Vorlageart/);
 assert.throws(()=>certificationChoices({enabled:true,route:'fax'}),/Weg/);
 assert.deepEqual(certificationChoices(true,{sourceForm:'presented-original',route:'electronic'}),{enabled:true,sourceForm:'presented-original',route:'electronic',excerpt:false,bilingual:true});
 assert.equal(certificationChoices(false).enabled,false);
 assert.equal(normalizeCertificationProfile(null).place,'');
});

test('checks warn about missing place, unlisted languages, relay pairs, blank runs, signatures and copies (guide B, D 3, D 5, D 9)',()=>{
 const ids=input=>certificationChecks(input).map(check=>check.id);
 assert.deepEqual(ids({metadata:{language:'Arabisch',targetLanguage:'Deutsch'},profile:{place:'Wien',languages:['Arabisch']}}),[]);
 assert.ok(ids({metadata:{language:'Arabisch',targetLanguage:'Deutsch'},profile:{}}).includes('place'));
 assert.deepEqual(ids({metadata:{language:'Persisch',targetLanguage:'Deutsch'},profile:{place:'Wien',languages:['Arabisch']}}),['language']);
 assert.deepEqual(ids({metadata:{language:'Arabisch',targetLanguage:'Englisch'},profile:{place:'Wien',languages:['Arabisch','Englisch']}}),['relay']);
 const blank=certificationChecks({text:'Name\n\n\n\nEnde',metadata:{language:'Arabisch',targetLanguage:'Deutsch'},profile:{place:'Wien'}});
 assert.deepEqual(blank.find(check=>check.id==='blank'),{id:'blank',severity:'warning',line:2,length:3});
 assert.ok(ids({text:'[Unterschrift: unleserlich]',regions:[{kind:'signature'},{kind:'signature'}],metadata:{language:'Arabisch',targetLanguage:'Deutsch'},profile:{place:'Wien'}}).includes('signature'));
 assert.ok(!ids({text:'[Unterschrift: unleserlich]\n[Unterschrift: Alex Example]',regions:[{kind:'signature'},{kind:'signature'}],metadata:{language:'Arabisch',targetLanguage:'Deutsch'},profile:{place:'Wien'}}).includes('signature'));
 assert.ok(ids({metadata:{language:'Arabisch',targetLanguage:'Deutsch',certification:{sourceForm:'attached-copy'}},profile:{place:'Wien'}}).includes('copy'));
});

test('Word places a rule, the clause and seal space after the last text block (guide B 3)',()=>{
 const word=createTranslationWord('GEBURTSURKUNDE\nName | Alex Example\n[Unterschrift: unleserlich]',{language:'Arabisch',targetLanguage:'Deutsch',certification:{enabled:true,sourceForm:'attached-original',date:'2026-11-20'},certificationProfile:{place:'Wien',languages:['Arabisch']}});
 const files=unzipSync(word),xml=strFromU8(files['word/document.xml']),text=plain(xml),header=plain(strFromU8(files['word/header1.xml']));
 assert.match(header,/Beglaubigte Übersetzung aus der arabischen Sprache in die deutsche Sprache/);
 const last=text.indexOf('[Unterschrift: unleserlich]'),clause=text.indexOf('Die genaue Übereinstimmung'),place=text.indexOf('Wien, 20.11.2026');
 assert.ok(last>0&&clause>last&&place>clause);
 const rule=xml.lastIndexOf('<w:bottom w:val="single"');assert.ok(rule>xml.indexOf('[Unterschrift: unleserlich]')&&rule<xml.indexOf('Die genaue'));
 assert.match(xml.slice(xml.lastIndexOf('20.11.2026')),/w:line="2835" w:lineRule="exact"/);
 assert.equal(text.slice(place+'Wien, 20.11.2026'.length).trim(),'');
});

test('without an explicit choice no clause is inserted',()=>{
 assert.equal(certificationClauseFor({}),null);
 assert.equal(certificationClauseFor({certification:{enabled:false}}),null);
 const xml=strFromU8(unzipSync(createTranslationWord('Name | Alex Example',{language:'Arabisch',targetLanguage:'Deutsch'}))['word/document.xml']);
 assert.doesNotMatch(xml,/Übereinstimmung/);
});

test('the exported PDF carries the header, ends the translation with the clause and then appends the source pages (guide B 3, D 2, D 4)',{timeout:180000},async t=>{
 const {findOffice}=await import('../lib/formats.mjs');try{await findOffice();}catch{t.skip('LibreOffice is not installed.');return;}
 const {createTranslationPDF}=await import('../lib/documents.mjs'),{getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),{PDFDocument}=await import('pdf-lib');
 const source=await PDFDocument.create();source.addPage([595,842]);source.addPage([595,842]);
 const bytes=await createTranslationPDF('FIKTIVE GEBURTSURKUNDE\nName | Alex Example\nGeburtsdatum | 01.02.2000\n[Unterschrift: unleserlich]',[{name:'original.pdf',type:'application/pdf',bytes:Buffer.from(await source.save())}],{language:'Arabisch',targetLanguage:'Deutsch',certification:{enabled:true,sourceForm:'attached-original',excerpt:true,date:'2026-11-20'},certificationProfile:{place:'Wien',languages:['Arabisch']}});
 const pdf=await getDocument({data:new Uint8Array(bytes)}).promise,pages=[];
 for(let index=1;index<=pdf.numPages;index++)pages.push((await (await pdf.getPage(index)).getTextContent()).items.map(item=>item.str).join(' ').replace(/\s+/g,' '));
 const translation=pages.slice(0,pdf.numPages-2).join(' ');
 assert.match(translation,/Beglaubigte auszugsweise Übersetzung aus der arabischen Sprache in die deutsche Sprache/);
 // Font substitution can split ligatures in extracted text (e.g. macOS), so compare order on space-free text;
 // the exact clause wording is asserted on the Word file above.
 const compact=translation.replace(/\s+/g,''),at=marker=>compact.indexOf(marker);
 assert.ok(at('unleserlich')>0,'last source line is present');
 assert.ok(at('DiegenaueÜbereinstimmungdervorstehendenÜbersetzungmitdem')>at('unleserlich'),'clause follows the last text');
 assert.ok(at('bestätigeichunterBerufungaufmeinenEid.')>at('DiegenaueÜbereinstimmung'),'clause is complete');
 assert.ok(at('Wien,')>at('meinenEid.'),'place and date follow the clause');
 assert.deepEqual(pages.slice(-2).map(page=>page.trim()),['','']);
});

test('pairs without a verified foreign clause are reported as German-only (guide B 7)',async()=>{
 const {clauseGermanOnly}=await import('../lib/certification.mjs');
 assert.equal(clauseGermanOnly({language:'Ukrainisch',targetLanguage:'Deutsch'}),true);
 assert.equal(clauseGermanOnly({language:'Englisch',targetLanguage:'Deutsch'}),false);
 assert.equal(clauseGermanOnly({language:'Deutsch',targetLanguage:'Arabisch'}),false);
 assert.equal(clauseGermanOnly({language:'Deutsch',targetLanguage:'Französisch'}),true);
});
