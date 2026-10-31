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
