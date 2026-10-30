import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSourceInventory,sourceCoverage} from '../lib/source-inventory.mjs';
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
