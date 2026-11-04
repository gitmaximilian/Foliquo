import test from 'node:test';
import assert from 'node:assert/strict';
import {repeatedCriticalValueChecks} from '../lib/document-consistency.mjs';

test('document-wide repeated names, dates and numbers flag divergent translations without rewriting them',()=>{
 const checks=repeatedCriticalValueChecks([
  {kind:'name',source:'Alex Example',translated:'Alex Beispiel',page:1},
  {kind:'name',source:'  alex   example ',translated:'Alex Muster',page:4},
  {kind:'number',source:'DEMO-42',translated:'DEMO-42',page:1},
  {kind:'number',source:'demo-42',translated:'demo-42',page:2},
  {kind:'date',source:'01/02/2020',translated:'01.02.2020',page:1},
  {kind:'date',source:'01/02/2020',translated:'02.01.2020',page:5},
  {kind:'other',source:'same',translated:'different',page:3}
 ]);
 assert.equal(checks.length,2);
 const name=checks.find(check=>check.source==='Alex Example');
 assert.equal(name.severity,'review');assert.deepEqual(name.pages,[1,4]);
 assert.deepEqual(name.values.map(value=>value.text),['Alex Beispiel','Alex Muster']);
 assert.match(name.issue,/Seiten: 1, 4/u);assert.match(name.issue,/ändert keine Werte automatisch/u);
 const date=checks.find(check=>check.kind==='consistency'&&check.label.endsWith('Datum'));
 assert.deepEqual(date.pages,[1,5]);
});

test('repeated critical values with one stable translation produce no extra review item',()=>{
 assert.deepEqual(repeatedCriticalValueChecks([
  {kind:'number',source:'ID 007',translated:'ID 007',page:1},
  {kind:'number',source:'id 007',translated:'id 007',page:2}
 ]),[]);
});
