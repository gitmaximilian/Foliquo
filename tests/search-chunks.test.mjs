import test from 'node:test';
import assert from 'node:assert/strict';
import {streamSearchChunks,searchTextUnits,SEARCH_CHUNK_CHARS} from '../lib/search-chunks.mjs';
import {findSearchMatch,parseSearchQuery} from '../lib/search-text.mjs';
function source(text){return async(value,path,read)=>read((async function*(){const bytes=Buffer.from(text);for(let offset=0;offset<bytes.length;offset+=65531)yield bytes.subarray(offset,offset+65531);})());}
test('bounded search chunks preserve cross-boundary Arabic, combining marks and emoji and resume without losing text',async()=>{
 const prefix='x'.repeat(SEARCH_CHUNK_CHARS-5),needle='مُحَمَّد Café🙂',text=prefix+needle+'y'.repeat(SEARCH_CHUNK_CHARS*3),chunks=[];
 const first=await streamSearchChunks(source(text),null,[],chunk=>chunks.push(chunk),{maxChars:SEARCH_CHUNK_CHARS});assert.equal(first.done,false);assert.equal(first.limited,false);assert.equal(chunks.length,1);
 const later=[];const next=await streamSearchChunks(source(text),null,[],chunk=>later.push(chunk),{startOffset:first.nextOffset,maxChars:SEARCH_CHUNK_CHARS*5});assert.equal(next.done,true);
 const all=[...chunks,...later];let rebuilt='';for(let index=0;index<all.length;index++){const chunk=all[index],end=all[index+1]?.offset??text.length;assert.equal(chunk.text,text.slice(chunk.offset,chunk.offset+chunk.text.length));rebuilt+=chunk.text.slice(0,end-chunk.offset);}assert.equal(rebuilt,text);
 const hit=all.map(chunk=>({chunk,match:findSearchMatch(chunk.text,parseSearchQuery(needle))})).find(item=>item.match);assert.ok(hit);assert.equal(hit.chunk.offset+hit.match.start,prefix.length);
});
test('saved text units distinguish historical versions and expose only documented original coordinates',()=>{
 const result=searchTextUnits({result:{text:'Current',sourceInventory:{ocrIncomplete:true,items:[{id:'source',sourceText:'Original',fileIndex:0,page:2,box:[.1,.8,.4,.05],extractionMethod:'embedded-text'}]}},review:{version:2,versions:[{version:2,text:'Duplicate current'},{version:1,text:'Historical',fields:[{source:'Historical field',page:99}]}]}});
 assert.equal(result.units.length,4);assert.equal(result.sourceLimited,true);assert.equal(result.units[0].historical,false);assert.equal(result.units[2].version,1);assert.equal(result.units[2].historical,true);assert.equal(result.units[2].path.join('.'),'review.versions.1.text');assert.equal(result.units[3].location,null);assert.equal(result.units[1].location.page,2);assert.ok(Math.abs(result.units[1].location.box[1]-.15)<1e-10);
 assert.equal(searchTextUnits({result:{text:'Image only'}}).sourceLimited,true);
});
