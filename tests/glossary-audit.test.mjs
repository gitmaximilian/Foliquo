import test from 'node:test';
import assert from 'node:assert/strict';
import {glossaryAuditChecks} from '../lib/glossary-audit.mjs';

test('glossary audit checks only source terms present in source evidence and never rewrites output',()=>{
 const terms=[{id:'term-1',source:'Fictional Authority',target:'Fiktive Behörde',matchMode:'phrase',version:2},{id:'term-2',source:'Licence number',target:'Lizenznummer',matchMode:'word'}];
 const checks=glossaryAuditChecks('Die Fiktive Behörde hat die Bestätigung ausgestellt.',terms,['Fictional Authority','Licence number DEMO-123']);
 assert.equal(checks.length,2);assert.deepEqual(checks.map(check=>check.present),[true,false]);assert.equal(checks[0].severity,'info');assert.equal(checks[1].severity,'warning');assert.equal(checks[0].termVersion,2);assert.equal(glossaryAuditChecks('unchanged output',terms,['no matching source']).length,0);
});

test('glossary whole-word matching avoids substrings and Arabic word-form checks stay explicitly uncertain',()=>{
 const terms=[{id:'word',source:'court',target:'Gericht',matchMode:'word'},{id:'arabic',source:'وزارة الداخلية',target:'الوزارة الداخلية',matchMode:'phrase'}];
 const checks=glossaryAuditChecks('Courthouse and وزارة الداخلية',terms,['courthouse; وزارة الداخلية']);
 assert.equal(checks.length,1);assert.equal(checks[0].id,'glossary-arabic');assert.equal(checks[0].severity,'review');assert.equal(checks[0].consistent,null);assert.match(checks[0].issue,/nicht automatisch bewertet/u);
});
