import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {buildSourceInventory,extractEmbeddedSourceBlocks} from '../lib/source-inventory.mjs';
import {documentFromLegacyText} from '../lib/document-adapter.mjs';

test('synthetic 100-field gold PDF keeps omitted source blocks open without flagging present targets',async()=>{
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),gold=[];
 for(let pageNumber=1;pageNumber<=5;pageNumber++){
  const page=pdf.addPage([600,800]);
  for(let row=0;row<20;row++){
   const index=(pageNumber-1)*20+row+1,source=`FICTIONAL-FIELD-${String(index).padStart(3,'0')}: source value ${String(index).padStart(3,'0')}`;
   page.drawText(source,{x:40,y:760-row*28,size:10,font});gold.push({index,page:pageNumber,source,target:`TARGET-${String(index).padStart(3,'0')}`});
  }
 }
 const bytes=Buffer.from(await pdf.save()),files=[{name:'fictional-gold.pdf',type:'application/pdf',data:bytes.toString('base64')}],sourceBlocks=await extractEmbeddedSourceBlocks([{name:files[0].name,type:files[0].type,bytes}]);
 assert.equal(sourceBlocks.length,100);
 const present=new Set([1,2,3,4,5]),bySource=new Map(gold.map(item=>[item.source,item]));
 const annotated=sourceBlocks.map(block=>{const item=[...bySource.values()].find(candidate=>candidate.source===block.sourceText);assert.ok(item,block.sourceText);return {...block,translated:present.has(item.index)?item.target:''};});
 const document=documentFromLegacyText([...present].map(index=>gold[index-1].target).join('\n'));
 const inventory=buildSourceInventory({files,pageCounts:[5],sourceBlocks:annotated,document}),items=inventory.items.filter(item=>item.extractionMethod==='embedded-text');
 const open=items.filter(item=>item.coverageStatus==='unreviewed'),mapped=items.filter(item=>item.coverageStatus==='mapped'),omitted=items.filter(item=>!present.has(Number(item.sourceText.match(/FIELD-(\d+)/u)?.[1])));
 const omissionRecall=omitted.filter(item=>item.coverageStatus==='unreviewed').length/omitted.length,falseAlarmRate=items.filter(item=>present.has(Number(item.sourceText.match(/FIELD-(\d+)/u)?.[1]))&&item.coverageStatus==='unreviewed').length/present.size;
 assert.equal(mapped.length,5);assert.equal(open.length,95);assert.ok(omissionRecall>=.95);assert.ok(falseAlarmRate<=.05);
});
