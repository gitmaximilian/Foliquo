import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {createDocumentModel,validateDocumentModel} from '../lib/document-model.mjs';
import {documentFromLegacyText} from '../lib/document-adapter.mjs';
import {createTranslationWord} from '../lib/word.mjs';
import {createTranslationPDF} from '../lib/documents.mjs';

const table=(id,values,properties={})=>({id,type:'table',relativeColumnWidths:[30,70],rows:values.map((row,r)=>row.map((text,c)=>({id:`${id}-${r}-${c}`,text,sourceBlockIds:[`source-${id}-${r}`]}))),keepRows:true,properties});
const xml=(model,metadata={})=>strFromU8(unzipSync(createTranslationWord(model,{targetLanguage:'Deutsch',...metadata}))['word/document.xml']);

test('structured Word retains adjacent tables, literal pipes, headings and source references',()=>{
 const model=createDocumentModel({blocks:[{id:'heading',type:'heading',content:'FICTIONAL CERTIFICATE'},table('first',[['Label','Value'],['Literal | label','DEMO-A']],{headerRows:1}),table('second',[['Other label','Other value'],['Fictional field','DEMO-B']],{headerRows:1}),{id:'stamp',type:'stamp',content:'Fictional authority\nStamp | literal text'},{id:'note',type:'paragraph',content:'Fictional note\nSecond fictional line'},{id:'signature',type:'paragraph',content:'[Unterschrift: unleserlich]',properties:{role:'signature'}}]}),saved=JSON.stringify(model),output=xml(model);
 assert.equal((output.match(/<w:tbl>/g)||[]).length,3);assert.equal((output.match(/<w:tbl>.*?<\/w:tbl>/)?.[0].match(/<w:tc>/g)||[]).length,4);assert.equal((output.match(/<w:tblHeader\/>/g)||[]).length,2);assert.match(output,/<w:keepNext\/>/);assert.match(output,/Literal \| label/);assert.match(output,/Stamp \| literal text/);assert.match(output,/<w:br\/>/);assert.match(output,/w:sz w:val="22"/);assert.equal(JSON.stringify(model),saved);
});
test('header continuations repeat the original header across an explicit page boundary and a chain',()=>{
 const model=createDocumentModel({blocks:[table('first',[['Column A','Column B'],['Row A','DEMO-A']],{headerRows:1}),{id:'break',type:'pageBreak'},table('second',[['Row B','DEMO-B']],{continuationOf:'first'}),table('third',[['Row C','DEMO-C']],{continuationOf:'second'})]}),output=xml(model);
 assert.equal((output.match(/Column A/g)||[]).length,3);assert.equal((output.match(/<w:tblHeader\/>/g)||[]).length,3);assert.equal((output.match(/<w:br w:type="page"\/>/g)||[]).length,1);for(const token of ['DEMO-A','DEMO-B','DEMO-C'])assert.equal((output.match(new RegExp(token,'g'))||[]).length,1);
 assert.throws(()=>validateDocumentModel(createDocumentModel({blocks:[table('orphan',[['A','B']],{continuationOf:'missing'})]})),/Dokumentstruktur/);
});
test('oversized rows can continue without forcing all ordinary rows to split',()=>{
 const model=createDocumentModel({blocks:[table('long',[['Label','Value'],['Short row','DEMO-SHORT'],['Long row',('Fictional continued content. ').repeat(2000)]],{headerRows:1})]}),output=xml(model),rows=output.match(/<w:tr>.*?<\/w:tr>/g);
 assert.equal(rows.length,3);assert.match(rows[0],/w:tblHeader/);assert.match(rows[1],/w:cantSplit/);assert.doesNotMatch(rows[2],/w:cantSplit/);assert.equal((rows[2].match(/Fictional continued content\./g)||[]).length,2000);
 assert.doesNotMatch(xml(model,{layout:{keepRows:false}}),/w:cantSplit/);
});
test('automatic table widths follow the job layout while an explicit width remains authoritative',()=>{
 const model=documentFromLegacyText('Fictional label | Fictional value'),grid=output=>[...output.matchAll(/w:gridCol w:w="(\d+)"/g)].map(match=>Number(match[1]));
 const automatic=grid(xml(model,{layout:{tableLabelWidth:65}}));assert.ok(automatic[0]>automatic[1]);
 model.blocks[0].properties.widthsExplicit=true;const explicit=grid(xml(model,{layout:{tableLabelWidth:65}}));assert.equal(explicit[0],explicit[1]);
});
test('stale text/model combinations cannot silently export the wrong content',async()=>{
 const document=documentFromLegacyText('Fictional original result');assert.throws(()=>createTranslationWord('Different fictional result',{document}),/passen nicht zusammen/);await assert.rejects(()=>createTranslationPDF('Different fictional result',[],{document}),/passen nicht zusammen/);
});
