import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {createImportBatch,suggestImportGroups,batchFiles,batchSnapshot,availableBatchSlots,nextBatchGroup,batchForOwner} from '../lib/import-batches.mjs';

const sourceFiles=()=>[0,1,2].map(index=>({name:`source-${index}.txt`,type:'text/plain',bytes:Buffer.from(`source-${index}`)}));
const create=groups=>createImportBatch({owner:'owner-a',clientId:'client',requestId:'request-one',provider:'openai',model:'model',metadata:{targetLanguage:'Deutsch'},files:sourceFiles(),groups,pageCounts:[1,1,1]});

 test('prepared import batches preserve explicit file groups and keep sources out of public snapshots',async()=>{
 const batch=create([{name:'Front and back',fileIndexes:[0,1]},{name:'Separate certificate',fileIndexes:[2]}]);
 assert.equal(batch.groups.length,2);
 assert.deepEqual((await batchFiles(batch,batch.groups[0])).map(file=>file.name),['source-0.txt','source-1.txt']);
 const snapshot=batchSnapshot(batch,[]);
 assert.equal(snapshot.remainingGroups,2);
 assert.equal(JSON.stringify(snapshot).includes('c291cmNlLTA'),false);
 assert.equal(JSON.stringify(snapshot).includes('data'),false);
});

test('PDF pages split into separate jobs with provenance and selected scan order',async()=>{
 const pdf=await PDFDocument.create();for(const size of [100,200,300,400])pdf.addPage([size,size]);const bytes=Buffer.from(await pdf.save());
 const batch=createImportBatch({owner:'owner-a',clientId:'client',requestId:'request-pages',provider:'openai',model:'model',metadata:{},files:[{name:'collection.pdf',type:'application/pdf',bytes}],pageCounts:[4],groups:[{name:'Pages one and three',items:[{fileIndex:0,pages:[1,3]}]},{name:'Pages two and four',items:[{fileIndex:0,pages:[2,4]}]}]});
 const first=await batchFiles(batch,batch.groups[0]);assert.equal(first[0].name,'collection-Seiten-1,3.pdf');
 const output=await PDFDocument.load(first[0].bytes);assert.equal(output.getPageCount(),2);assert.deepEqual(output.getPages().map(page=>page.getWidth()),[100,300]);
 assert.deepEqual(batchSnapshot(batch).groups.map(group=>group.names[0]),['collection.pdf · S. 1,3','collection.pdf · S. 2,4']);
});

test('batch grouping rejects missing, duplicate, overlapping and out-of-range files or pages',()=>{
 assert.throws(()=>create([{name:'one',fileIndexes:[0,1]},{name:'two',fileIndexes:[1,2]}]),/nur einem Auftrag/);
 assert.throws(()=>create([{name:'one',fileIndexes:[0]},{name:'two',fileIndexes:[1]}]),/jede ausgewählte Datei/);
 assert.throws(()=>create([{name:'one',fileIndexes:[0,4]},{name:'two',fileIndexes:[1,2]}]),/Dateizuordnung/);
 const bytes=Buffer.from('%PDF-1.4');const files=[{name:'source.pdf',type:'application/pdf',bytes}];const batchOptions={owner:'owner-a',clientId:'client',requestId:'request-pages',provider:'openai',model:'model',metadata:{},files,pageCounts:[4]};
 assert.throws(()=>createImportBatch({...batchOptions,groups:[{items:[{fileIndex:0,pages:[1,2]}]},{items:[{fileIndex:0,pages:[2,3,4]}]}]}),/nur einem Auftrag|nur einmal/);
 assert.throws(()=>createImportBatch({...batchOptions,groups:[{items:[{fileIndex:0,pages:[1,2]}]},{items:[{fileIndex:0,pages:[3]}]}]}),/jede ausgewählte Datei/);
 assert.throws(()=>createImportBatch({...batchOptions,groups:[{items:[{fileIndex:0,pages:[1,2,3]}]},{items:[{fileIndex:0,pages:[4,5]}]}]}),/PDF-Seitenbereich/);
});

test('batch waves honor the queue limit, pause, and session ownership',()=>{
 const batch=create([{name:'one',fileIndexes:[0]},{name:'two',fileIndexes:[1]},{name:'three',fileIndexes:[2]}]);
 assert.equal(availableBatchSlots(Array.from({length:7},()=>({status:'queued'}))),1);
 assert.equal(availableBatchSlots(Array.from({length:8},()=>({status:'running'}))),0);
 assert.equal(nextBatchGroup(batch).name,'one');batch.stopped=true;assert.equal(nextBatchGroup(batch),null);
 assert.throws(()=>batchForOwner([batch],batch.id,'owner-b'),/nicht gefunden/);
});


test('local filename hints keep ambiguous files separate and never select a dossier or person',()=>{
 const files=['case-a-back.pdf','case-a-front.pdf','independent.pdf','ambiguous.pdf','ambiguous.png'].map(name=>({name})),groups=suggestImportGroups(files,{pageCounts:[1,2,3,1,1]});assert.equal(groups.length,4);assert.deepEqual(groups[0].items.map(item=>item.fileIndex),[1,0]);assert.ok(groups[0].reasons.includes('filename-role-match'));assert.ok(groups[0].reasons.includes('keep-multipage-file'));assert.ok(groups.slice(-2).every(group=>group.reasons.includes('ambiguous-name-match')));assert.ok(groups.every(group=>group.uncertain));assert.ok(!JSON.stringify(groups).includes('dossier'));
 const sequence=suggestImportGroups([{name:'register-page-2.pdf'},{name:'register-page-1.pdf'}]);assert.deepEqual(sequence[0].items.map(item=>item.fileIndex),[1,0]);assert.ok(sequence[0].reasons.includes('filename-page-sequence'));
});

test('group options remain bounded and are part of the idempotent request identity',()=>{
 const options={owner:'owner-a',clientId:'client',requestId:'request-options',provider:'openai',model:'model',metadata:{targetLanguage:'Deutsch'},files:sourceFiles(),pageCounts:[1,1,1]},groups=[{fileIndexes:[0],options:{targetLanguage:'Englisch',useLearning:false,dossierId:'',dossierEntityId:''}},{fileIndexes:[1,2]}],batch=createImportBatch({...options,groups});assert.equal(batchSnapshot(batch).groups[0].targetLanguage,'Englisch');assert.equal(batchSnapshot(batch).groups[0].useLearning,false);assert.notEqual(batch.requestHash,createImportBatch({...options,groups:[{...groups[0],options:{...groups[0].options,targetLanguage:'Arabisch'}},groups[1]]}).requestHash);assert.throws(()=>createImportBatch({...options,groups:[{...groups[0],options:{targetLanguage:'unavailable'}},groups[1]]}),/Zielsprache/);assert.throws(()=>createImportBatch({...options,groups:[{...groups[0],options:{owner:'not-allowed'}},groups[1]]}),/Gruppenoptionen/);
});
