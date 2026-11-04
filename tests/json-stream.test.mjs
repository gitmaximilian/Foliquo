import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {jsonChunks,jsonChunksWithStringStream,jsonChunksWithStringStreams} from '../lib/json-stream.mjs';

test('streamed JSON preserves JSON.stringify values while bounding large string chunks',()=>{
 const text='a'.repeat(8191)+'🧪'+ '\u0000\n"\\'.repeat(40_000),value={text,empty:undefined,values:[undefined,NaN,Infinity,-0],bytes:Buffer.from([0,1,127,128,255])};
 const chunks=[...jsonChunks(value)],encoded=chunks.join('');
 assert.deepEqual(JSON.parse(encoded),JSON.parse(JSON.stringify(value)));
 assert.ok(chunks.length>5);
 assert.ok(Math.max(...chunks.map(chunk=>Buffer.byteLength(chunk)))<64*1024);
});

test('streamed JSON handles toJSON, omission rules and circular-data errors',()=>{
 const value={date:new Date('2026-10-31T00:00:00.000Z'),omit:()=>0,array:[Symbol('ignored')]};
 assert.deepEqual(JSON.parse([...jsonChunks(value)].join('')),JSON.parse(JSON.stringify(value)));
 const circular={};circular.self=circular;
 assert.throws(()=>[...jsonChunks(circular)],/circular/);
});


test('JSON encoder streams one external string with exact JSON escaping and Unicode',async()=>{
 const value={before:'fictional',text:{streamed:true},after:'end'},text=`${'x'.repeat(8191)}😀\n\t\\\"${'y'.repeat(8193)}`,chunks=[];
 for await(const chunk of jsonChunksWithStringStream(value,['text'],Readable.from([text.slice(0,8192),text.slice(8192)])))chunks.push(chunk);
 const encoded=chunks.join('');assert.equal(encoded,JSON.stringify({...value,text}));assert.deepEqual(JSON.parse(encoded),{...value,text});
});

test('JSON encoder streams multiple nested strings once with exact escaping',async()=>{
 const value={text:'',nested:{word:'',rows:[{source:''}]},after:'unchanged'},streams=new Map([
  [JSON.stringify(['text']),()=>Readable.from(['Large ', 'translation 🧪'])],
  [JSON.stringify(['nested','word']),()=>Readable.from(['base64', 'payload'])],
  [JSON.stringify(['nested','rows','0','source']),()=>Readable.from(['source\nline'])]
 ]),chunks=[];
 for await(const chunk of jsonChunksWithStringStreams(value,streams))chunks.push(chunk);
 const encoded=chunks.join(''),expected={text:'Large translation 🧪',nested:{word:'base64payload',rows:[{source:'source\nline'}]},after:'unchanged'};
 assert.equal(encoded,JSON.stringify(expected));assert.deepEqual(JSON.parse(encoded),expected);
 await assert.rejects(async()=>{for await(const _ of jsonChunksWithStringStreams({text:'not streamed'},new Map([[JSON.stringify(['missing']),Readable.from(['x'])]]))){}},/path was not found/);
});
