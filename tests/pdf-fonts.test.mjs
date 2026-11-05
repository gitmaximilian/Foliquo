import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,PDFName,StandardFonts} from 'pdf-lib';
import {inspectTranslationFonts} from '../lib/pdf-fonts.mjs';
import {auditArtifacts} from '../lib/preflight.mjs';
import {createTranslationWord} from '../lib/word.mjs';

test('PDF font inspection excludes the original annex and reports the actual Word request separately',async()=>{
 const source=await PDFDocument.create(),courier=await source.embedFont(StandardFonts.Courier);source.addPage().drawText('FICTIONAL ORIGINAL',{font:courier});const original=Buffer.from(await source.save());
 const pdf=await PDFDocument.create(),helvetica=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage().drawText('Fictional translation',{font:helvetica});for(const page of await pdf.copyPages(source,[0]))pdf.addPage(page);
 const result={text:'Fictional translation',pdf:Buffer.from(await pdf.save()).toString('base64'),word:createTranslationWord('Fictional translation').toString('base64'),previews:[{name:'fictional-original.pdf',type:'application/pdf',data:original.toString('base64')}]},before=JSON.stringify(result),report=await auditArtifacts(result);
 assert.equal(report.translationPages,1);assert.deepEqual(report.fonts.actual,['Helvetica']);assert.equal(report.fonts.requested,'Aptos');assert.equal(report.fonts.requestedSize,11);assert.equal(report.fonts.substituted,true);assert.ok(report.issues.some(issue=>issue.code==='font-substitution'));assert.equal(JSON.stringify(result),before);
});
test('font inspection normalizes subset names, bounds page scans and keeps missing metadata unknown',async()=>{
 const pdf=await PDFDocument.create();for(let i=0;i<4;i++)pdf.addPage();pdf.getPage(0).node.set(PDFName.of('Resources'),pdf.context.obj({Font:{F1:{Type:'Font',Subtype:'Type1',BaseFont:PDFName.of('ABCDEF+Aptos')}}}));
 const report=inspectTranslationFonts(pdf,4,{maxPages:2});assert.deepEqual(report.actual,['Aptos']);assert.equal(report.scannedPages,2);assert.equal(report.limited,true);
 const empty=await PDFDocument.create();empty.addPage();assert.equal(inspectTranslationFonts(empty,1).status,'unknown');assert.deepEqual(inspectTranslationFonts(empty,1).actual,[]);
});
