import test from 'node:test';
import assert from 'node:assert/strict';
import {locationsOnOriginal} from '../lib/source-geometry.mjs';

test('source locations invert corrected PDF page order, rotation and per-page crop',()=>{
 const [mapped]=locationsOnOriginal([{id:'fictional-field',fileIndex:0,page:1,box:[.2,.3,.2,.1]}],[{fileIndex:0,pageOrder:[2,1],rotation:90,crops:{1:[.1,.2,.5,.4]}}],['application/pdf']);
 assert.equal(mapped.page,2);assert.deepEqual(mapped.box,[.4,.28,.05,.08]);
});

test('unknown boxes stay unknown while page order is restored; image crop and rotation are inverted',()=>{
 const [unknown,image]=locationsOnOriginal([
  {fileIndex:0,page:2,box:null},
  {fileIndex:1,page:1,box:[.2,.1,.3,.2]}
 ],[
  {fileIndex:0,pageOrder:[2,1],rotation:0},
  {fileIndex:1,rotation:180,crop:[.1,.2,.5,.4]}
 ],['application/pdf','image/png']);
 assert.equal(unknown.page,1);assert.equal(unknown.box,null);
 assert.equal(image.page,1);assert.deepEqual(image.box,[.35,.48,.15,.08]);
});
