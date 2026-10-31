const STRING_CHUNK_UNITS=8192;

function* jsonString(value){
 yield '"';
 for(let offset=0;offset<value.length;offset+=STRING_CHUNK_UNITS){
  const part=value.slice(offset,offset+STRING_CHUNK_UNITS),encoded=JSON.stringify(part);
  yield encoded.slice(1,-1);
 }
 yield '"';
}

function* encode(value,key='',ancestors=new Set()){
 if(value&&typeof value==='object'&&typeof value.toJSON==='function')value=value.toJSON(key);
 if(value===null){yield 'null';return;}
 if(typeof value==='string'){yield* jsonString(value);return;}
 if(typeof value==='number'){yield Number.isFinite(value)?String(value):'null';return;}
 if(typeof value==='boolean'){yield value?'true':'false';return;}
 if(typeof value==='bigint')throw new TypeError('Do not know how to serialize a BigInt');
 if(typeof value==='undefined'||typeof value==='function'||typeof value==='symbol'){yield undefined;return;}
 if(typeof value!=='object'){yield 'null';return;}
 if(ancestors.has(value))throw new TypeError('Converting circular structure to JSON');
 ancestors.add(value);
 try{
  if(Array.isArray(value)){
   yield '[';
   for(let index=0;index<value.length;index++){
    if(index)yield ',';
    const item=value[index];if(item===undefined||typeof item==='function'||typeof item==='symbol')yield 'null';else yield* encode(item,String(index),ancestors);
   }
   yield ']';return;
  }
  if(value instanceof Number||value instanceof String||value instanceof Boolean){yield* encode(value.valueOf(),key,ancestors);return;}
  const entries=[];
  for(const name of Object.keys(value)){
   const item=value[name];if(item===undefined||typeof item==='function'||typeof item==='symbol')continue;
   entries.push([name,item]);
  }
  yield '{';
  for(let index=0;index<entries.length;index++){
   if(index)yield ',';
   const [name,item]=entries[index];yield* jsonString(name);yield ':';yield* encode(item,name,ancestors);
  }
  yield '}';
 }finally{ancestors.delete(value);}
}

/** Stream a JSON representation without allocating a second string for large values. */
export function* jsonChunks(value){
 const root=encode(value);
 for(const chunk of root){if(chunk!==undefined)yield chunk;}
}

function* quotedStringChunks(value){yield '"';for(let offset=0;offset<value.length;offset+=STRING_CHUNK_UNITS){const encoded=JSON.stringify(value.slice(offset,offset+STRING_CHUNK_UNITS));yield encoded.slice(1,-1);}yield '"';}

async function* encodeWithStringStreams(value,sources,path=[],key='',ancestors=new Set(),consumed=new Set()){
 const sourceKey=JSON.stringify(path),source=sources.get(sourceKey);
 if(source){
  if(consumed.has(sourceKey))throw new TypeError('A streamed JSON string path occurred more than once.');consumed.add(sourceKey);
  yield '"';let carry='';const iterable=typeof source==='function'?await source():source;for await(const part of iterable){let text=carry+String(part);carry='';if(text.length&&/[\uD800-\uDBFF]/.test(text.at(-1))){carry=text.at(-1);text=text.slice(0,-1);}if(text)yield JSON.stringify(text).slice(1,-1);}if(carry)yield JSON.stringify(carry).slice(1,-1);yield '"';return;
 }
 if(value&&typeof value==='object'&&typeof value.toJSON==='function')value=value.toJSON(key);
 if(value===null){yield 'null';return;}if(typeof value==='string'){yield* quotedStringChunks(value);return;}if(typeof value==='number'){yield Number.isFinite(value)?String(value):'null';return;}if(typeof value==='boolean'){yield value?'true':'false';return;}if(typeof value==='bigint')throw new TypeError('Do not know how to serialize a BigInt');if(typeof value==='undefined'||typeof value==='function'||typeof value==='symbol'){yield undefined;return;}if(typeof value!=='object'){yield 'null';return;}
 if(ancestors.has(value))throw new TypeError('Converting circular structure to JSON');ancestors.add(value);
 try{
  if(Array.isArray(value)){yield '[';for(let index=0;index<value.length;index++){if(index)yield ',';const item=value[index];if(item===undefined||typeof item==='function'||typeof item==='symbol')yield 'null';else yield* encodeWithStringStreams(item,sources,[...path,String(index)],String(index),ancestors,consumed);}yield ']';return;}
  if(value instanceof Number||value instanceof String||value instanceof Boolean){yield* encodeWithStringStreams(value.valueOf(),sources,path,key,ancestors,consumed);return;}
  const entries=[];for(const name of Object.keys(value)){const item=value[name];if(item===undefined||typeof item==='function'||typeof item==='symbol')continue;entries.push([name,item]);}yield '{';for(let index=0;index<entries.length;index++){if(index)yield ',';const [name,item]=entries[index];yield* jsonString(name);yield ':';yield* encodeWithStringStreams(item,sources,[...path,name],name,ancestors,consumed);}yield '}';
 }finally{ancestors.delete(value);}
}

/** Stream JSON while sourcing one string value from a verified UTF-8 stream. */
export async function* jsonChunksWithStringStream(value,targetPath,source){
 if(!Array.isArray(targetPath)||targetPath.some(part=>typeof part!=='string'))throw new TypeError('A string property path is required.');
 yield* jsonChunksWithStringStreams(value,new Map([[JSON.stringify(targetPath),source]]));
}

/** Stream selected JSON strings from separate async sources while encoding the rest normally. */
export async function* jsonChunksWithStringStreams(value,sources){
 if(!(sources instanceof Map)||[...sources.keys()].some(path=>typeof path!=='string'))throw new TypeError('Streamed JSON sources must be keyed by encoded paths.');
 const consumed=new Set();for await(const chunk of encodeWithStringStreams(value,sources,[], '',new Set(),consumed))if(chunk!==undefined)yield chunk;
 if(consumed.size!==sources.size)throw new TypeError('A streamed JSON string path was not found in the response.');
}
