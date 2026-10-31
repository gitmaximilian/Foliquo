import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGlossaryEntry,selectGlossary} from '../lib/glossary.mjs';

const term=(source,target,options={})=>normalizeGlossaryEntry({id:`term-${options.id||target}`,name:source,source,target,...options});

test('legacy terms remain approved for any source language and document type',()=>{
 const legacy=term('fictional source','legacy target',{targetLanguage:'Deutsch'});
 assert.equal(legacy.sourceLanguage,'any');assert.equal(legacy.documentType,'any');assert.equal(legacy.status,'approved');
 assert.deepEqual(selectGlossary([legacy],{sourceLanguage:'Arabic',targetLanguage:'Deutsch',documentType:'ID'}).terms.map(item=>item.target),['legacy target']);
});

test('glossary selection applies language, document and scope filters with explicit priority',()=>{
 const entries=[
  term('fictional source','global target',{id:'global'}),
  term('fictional source','profile target',{id:'profile',scope:'profile',scopeId:'profile-1',sourceLanguage:'English',documentType:'licence'}),
  term('fictional source','job target',{id:'job',scope:'job',scopeId:'job-1',sourceLanguage:'English',documentType:'licence'}),
  term('fictional source','wrong pair',{id:'wrong-pair',sourceLanguage:'Arabic'}),
  term('fictional source','wrong doc',{id:'wrong-doc',documentType:'passport'}),
 ];
 const selected=selectGlossary(entries,{sourceLanguage:'English',targetLanguage:'Deutsch',documentType:'licence',profileId:'profile-1'},'job-1');
 assert.deepEqual(selected.conflicts,[]);assert.equal(selected.terms.length,1);assert.equal(selected.terms[0].target,'job target');
 assert.deepEqual(selected.terms[0].conflictingIds,['global','profile']);
 const withoutJob=selectGlossary(entries,{sourceLanguage:'English',targetLanguage:'Deutsch',documentType:'licence',profileId:'profile-1'},'');
 assert.equal(withoutJob.terms[0].target,'profile target');
});

test('equal-priority divergent glossary targets are returned as conflicts, not picked arbitrarily',()=>{
 const selected=selectGlossary([
  term('fictional phrase','first target',{id:'first'}),
  term('fictional phrase','second target',{id:'second'}),
 ],{targetLanguage:'Deutsch'});
 assert.deepEqual(selected.terms,[]);assert.equal(selected.conflicts.length,1);assert.deepEqual(selected.conflicts[0].entries.map(item=>item.target),['first target','second target']);
});

test('proposed and disabled glossary entries never reach translation context',()=>{
 const entries=[term('fictional proposed','target',{status:'proposed'}),term('fictional disabled','target',{status:'disabled'})];
 assert.deepEqual(selectGlossary(entries,{targetLanguage:'Deutsch'}),{terms:[],conflicts:[]});
});

test('case-sensitive terms keep distinct source spelling while ordinary phrases normalize case',()=>{
 const selected=selectGlossary([
  term('ABC','upper target',{id:'upper',matchMode:'case-sensitive'}),
  term('abc','lower target',{id:'lower',matchMode:'case-sensitive'}),
 ],{targetLanguage:'Deutsch'});
 assert.equal(selected.terms.length,2);assert.deepEqual(selected.terms.map(item=>item.target),['upper target','lower target']);
});

test('glossary terms keep bounded, normalized and deduplicated allowed variants',()=>{
 const variants=Array.from({length:24},(_,index)=>`fictional variant ${index+1}`),entry=term('fictional source','primary target',{allowedVariants:[...variants,'FICTIONAL VARIANT 1','',42]});
 assert.equal(entry.allowedVariants.length,20);assert.equal(entry.allowedVariants[0],variants[0]);
 const selected=selectGlossary([entry],{targetLanguage:'Deutsch'});assert.deepEqual(selected.terms[0].allowedVariants,variants.slice(0,20));
});
