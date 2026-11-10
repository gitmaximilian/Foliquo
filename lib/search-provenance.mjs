import {createHash} from 'node:crypto';
import {documentTextProjection} from './document-adapter.mjs';
import {inventoryLocation} from './search-chunks.mjs';
/** Only saved explicit node bindings are used; textual similarity is not proof. */
export function translationProvenance(unit){
 if(unit.kind!=='translation'||!unit.document||!unit.inventory?.items?.length)return null;
 let projection;try{projection=documentTextProjection(unit.document);}catch{return null;}
 const nodes=new Map();for(const span of projection.spans){if(!nodes.has(span.nodeId))nodes.set(span.nodeId,[]);nodes.get(span.nodeId).push(span);}
 const mapped=new Map();let links=0;
 for(const item of unit.inventory.items){const location=inventoryLocation(item);if(!location)continue;for(const id of item.targetNodeIds||[])for(const span of nodes.get(id)||[]){
  if(++links>40000)return null;const key=`${span.start}:${span.end}`;if(!mapped.has(key))mapped.set(key,{start:span.start,end:span.end,locations:[]});const locations=mapped.get(key).locations;if(!locations.some(value=>JSON.stringify(value)===JSON.stringify(location)))locations.push(location);
 }}
 if(!mapped.size)return null;const spans=[...mapped.values()];if(Buffer.byteLength(JSON.stringify(spans))>2*1024*1024)return null;return {digest:createHash('sha256').update(projection.text).digest('hex'),spans};
}
export function searchHitLocation(manifest,chunk,match){
 if(chunk.kind==='source')return chunk.location||null;
 const start=chunk.offset+match.start,end=chunk.offset+match.end,candidates=(manifest.maps?.[chunk.unit]||[]).filter(span=>span.start<=start&&span.end>=end);if(!candidates.length)return null;
 const width=Math.min(...candidates.map(span=>span.end-span.start)),locations=candidates.filter(span=>span.end-span.start===width).flatMap(span=>span.locations);if(!locations.length)return null;const first=locations[0];if(locations.some(location=>location.fileIndex!==first.fileIndex||location.page!==first.page))return null;
 const sameBox=locations.every(location=>JSON.stringify(location.box)===JSON.stringify(first.box));return {fileIndex:first.fileIndex,page:first.page,box:sameBox?first.box:null};
}
