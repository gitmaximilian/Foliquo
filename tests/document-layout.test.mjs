import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {createDocumentModel,validateDocumentModel} from '../lib/document-model.mjs';
import {documentFromLegacyText,documentToLegacyText} from '../lib/document-adapter.mjs';
import {createTranslationWord} from '../lib/word.mjs';
import {modelLayoutIssues} from '../lib/document-layout.mjs';
import {layoutSettings} from '../lib/workspace.mjs';
import {editedResult} from '../lib/protection.mjs';
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

test('combined oversized headers are not repeated and their limitation is reported as an estimate',()=>{
 const model=createDocumentModel({blocks:[table('large-header',[['Header A','X'.repeat(1600)],['Header B','Y'.repeat(1600)],['Body','DEMO-BODY']],{headerRows:2})]}),output=xml(model),issues=modelLayoutIssues(model,layoutSettings());
 assert.doesNotMatch(output,/w:tblHeader/);assert.match(output,/DEMO-BODY/);assert.ok(issues.some(issue=>issue.code==='oversized-table-header'&&issue.estimated===true));
});

test('explicit columns retain logical reading order and constrain tables to their column width',()=>{
 const props=index=>({columnGroup:'fictional-columns',columnCount:2,columnIndex:index,columnWidth:index===0?70:30}),model=createDocumentModel({blocks:[{id:'intro',type:'paragraph',content:'Fictional introduction'},{id:'left',type:'paragraph',content:'LEFT_MARKER',properties:props(0)},{...table('left-table',[['Entry','Value']]),properties:props(0)},{id:'right',type:'paragraph',content:'RIGHT_MARKER',properties:props(1)},{id:'after',type:'paragraph',content:'AFTER_COLUMNS'}]}),saved=JSON.stringify(model),output=xml(model),text=documentToLegacyText(model);
 assert.match(output,/<w:cols w:num="2"/);assert.match(output,/<w:br w:type="column"/);assert.ok(text.indexOf('LEFT_MARKER')<text.indexOf('RIGHT_MARKER'));assert.ok(output.indexOf('RIGHT_MARKER')<output.indexOf('AFTER_COLUMNS'));assert.ok(Number(output.match(/<w:tblW w:w="(\d+)"/)[1])<7000);assert.equal(JSON.stringify(model),saved);const end=createDocumentModel({blocks:[model.blocks[1],model.blocks[3]]}),ending=xml(end);assert.equal((ending.match(/<w:sectPr>/g)||[]).length,1);assert.match(ending,/<w:cols w:num="2"/);
 const bad=[{id:'a',type:'paragraph',content:'a',properties:props(0)},{id:'b',type:'paragraph',content:'b',properties:props(1)},{id:'c',type:'paragraph',content:'c',properties:props(0)}];assert.throws(()=>createDocumentModel({blocks:bad}),/Dokumentstruktur/);assert.throws(()=>createDocumentModel({blocks:bad.slice(0,1)}),/Dokumentstruktur/);
});


test('unresolved handwriting cannot be flattened by normalization or exported',async()=>{
 const document=createDocumentModel({blocks:[{id:'hand',type:'paragraph',content:'Fictional date 7.3.1998',properties:{role:'handwriting',handwritingState:'uncertain'}}]}),before=JSON.stringify(document),job={targetLanguage:'Deutsch',result:{text:'Previously reviewed result',document:documentFromLegacyText('Previously reviewed result')}};
 assert.throws(()=>editedResult(job,{document}),error=>error.code==='ERR_DOCUMENT_HANDWRITING_UNCERTAIN');
 assert.throws(()=>createTranslationWord(document),error=>error.code==='ERR_DOCUMENT_HANDWRITING_UNCERTAIN');
 await assert.rejects(()=>createTranslationPDF(document,[]),error=>error.code==='ERR_DOCUMENT_HANDWRITING_UNCERTAIN');
 assert.equal(job.result.text,'Previously reviewed result');assert.equal(JSON.stringify(document),before);
 document.blocks[0].properties.handwritingState='confirmed';const saved=editedResult(job,{document});assert.equal(saved.document.blocks[0].properties.handwritingState,'confirmed');assert.equal(saved.document.blocks[0].content,'Fictional date 07.03.1998');assert.equal(JSON.stringify(document),before.replace('uncertain','confirmed'));
 document.blocks[0].content='[Handschriftlich: unleserlich]';document.blocks[0].properties.handwritingState='unreadable';assert.match(xml(editedResult(job,{document}).document),/Handschriftlich: unleserlich/);
});

test('structured date normalization preserves columns and source references',()=>{
 const properties=index=>({columnGroup:'dates',columnCount:2,columnIndex:index}),document=createDocumentModel({blocks:[{id:'a',type:'paragraph',content:'Fictional 7.3.1998',sourceBlockIds:['original-date'],properties:properties(0)},{id:'b',type:'paragraph',content:'Fictional 8.4.1999',properties:properties(1)}]}),before=JSON.stringify(document),result=editedResult({targetLanguage:'Deutsch',result:{text:''}},{document});
 assert.equal(result.document.blocks[0].id,'a');assert.deepEqual(result.document.blocks[0].sourceBlockIds,['original-date']);assert.deepEqual(result.document.blocks[1].properties,properties(1));assert.match(result.text,/07.03.1998/);assert.match(result.text,/08.04.1999/);assert.equal(JSON.stringify(document),before);
});
