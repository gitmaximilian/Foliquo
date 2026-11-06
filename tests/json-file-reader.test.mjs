import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {StringDecoder} from 'node:string_decoder';
import {JsonFileReader} from '../lib/json-file-reader.mjs';

test('the shared JSON reader projects text ranges across buffer and escaped Unicode boundaries without materializing skipped exports',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-search-reader-'));t.after(()=>rm(directory,{recursive:true,force:true}));const path=join(directory,'fictional.json'),text='Fictional \\" line\n🙂 مُحَمَّد Cafe\u0301 '.repeat(5000),value={id:'fictional',payload:{huge:'x'.repeat(128000)},result:{text,pdf:'not-real-export'.repeat(10000),fields:[{source:'Fictional source'}]}};await writeFile(path,JSON.stringify(value));const reader=await new JsonFileReader().init(path);try{const projected=await reader.readProjection(path=>path[0]==='payload'||path.join('.')==='result.pdf'?'skip':path.join('.')==='result.text'?'text':undefined);assert.equal(projected.payload,undefined);assert.equal(projected.result.pdf,undefined);assert.ok(projected.result.text.__searchJsonText);const decoder=new StringDecoder('utf8');let decoded='';for await(const bytes of reader.textRange(projected.result.text.__searchJsonText))decoded+=decoder.write(bytes);decoded+=decoder.end();assert.equal(decoded,text);assert.equal(projected.result.fields[0].source,'Fictional source');}finally{await reader.close();}
});
