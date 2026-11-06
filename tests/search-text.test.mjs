import test from 'node:test';
import assert from 'node:assert/strict';
import {foldSearchText,parseSearchQuery,findSearchMatch,searchSnippet} from '../lib/search-text.mjs';

test('search highlights the original German, English and vocalized Arabic spans after letter normalization',()=>{
 for(const [text,query,wanted]of [['Fictional Straße Müller','STRASSE','Straße'],['Fictional Cafe\u0301 example','CAFÉ','Cafe\u0301'],['ملف مُحَمَّد التجريبي','محمد','مُحَمَّد'],['🙂 Fictional İSTANBUL record','istanbul','İSTANBUL']]){const match=findSearchMatch(text,parseSearchQuery(query));assert.ok(match);assert.equal(text.slice(match.start,match.end),wanted);const snippet=searchSnippet(text,match,{context:4});assert.equal(snippet.text.slice(snippet.highlights[0].start,snippet.highlights[0].end),wanted);}
});
test('numeric glyphs and complete numeric sequences are not collapsed into different document numbers',()=>{
 assert.equal(findSearchMatch('Fictional １２３ and ١٢٣ and 1234',parseSearchQuery('123')),null);assert.equal(findSearchMatch('Fictional 1234 then 123',parseSearchQuery('123')).start,20);assert.ok(findSearchMatch('Fictional ١٢٣',parseSearchQuery('١٢٣')));assert.notEqual(foldSearchText('１２３'),foldSearchText('123'));assert.throws(()=>parseSearchQuery('x'));assert.throws(()=>parseSearchQuery('x'.repeat(161)));
});
