import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PDFDocument,PDFName,StandardFonts} from 'pdf-lib';
import {analyzeScan,correctScan,SCAN_BOUNDS} from '../lib/scans.mjs';
import {locationsOnOriginal} from '../lib/source-geometry.mjs';
import {fictionalScanPDF} from './fixtures/scan-fixtures.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('real image/text PDF pages produce bounded, sequential local hints and a checked rotation suggestion',async()=>{
 const fixture=await fictionalScanPDF(),original=hash(fixture.bytes),pages=[],report=await analyzeScan({name:'fictional-scans.pdf',type:'application/pdf',bytes:fixture.bytes},{onPage:page=>pages.push(page.number)});
 assert.equal(report.complete,true);assert.equal(report.pages,6);assert.deepEqual(pages,[1,2,3,4,5,6]);for(const [index,expected]of fixture.expected.entries()){const page=report.pageReports[index];assert.equal(page.status,'analyzed');if(expected)assert.ok(page.warningCodes.includes(expected),JSON.stringify({index,page}));assert.ok(page.sampleWidth*page.sampleHeight<=SCAN_BOUNDS.maxPagePixels);assert.ok(page.sampleWidth<=700&&page.sampleHeight<=700);assert.ok(!Object.hasOwn(page,'data')&&!Object.hasOwn(page,'image'));}
 assert.equal(report.pageReports[0].pageKind,'image-pdf');assert.equal(report.pageReports[0].resolution.dpi,144);assert.equal(report.pageReports[0].orientationStatus,'unknown');assert.equal(report.pageReports[4].orientationSuggestion.rotation,270);assert.equal(report.pageReports[5].pageKind,'text-pdf');assert.ok(!report.pageReports[5].warningCodes.includes('overexposed'));assert.equal(hash(fixture.bytes),original);
});

test('cancellation stops the remaining PDF pages without changing the source',async()=>{
 const fixture=await fictionalScanPDF(),original=hash(fixture.bytes),controller=new AbortController(),pages=[];await assert.rejects(analyzeScan({name:'fictional-cancel.pdf',type:'application/pdf',bytes:fixture.bytes},{signal:controller.signal,onPage:page=>{pages.push(page.number);if(page.number===2)controller.abort();}}),error=>error.name==='AbortError');assert.deepEqual(pages,[1,2]);assert.equal(hash(fixture.bytes),original);
});

test('per-page correction, reordering and source coordinates retain the untouched original',async()=>{
 const fixture=await fictionalScanPDF(),original=hash(fixture.bytes),correction={pageOrder:[5,1,2,3,4,6],rotations:{1:270},crops:{1:[.1,.2,.6,.5]}},corrected=await correctScan({name:'fictional-original.pdf',type:'application/pdf',bytes:fixture.bytes},correction),pdf=await PDFDocument.load(corrected.bytes),source=await PDFDocument.load(fixture.bytes);
 assert.equal(pdf.getPageCount(),6);assert.equal(pdf.getPage(0).getRotation().angle,0);assert.equal(pdf.getPage(1).getRotation().angle,0);assert.equal(source.getPage(4).getRotation().angle,90);assert.equal(hash(fixture.bytes),original);assert.deepEqual(locationsOnOriginal([{fileIndex:0,page:1,box:[.2,.3,.4,.2]}],[{fileIndex:0,...correction}],['application/pdf'])[0],{fileIndex:0,page:5,box:[.4,.3,.12,.2]});
 await assert.rejects(correctScan({name:'fictional.pdf',type:'application/pdf',bytes:fixture.bytes},{rotations:{7:90}}),/Seitendrehungen/);
});


test('a real unreadable page is reported as failed while the remaining page is still inspected',async()=>{
 const pdf=await PDFDocument.create(),broken=pdf.addPage([500,700]);broken.node.set(PDFName.of('Contents'),pdf.context.register(pdf.context.flateStream(Buffer.from('q /MissingFictionalImage Do Q'))));const font=await pdf.embedFont(StandardFonts.Helvetica),good=pdf.addPage([500,700]);for(let line=0;line<3;line++)good.drawText('FICTIONAL READABLE PAGE '+line,{x:50,y:600-line*30,font,size:12});const bytes=Buffer.from(await pdf.save()),report=await analyzeScan({name:'fictional-partially-invalid.pdf',type:'application/pdf',bytes});assert.equal(report.complete,false);assert.equal(report.pageReports[0].status,'failed');assert.deepEqual(report.pageReports[0].warningCodes,['analysis-failed']);assert.equal(report.pageReports[1].status,'analyzed');assert.ok(report.warnings.some(warning=>warning.includes('nicht analysiert')));
});
