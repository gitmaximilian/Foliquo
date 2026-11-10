import {StringDecoder} from 'node:string_decoder';
const segmenter=new Intl.Segmenter('und',{granularity:'grapheme'});
export const SEARCH_CHUNK_CHARS=64*1024;
export const SEARCH_CHUNK_OVERLAP=512;
// The consumer can stop after a bounded step. Resumption reads authenticated
// source bytes again, but never retains an entire historical translation.
export async function streamSearchChunks(withText,value,path,onChunk,{signal,startOffset=0,maxChars=4*1024*1024}={}){
 if(!Number.isSafeInteger(startOffset)||startOffset<0||!Number.isSafeInteger(maxChars)||maxChars<SEARCH_CHUNK_CHARS)throw new Error('Invalid search chunk limits.');
 const stop=Symbol('search-step'),decoder=new StringDecoder('utf8');let buffer='',offset=0,emitted=0,nextOffset=startOffset,limited=false,available=false;
 const emit=async(final=false)=>{
  while(buffer.length>=SEARCH_CHUNK_CHARS||final&&buffer.length){
   signal?.throwIfAborted();let end=buffer.length,advance=end;
   if(!final||buffer.length>SEARCH_CHUNK_CHARS){
    end=0;advance=0;const boundaries=[];
    for(const part of segmenter.segment(buffer)){
     if(part.index>SEARCH_CHUNK_CHARS)break;
     if(part.index){end=part.index;boundaries.push(part.index);}
     if(part.index<=SEARCH_CHUNK_CHARS-SEARCH_CHUNK_OVERLAP)advance=part.index;
    }
    if(boundaries.length>320)advance=Math.min(advance,boundaries[boundaries.length-321]);else advance=0;
    // Pathological unbounded combining sequences cannot be split with faithful
    // grapheme offsets. Disclose this limit instead of silently altering text.
    if(!end||!advance){limited=true;throw stop;}
   }
   if(offset>=startOffset){
    if(emitted+end>maxChars)throw stop;
    await onChunk({text:buffer.slice(0,end),offset,terminal:final&&end===buffer.length});emitted+=end;nextOffset=offset+advance;
   }
   buffer=buffer.slice(advance);offset+=advance;
   if(final&&end===advance)break;
  }
 };
 try{
  const append=async decoded=>{if(offset<startOffset){const skip=Math.min(decoded.length,startOffset-offset);offset+=skip;decoded=decoded.slice(skip);}buffer+=decoded;await emit();};
  const read=await withText(value,path,async source=>{available=true;for await(const bytes of source){signal?.throwIfAborted();await append(decoder.write(bytes));}await append(decoder.end());await emit(true);return true;});
  return {available:available&&read!==null,done:true,limited,emitted,nextOffset};
 }catch(error){if(error!==stop)throw error;return {available,done:false,limited,emitted,nextOffset};}
}

export function inventoryLocation(item){
 if(!Number.isInteger(item.fileIndex)||item.fileIndex<0||item.fileIndex>9||!Number.isInteger(item.page)||item.page<1||item.page>10000)return null;
 let box=Array.isArray(item.box)&&item.box.length===4&&item.box.every(value=>Number.isFinite(value)&&value>=0&&value<=1)?[...item.box]:null;
 if(box&&(box[2]<=0||box[3]<=0||box[0]+box[2]>1||box[1]+box[3]>1))box=null;
 if(box&&item.extractionMethod==='embedded-text'&&item.coordinateSpace!=='top-left')box=[box[0],Math.max(0,1-box[1]-box[3]),box[2],box[3]];
 return {fileIndex:item.fileIndex,page:item.page,box};
}
export function searchTextUnits(material){
 const units=[],current=material.review?.version||1,versions=[{value:material.result,path:['result'],version:current,historical:false},...(material.review?.versions||[]).filter(item=>item&&item.version!==current).map((value)=>({value,path:['review','versions',String(material.review.versions.indexOf(value))],version:value.version,historical:true}))];
 let sourceAvailable=false,sourceLimited=false;
 for(const {value,path,version,historical}of versions){
  if(!value||!Number.isInteger(version)||version<1)continue;
  if(value.text!==undefined)units.push({kind:'translation',version,historical,path:[...path,'text'],value:value.text,location:null,document:value.document,inventory:value.sourceInventory});
  const inventory=value.sourceInventory,items=inventory?.items||[];sourceLimited||=inventory?.truncated===true||inventory?.ocrIncomplete===true;
  for(let index=0;index<items.length;index++){
   const item=items[index];if(!item||item.sourceText===undefined)continue;sourceAvailable=true;
   units.push({kind:'source',version,historical,path:[...path,'sourceInventory','items',String(index),'sourceText'],value:item.sourceText,sourceId:item.id||null,location:inventoryLocation(item)});
  }
  // Old archives may retain recognized field text but no complete inventory.
  // Their coordinates refer to working pages; keep them unknown until the
  // existing original-geometry mapper has sufficient saved file information.
  if(!items.length)for(const collection of ['fields','regions'])for(let index=0;index<(value[collection]?.length||0);index++){
   const item=value[collection][index];if(item?.source===undefined)continue;sourceAvailable=true;sourceLimited=true;
   units.push({kind:'source',version,historical,path:[...path,collection,String(index),'source'],value:item.source,sourceId:item.id||null,location:null});
  }
 }
 return {units,sourceAvailable,sourceLimited:sourceLimited||!sourceAvailable};
}
