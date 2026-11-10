import {constants} from 'node:fs';
import {createReadStream,createWriteStream} from 'node:fs';
import {open} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {join} from 'node:path';
const JSON_TEXT_SIDECAR_THRESHOLD=1024*1024;

export async function* decodeJsonString(source){
 let pending=Buffer.alloc(0);
 for await(const chunk of source){
  const input=pending.length?Buffer.concat([pending,chunk]):chunk;pending=Buffer.alloc(0);let index=0;const output=[];
  while(index<input.length){
   if(input[index]!==92){let slash=input.indexOf(92,index);const end=slash<0?input.length:slash;for(let cursor=index;cursor<end;cursor++)if(input[cursor]<32)throw new Error('Invalid control byte in JSON string.');if(end>index)output.push(input.subarray(index,end));index=end;if(slash<0)break;}
   if(index+1>=input.length){pending=input.subarray(index);break;}
   const escape=input[index+1],short={34:'"',92:'\\',47:'/',98:'\b',102:'\f',110:'\n',114:'\r',116:'\t'}[escape];
   if(short!==undefined){output.push(Buffer.from(short));index+=2;continue;}
   if(escape!==117)throw new Error('Invalid JSON string escape.');
   if(index+6>input.length){pending=input.subarray(index);break;}
   const hex=input.toString('ascii',index+2,index+6);if(!/^[0-9a-fA-F]{4}$/.test(hex))throw new Error('Invalid JSON Unicode escape.');let code=parseInt(hex,16),advance=6;
   if(code>=0xd800&&code<=0xdbff){
    if(index+12>input.length){pending=input.subarray(index);break;}
    const pair=input.subarray(index+6,index+12);if(pair[0]===92&&pair[1]===117){const lowHex=pair.toString('ascii',2,6);if(!/^[0-9a-fA-F]{4}$/.test(lowHex))throw new Error('Invalid JSON Unicode escape.');const low=parseInt(lowHex,16);if(low>=0xdc00&&low<=0xdfff){code=0x10000+((code-0xd800)<<10)+(low-0xdc00);advance=12;}else code=0xfffd;}else code=0xfffd;
   }else if(code>=0xdc00&&code<=0xdfff)code=0xfffd;
   output.push(Buffer.from(String.fromCodePoint(code)));index+=advance;
  }
  if(output.length)yield Buffer.concat(output);
 }
 if(pending.length){
  if(pending[0]!==92||pending.length<2)throw new Error('Unterminated JSON escape.');
  if(pending[1]!==117||pending.length<6)throw new Error('Unterminated JSON Unicode escape.');
  const hex=pending.toString('ascii',2,6);if(!/^[0-9a-fA-F]{4}$/.test(hex))throw new Error('Invalid JSON Unicode escape.');const code=parseInt(hex,16);if(code>=0xd800&&code<=0xdbff){if(pending.length>=12&&pending[6]===92&&pending[7]===117){const low=parseInt(pending.toString('ascii',8,12),16);if(low>=0xdc00&&low<=0xdfff){yield Buffer.from(String.fromCodePoint(0x10000+((code-0xd800)<<10)+(low-0xdc00)));return;}}yield Buffer.from('\ufffd');return;}if(code>=0xdc00&&code<=0xdfff){yield Buffer.from('\ufffd');return;}if(pending.length===6){yield Buffer.from(String.fromCodePoint(code));return;}
  throw new Error('Trailing bytes after JSON Unicode escape.');
 }
}
export class JsonFileReader{
 constructor(){this.handle=null;this.offset=0;this.buffer=Buffer.allocUnsafe(64*1024);this.bufferStart=0;this.bufferLength=0;}
 async init(path){this.path=path;this.handle=await open(path,constants.O_RDONLY);return this;}
 async peek(){this.signal?.throwIfAborted();if(!this.handle)throw new Error('JSON reader is closed.');if(this.offset<this.bufferStart||this.offset>=this.bufferStart+this.bufferLength){this.bufferStart=this.offset;this.bufferLength=(await this.handle.read(this.buffer,0,this.buffer.length,this.offset)).bytesRead;}return this.offset<this.bufferStart+this.bufferLength?this.buffer[this.offset-this.bufferStart]:null;}
 async next(){const value=await this.peek();if(value!==null)this.offset++;return value;}
 async skipWhitespace(){for(;;){const value=await this.peek();if(value!==32&&value!==9&&value!==10&&value!==13)return;this.offset++;}}
 async expect(expected){await this.skipWhitespace();if(await this.next()!==expected)throw new Error('Invalid JSON token.');}
 async scanString(){
  if(await this.next()!==34)throw new Error('Invalid JSON string.');let escaped=false;
  for(;;){if(await this.peek()===null)throw new Error('Unterminated JSON string.');let index=this.offset-this.bufferStart;for(;index<this.bufferLength;index++){const value=this.buffer[index];if(escaped){escaped=false;continue;}if(value===92){escaped=true;continue;}if(value===34){this.offset=this.bufferStart+index+1;return;}}this.offset=this.bufferStart+this.bufferLength;}
 }
 async rawValueRange(){
  await this.skipWhitespace();const start=this.offset,first=await this.peek();if(first===null)throw new Error('Missing JSON value.');
  if(first===34)await this.scanString();
  else if(first===123||first===91){const stack=[first===123?125:93];this.offset++;while(stack.length){if(await this.peek()===null)throw new Error('Unterminated JSON container.');let index=this.offset-this.bufferStart,jumped=false;for(;index<this.bufferLength;index++){const value=this.buffer[index];if(value===34){this.offset=this.bufferStart+index;await this.scanString();jumped=true;break;}if(value===123)stack.push(125);else if(value===91)stack.push(93);else if(value===125||value===93){if(stack.pop()!==value)throw new Error('Mismatched JSON container.');if(!stack.length){this.offset=this.bufferStart+index+1;break;}}}if(!jumped&&index===this.bufferLength)this.offset=this.bufferStart+this.bufferLength;}}

  else{while(true){const value=await this.peek();if(value===null||value===32||value===9||value===10||value===13||value===44||value===93||value===125)break;if(this.offset===start&&value===58)throw new Error('Invalid JSON value.');this.offset++;}if(this.offset===start)throw new Error('Empty JSON value.');}
  return {start,end:this.offset};
 }
 async rawValue(){const {start,end}=await this.rawValueRange(),bytes=Buffer.allocUnsafe(end-start);let read=0;while(read<bytes.length){const result=await this.handle.read(bytes,read,bytes.length-read,start+read);if(!result.bytesRead)throw new Error('Unexpected end of JSON file.');read+=result.bytesRead;}return bytes;}
 async rawValueToFile(path){const {start,end}=await this.rawValueRange();await pipeline(createReadStream(this.path,{start,end:end-1}),createWriteStream(path,{flags:'wx',mode:0o600}));return end-start;}
 async parsedValue(){return JSON.parse((await this.rawValue()).toString('utf8'));}
 async parseJobValue(path=[],textPath){
  await this.skipWhitespace();const first=await this.peek();
  if(first===123){await this.expect(123);const result={};const keys=new Set();await this.skipWhitespace();if(await this.peek()===125){this.offset++;return result;}for(;;){const key=await this.parsedValue();if(typeof key!=='string'||keys.has(key))throw new Error('Invalid or duplicate job property.');keys.add(key);await this.expect(58);const childPath=[...path,key];let value;if(path.length===1&&path[0]==='result'&&key==='text'&&await this.peek()===34){const {start,end}=await this.rawValueRange();if(end-start>JSON_TEXT_SIDECAR_THRESHOLD){await pipeline(createReadStream(this.path,{start:start+1,end:end-2}),decodeJsonString,createWriteStream(textPath,{flags:'wx',mode:0o600}));this.streamedTextPath=textPath;this.streamedTextRange={start,end};value='';}else{const bytes=Buffer.allocUnsafe(end-start);let read=0;while(read<bytes.length){const part=await this.handle.read(bytes,read,bytes.length-read,start+read);if(!part.bytesRead)throw new Error('Unexpected end of JSON file.');read+=part.bytesRead;}value=JSON.parse(bytes.toString('utf8'));}}else value=await this.parseJobValue(childPath,textPath);result[key]=value;await this.skipWhitespace();const separator=await this.next();if(separator===125)break;if(separator!==44)throw new Error('Invalid job object separator.');}return result;}
  if(first===91){await this.expect(91);const result=[];await this.skipWhitespace();if(await this.peek()===93){this.offset++;return result;}for(;;){result.push(await this.parseJobValue([...path,String(result.length)],textPath));await this.skipWhitespace();const separator=await this.next();if(separator===93)break;if(separator!==44)throw new Error('Invalid job array separator.');}return result;}
  const bytes=await this.rawValue();if(path.length===2&&path[0]==='result'&&path[1]==='text')return JSON.parse(bytes.toString('utf8'));return JSON.parse(bytes.toString('utf8'));
 }
 async readJob(textPath){this.streamedTextPath=null;this.streamedTextRange=null;const job=await this.parseJobValue([],textPath);await this.assertEnd();return job;}
 async readObject({onJobs,jobDirectory}={}){
  await this.expect(123);const metadata={},keys=new Set();
  await this.skipWhitespace();if(await this.peek()===125){this.offset++;await this.assertEnd();return metadata;}
  for(;;){const key=await this.parsedValue();if(typeof key!=='string'||keys.has(key))throw new Error('Invalid or duplicate workspace property.');keys.add(key);await this.expect(58);
   if(key==='jobs'){
    if(typeof onJobs!=='function'||typeof jobDirectory!=='string')throw new Error('Streaming job restore requires a private staging directory.');
    await this.expect(91);let count=0;await this.skipWhitespace();if(await this.peek()!==93)for(;;){if(++count>10000)throw Object.assign(new Error('Backup contains too many jobs.'),{code:'ERR_BACKUP_CONTENT'});const rawPath=join(jobDirectory,`raw-${String(count-1).padStart(5,'0')}.json`),textPath=join(jobDirectory,`text-${String(count-1).padStart(5,'0')}.utf8`);await this.rawValueToFile(rawPath);let job,jobReader;try{jobReader=await new JsonFileReader().init(rawPath);job=await jobReader.readJob(textPath);}catch{throw new Error('Malformed job JSON.');}finally{await jobReader?.close();}if(!job||typeof job!=='object'||Array.isArray(job))throw Object.assign(new Error('Invalid backup job.'),{code:'ERR_BACKUP_CONTENT'});await onJobs(job,rawPath,count-1,jobReader.streamedTextPath?textPath:null,jobReader.streamedTextRange||null);await this.skipWhitespace();const separator=await this.next();if(separator===93)break;if(separator!==44)throw new Error('Invalid jobs array separator.');}
    else this.offset++;
   }else metadata[key]=await this.parsedValue();
   await this.skipWhitespace();const separator=await this.next();if(separator===125)break;if(separator!==44)throw new Error('Invalid workspace object separator.');
  }
  await this.assertEnd();return metadata;
 }
 async projectedValue(project,path=[],state={nodes:0,signal:null}){
  state.signal?.throwIfAborted();if(++state.nodes>200000)throw new Error('Search metadata exceeds the local projection limit.');await this.skipWhitespace();const first=await this.peek(),mode=project(path,first);
  if(mode==='skip'){await this.rawValueRange();return undefined;}
  if(mode==='text'&&first===34){const range=await this.rawValueRange();return {__searchJsonText:range};}
  if(mode==='value'){const range=await this.rawValueRange();if(range.end-range.start>4*1024*1024)return {__searchLimited:true};const bytes=Buffer.allocUnsafe(range.end-range.start);let read=0;while(read<bytes.length){const part=await this.handle.read(bytes,read,bytes.length-read,range.start+read);if(!part.bytesRead)throw new Error('Unexpected JSON end.');read+=part.bytesRead;}return JSON.parse(bytes.toString('utf8'));}
  if(first===123){this.offset++;const result={},keys=new Set();await this.skipWhitespace();if(await this.peek()===125){this.offset++;return result;}for(;;){const key=await this.parsedValue();if(typeof key!=='string'||keys.has(key))throw new Error('Invalid or duplicate JSON property.');keys.add(key);await this.expect(58);const value=await this.projectedValue(project,[...path,key],state);if(value!==undefined)Object.defineProperty(result,key,{value,enumerable:true,writable:true,configurable:true});await this.skipWhitespace();const separator=await this.next();if(separator===125)break;if(separator!==44)throw new Error('Invalid JSON object separator.');}return result;}
  if(first===91){this.offset++;const result=[];await this.skipWhitespace();if(await this.peek()===93){this.offset++;return result;}for(;;){result.push(await this.projectedValue(project,[...path,String(result.length)],state));await this.skipWhitespace();const separator=await this.next();if(separator===93)break;if(separator!==44)throw new Error('Invalid JSON array separator.');}return result;}
  return this.parsedValue();
 }
 async readProjection(project,{signal}={}){this.signal=signal;const result=await this.projectedValue(project,[],{nodes:0,signal});await this.assertEnd();return result;}
 async *textRange(range){if(!range||!Number.isSafeInteger(range.start)||!Number.isSafeInteger(range.end)||range.end-range.start<2)throw new Error('Invalid JSON text range.');if(range.end-range.start===2)return;yield* decodeJsonString(createReadStream(this.path,{start:range.start+1,end:range.end-2,highWaterMark:64*1024}));}
 async assertEnd(){await this.skipWhitespace();if(await this.peek()!==null)throw new Error('Trailing JSON data.');}
 async close(){await this.handle?.close();this.handle=null;}
}
