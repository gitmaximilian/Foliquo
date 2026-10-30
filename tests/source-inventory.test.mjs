import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {createCanvas} from '@napi-rs/canvas';
import {buildSourceInventory,extractEmbeddedSourceBlocks,sourceCoverage} from '../lib/source-inventory.mjs';
import {extractLocalOcrSourceBlocks} from '../lib/learning-analysis.mjs';
import {documentFromLegacyText} from '../lib/document-adapter.mjs';

test('source inventory creates deterministic page IDs, links extracted fields, and leaves unreviewed page content open',()=>{
 const files=[{data:Buffer.from('fictional input').toString('base64')}],fields=[{label:'Document number',source:'DEMO-482',translated:'Dokumentnummer DEMO-482',fileIndex:0,page:2,box:[.1,.2,.3,.1]}],document=documentFromLegacyText('Dokumentnummer DEMO-482\nWeitere Übersetzung');
 const input={files,pageCounts:[2],fields,regions:[],document},first=buildSourceInventory(input),second=buildSourceInventory(input);
 assert.deepEqual(first,second);assert.equal(first.items.length,3);assert.notEqual(first.items[0].id,first.items[1].id);
 const page=first.items.find(item=>item.kind==='other'&&item.page===1),field=first.items.find(item=>item.label==='Document number');
 assert.equal(page.coverageStatus,'unreviewed');assert.equal(field.coverageStatus,'mapped');assert.deepEqual(field.targetNodeIds,[document.blocks[0].id]);assert.equal(field.pageId,first.items.find(item=>item.page===2&&item.label==='Seite 2').id);
 assert.deepEqual(first.summary,{total:3,reviewed:1,mapped:1,open:2,percent:33,label:'zugeordnete/geprüfte Quellbereiche'});
});

test('source coverage recognizes explicit reviewed states and reports zero items honestly',()=>{
 assert.equal(sourceCoverage([]).percent,0);assert.equal(sourceCoverage([{coverageStatus:'unreadable-confirmed'},{coverageStatus:'excluded-reviewed'},{coverageStatus:'unreviewed'}]).reviewed,2);
});

test('duplicate source observations normalize once and table cells remain addressable nodes',()=>{
 const field={label:'Number',source:'DEMO-482',translated:'Nummer | DEMO-482',fileIndex:0,page:1,box:[.1,.2,.3,.1]},document=documentFromLegacyText('Nummer | DEMO-482');
 const inventory=buildSourceInventory({files:[{data:'ZmljdGlvbmFs'}],pageCounts:[1],fields:[field],regions:[{...field,kind:'stamp'}],document});
 assert.equal(inventory.items.length,2);assert.deepEqual(inventory.items[1].targetNodeIds,[document.blocks[0].rows[0][0].id,document.blocks[0].rows[0][1].id]);
});

test('embedded source PDF text is extracted locally with normalized source coordinates',async()=>{
 const pdf=await PDFDocument.create(),page=pdf.addPage([600,800]),font=await pdf.embedFont(StandardFonts.Helvetica);page.drawText('Fictional source paragraph',{x:72,y:700,size:14,font});const blocks=await extractEmbeddedSourceBlocks([{type:'application/pdf',bytes:Buffer.from(await pdf.save())}]);
 assert.equal(blocks.length,1);assert.equal(blocks[0].sourceText,'Fictional source paragraph');assert.equal(blocks[0].kind,'heading');assert.equal(blocks[0].extractionMethod,'embedded-text');assert.equal(blocks[0].fileIndex,0);assert.equal(blocks[0].page,1);assert.equal(blocks[0].box.length,4);assert.ok(blocks[0].box.every(value=>value>=0&&value<=1));
 const limited=await extractEmbeddedSourceBlocks([{type:'application/pdf',bytes:Buffer.from(await pdf.save())}],{maxPages:0});assert.equal(limited.truncated,true);assert.equal(limited.length,0);
});

test('local OCR adds an explicitly uncertain page-level source block with unknown geometry',async()=>{
 const canvas=createCanvas(1200,500),context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,1200,500);context.fillStyle='#000';context.font='bold 76px Arial';context.fillText('FICTIONAL SOURCE TEXT',55,220);
 const pdf=await PDFDocument.create();pdf.addPage([600,300]);const page=pdf.addPage([600,300]),image=await pdf.embedPng(canvas.toBuffer('image/png'));page.drawImage(image,{x:20,y:20,width:560,height:260});const blocks=await extractLocalOcrSourceBlocks([{name:'fictional-scan.pdf',type:'application/pdf',bytes:Buffer.from(await pdf.save())}],{pageSelection:[{fileIndex:0,page:2}]});
 assert.equal(blocks.length,1);assert.match(blocks[0].sourceText,/FICTIONAL SOURCE TEXT/i);assert.equal(blocks[0].page,2);assert.equal(blocks[0].box,null);assert.equal(blocks[0].extractionMethod,'local-ocr');assert.equal(blocks[0].certainty,'uncertain');assert.ok(Number.isFinite(blocks[0].confidence));
 const inventory=buildSourceInventory({files:[{data:Buffer.from('fictional scan').toString('base64')}],pageCounts:[2],sourceBlocks:blocks,document:documentFromLegacyText('target text')});const ocr=inventory.items.find(item=>item.extractionMethod==='local-ocr');assert.equal(ocr.coverageStatus,'unreviewed');assert.equal(ocr.confidence,blocks[0].confidence);assert.equal(ocr.page,2);assert.equal(inventory.items.filter(item=>item.kind==='other'&&item.label.startsWith('Seite')).length,2);
});

test('optional local OCR failures stay visible as incomplete review instead of failing the translated document',async()=>{
 const blocks=await extractLocalOcrSourceBlocks([{name:'broken.pdf',type:'application/pdf',bytes:Buffer.from('not a PDF')}]);assert.equal(blocks.length,0);assert.equal(blocks.ocrIncomplete,true);
});
