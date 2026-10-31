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

test('approved target variants satisfy glossary checks while unapproved Arabic morphology remains uncertain',()=>{
 const [german]=glossaryAuditChecks('Amt der Fiktion', [{id:'variants',source:'Fictional Authority',target:'Fiktive Behörde',allowedVariants:['Behörde fiktiv','Amt der Fiktion']}], ['Fictional Authority']);
 assert.equal(german.present,true);assert.equal(german.matchedVariant,'Amt der Fiktion');assert.equal(german.consistent,true);
 const [arabicVariant]=glossaryAuditChecks('وزارة الشؤون الداخلية', [{id:'ar-variants',source:'وزارة الداخلية',target:'الوزارة الداخلية',allowedVariants:['وزارة الشؤون الداخلية']}], ['وزارة الداخلية']);
 assert.equal(arabicVariant.present,true);assert.equal(arabicVariant.consistent,true);
 const [arabicMiss]=glossaryAuditChecks('بإدارة الوزارة', [{id:'ar-miss',source:'وزارة الداخلية',target:'الوزارة الداخلية',allowedVariants:['وزارة الشؤون الداخلية']}], ['وزارة الداخلية']);
 assert.equal(arabicMiss.present,false);assert.equal(arabicMiss.consistent,null);assert.equal(arabicMiss.severity,'review');
});
