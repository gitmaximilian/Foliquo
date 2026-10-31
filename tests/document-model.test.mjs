import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentModel,validateDocumentModel} from '../lib/document-model.mjs';
import {documentFromLegacyText,documentToLegacyText} from '../lib/document-adapter.mjs';
import {createTranslationWord} from '../lib/word.mjs';
import {strFromU8,unzipSync} from 'fflate';

test('legacy text adapter round-trips headings, mixed tables, blank lines, stamps, lists, page breaks, RTL, and final newline',()=>{
 const legacy='Vorderseite\nName: Alex Example\nNummer | DEMO-12345\n\n\tLabel\tValue\n\tA\tB\nStamp :\n  Fictional Authority  \n\n- first item\n2. second item\n[Seitenumbruch]\nالاسم: مثال\n';
 const document=documentFromLegacyText(legacy,{language:'Arabisch',layout:{font:'Aptos',fontSize:11}});
 assert.equal(document.schema,1);assert.equal(document.direction,'rtl');assert.equal(document.blocks[0].type,'heading');assert.deepEqual(document.blocks.filter(block=>block.type==='table').map(block=>block.rows.length),[1,2]);assert.ok(document.blocks.some(block=>block.type==='stamp'));assert.ok(document.blocks.some(block=>block.type==='list'));assert.ok(document.blocks.some(block=>block.type==='paragraph'&&block.content===''));assert.equal(documentToLegacyText(document),legacy);
});

test('document model has deterministic unique IDs and retains explicit source references',()=>{
 const sourceRefs=[{id:'src-1',fileIndex:0,page:1,box:[0,0,1,1],hash:'a'.repeat(64)}],first=documentFromLegacyText('Field | Value\nValue | 123',{sourceRefs}),second=documentFromLegacyText('Field | Value\nValue | 123',{sourceRefs});
 const allIds=[...first.blocks.map(block=>block.id),...first.blocks.flatMap(block=>block.rows?.flat().map(cell=>cell.id)||[])];assert.deepEqual(first,second);assert.deepEqual(first.sourceRefs,sourceRefs);assert.equal(new Set(allIds).size,allIds.length);assert.ok(allIds.length>first.blocks.length);
});

test('versioned document validation rejects unsupported nodes, duplicate IDs, invalid geometry, and unsafe sizes',()=>{
 const valid=createDocumentModel({blocks:[{id:'block-1',type:'paragraph',content:'Fictional text'}]});assert.equal(validateDocumentModel(valid),valid);
 assert.throws(()=>validateDocumentModel({...valid,blocks:[...valid.blocks,{id:'block-1',type:'paragraph',content:'duplicate'}]}),/Dokumentstruktur/);
 assert.throws(()=>validateDocumentModel({...valid,blocks:[{id:'bad',type:'script',content:'alert(1)'}]}),/Dokumentstruktur/);
 assert.throws(()=>validateDocumentModel({...valid,unexpected:{nested:'value'}}),/Dokumentstruktur/);
 assert.throws(()=>validateDocumentModel({...valid,blocks:[{id:'extra',type:'paragraph',content:'safe',unbounded:{nested:'value'}}]}),/Dokumentstruktur/);
 assert.throws(()=>validateDocumentModel({...valid,sourceRefs:[{id:'bad',fileIndex:0,page:1,box:[0,0,2,1]}]}),/Dokumentstruktur/);
 assert.throws(()=>documentFromLegacyText('x'.repeat(1000001)),/ungültig oder zu lang/);
});

test('legacy work remains untouched if adaptation fails and optional layout stays bounded to an object contract',()=>{
 const original='Fictional legacy result';assert.throws(()=>documentFromLegacyText('invalid\0legacy'),/ungültig/);assert.equal(original,'Fictional legacy result');
 const document=documentFromLegacyText(original);assert.throws(()=>validateDocumentModel({...document,layout:'<unsafe>'}),/Dokumentstruktur/);
});

test('legacy adapter preserves valid oversized text and falls back to paragraphs for structures outside model limits',()=>{
 const longLine='x'.repeat(25000),manyLines=Array.from({length:20001},(_,index)=>`line ${index}`).join('\n'),wideRow=Array.from({length:21},(_,index)=>`cell${index}`).join(' | '),manyRows=Array.from({length:1001},(_,index)=>`row${index} | value`).join('\n'),manyItems=Array.from({length:1001},(_,index)=>`- item ${index}`).join('\n');
 for(const legacy of [longLine,manyLines,wideRow,manyRows,manyItems])assert.equal(documentToLegacyText(documentFromLegacyText(legacy)),legacy);
 assert.throws(()=>validateDocumentModel({...documentFromLegacyText('short'),sourceRefs:false}),/Dokumentstruktur/);
 assert.throws(()=>validateDocumentModel({...documentFromLegacyText('short'),blocks:[{id:'large',type:'paragraph',content:'x'.repeat(1000000)},{id:'extra',type:'paragraph',content:'y'}]}),/Dokumentstruktur/);
});

test('Word export consumes the structured model and applies its validated table widths',()=>{
 const model=documentFromLegacyText('Fictional field | Fictional value\nAnother field | Another value');model.blocks.find(block=>block.type==='table').relativeColumnWidths=[25,75];const xml=strFromU8(unzipSync(createTranslationWord(model,{targetLanguage:'Deutsch'}))['word/document.xml']),widths=[...xml.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map(match=>Number(match[1]));
 assert.match(xml,/Fictional field/);assert.match(xml,/Another value/);assert.equal(widths.length,2);assert.ok(widths[0]<widths[1]);assert.ok(Math.abs(widths[0]/widths[1]-1/3)<0.02);
});
