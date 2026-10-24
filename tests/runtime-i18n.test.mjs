import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../dist/runtime-i18n.js',import.meta.url),'utf8');
const runtime={window:{}};
vm.runInNewContext(source,runtime);
const api=runtime.window.TOCRRuntimeI18n;

test('runtime message catalog translates every template to all supported UI languages',()=>{
  for(const [de,en,ar] of api.rows){
    for(const lang of ['de','en','ar']){
      const sourceMessage=de.replace(/\{(\d+)\}/g,(_,n)=>`VALUE${n}`);
      const output=api.translate(sourceMessage,lang);
      const target={de,en,ar}[lang];
      assert.equal(output,target.replace(/\{(\d+)\}/g,(_,n)=>`VALUE${n}`),`${de} -> ${lang}`);
    }
  }
});

test('runtime templates preserve multiline user supplied names and numeric values',()=>{
  const name='عبد\nالغني 42';
  assert.equal(api.translate(`Welche lateinische Schreibweise von „${name}“ steht im Pass oder soll nach Prüfung verwendet werden?`,'en'),`Which Latin spelling of “${name}” is in the passport or should be used after review?`);
  assert.equal(api.translate('Seite 2 von 18','ar'),'الصفحة 2 من 18');
});

test('document text and unmatched messages remain unchanged',()=>{
  const sentence='The original says: Adam Mihal';
  assert.equal(api.translate(sentence,'ar'),sentence);
  assert.equal(api.translate('Unknown diagnostic','de'),'Unknown diagnostic');
});
