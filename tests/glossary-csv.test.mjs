import test from 'node:test';
import assert from 'node:assert/strict';
import {compareGlossaryImport,exportGlossaryCSV,parseGlossaryCSV} from '../lib/glossary-csv.mjs';

test('CSV supports BOM, semicolon delimiters, quoted multiline cells, and row-level errors',()=>{
 const parsed=parseGlossaryCSV('\uFEFFsource;target;note\r\n"fictional source";"target; phrase";"first line\nsecond line"\r\nmissing;;invalid\r\n');
 assert.equal(parsed.rows.length,1);assert.equal(parsed.rows[0].entry.target,'target; phrase');assert.equal(parsed.rows[0].entry.note,'first line\nsecond line');assert.deepEqual(parsed.errors,[{row:3,error:'source und target sind erforderlich.'}]);
});

test('CSV supports explicit source and target column mapping for unfamiliar headers',()=>{
 const csv='Original,Approved wording,Type\n"fictional source","fictional target",licence\n';
 assert.match(parseGlossaryCSV(csv).errors[0].error,/zuordnen/);
 const mapped=parseGlossaryCSV(csv,{mapping:{source:'Original',target:'Approved wording',documentType:'Type'}});
 assert.equal(mapped.errors.length,0);assert.equal(mapped.rows[0].entry.source,'fictional source');assert.equal(mapped.rows[0].entry.target,'fictional target');assert.equal(mapped.rows[0].entry.documentType,'licence');
});

test('CSV export protects formula cells and restores values on reimport',()=>{
 const entry={source:'=HYPERLINK("https://example.invalid")',target:'safe target',note:'@SUM(A1:A2)',targetLanguage:'Deutsch',scope:'global'};
 const exported=exportGlossaryCSV([entry]);assert.match(exported,/\u200B=/);assert.match(exported,/\u200B@/);
 const parsed=parseGlossaryCSV(exported);assert.equal(parsed.errors.length,0);assert.equal(parsed.rows[0].entry.source,entry.source);assert.equal(parsed.rows[0].entry.note,entry.note);
});

test('CSV round-trips multiple allowed variants as a quoted multiline field',()=>{
 const entry={source:'fictional title',target:'primary title',allowedVariants:['licensed title','title, permitted','عنوان معتمد'],scope:'global',targetLanguage:'Deutsch'};
 const exported=exportGlossaryCSV([entry]),parsed=parseGlossaryCSV(exported);
 assert.equal(parsed.errors.length,0);assert.deepEqual(parsed.rows[0].entry.allowedVariants,entry.allowedVariants);
 assert.ok(exported.includes('"licensed title\ntitle, permitted\nعنوان معتمد"'));
});

test('CSV import distinguishes exact duplicates from conflicting targets without overwriting',()=>{
 const parsed=parseGlossaryCSV('source,target\n"fictional source",existing target\n"new source",new target\n');
 const result=compareGlossaryImport(parsed,[{source:'fictional source',target:'existing target'}]);
 assert.equal(result.duplicates.length,1);assert.equal(result.conflicts.length,0);
 const conflict=compareGlossaryImport({rows:[{entry:{source:'fictional source',target:'different target',scope:'global',sourceLanguage:'any',targetLanguage:'Deutsch',documentType:'any',matchMode:'phrase'},row:2}]},[{source:'fictional source',target:'existing target'}]);
 assert.equal(conflict.conflicts.length,1);assert.deepEqual(conflict.conflicts[0].targets,['existing target','different target']);
});
