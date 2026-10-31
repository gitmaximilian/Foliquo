import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('DMG repacker replaces the source only when compressed image verifies unchanged and smaller',async()=>{
 const root=await mkdtemp(join(tmpdir(),'foliquo-repack-test-'));
 try{
  const bin=join(root,'bin'),image=join(root,'fixture.dmg'),tool=join(bin,'fake-hdiutil');
  await mkdir(bin);await writeFile(image,'original-image-bytes');
  await writeFile(tool,`#!/bin/sh\ncase "$1" in\n imageinfo) echo 'Checksum Value: $AB12CD34' ;;\n verify) exit 0 ;;\n convert) while [ "$1" != '-o' ]; do shift; done; shift; printf compressed > "$1" ;;\n *) exit 2 ;;\nesac\n`);
  const chmod=spawnSync('chmod',['+x',tool]);assert.equal(chmod.status,0);
  const run=spawnSync(process.execPath,[resolve('scripts/repack-dmg.mjs'),image],{encoding:'utf8',env:{...process.env,FOLIQUO_HDIUTIL:tool}});
  assert.equal(run.status,0,run.stderr||run.stdout);
  assert.equal(await readFile(image,'utf8'),'compressed');
  assert.match(run.stdout,/checksum AB12CD34 unchanged/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('DMG repacker preserves source when the converted image checksum differs',async()=>{
 const root=await mkdtemp(join(tmpdir(),'foliquo-repack-test-'));
 try{
  const bin=join(root,'bin'),image=join(root,'fixture.dmg'),tool=join(bin,'fake-hdiutil');
  await mkdir(bin);await writeFile(image,'original-image-bytes');
  await writeFile(tool,`#!/bin/sh\ncase "$1" in\n imageinfo) case "$2" in *foliquo-dmg-*/*) echo 'Checksum Value: $BAD0BAD0' ;; *) echo 'Checksum Value: $AB12CD34' ;; esac ;;\n verify) exit 0 ;;\n convert) while [ "$1" != '-o' ]; do shift; done; shift; printf compressed > "$1" ;;\n *) exit 2 ;;\nesac\n`);
  const chmod=spawnSync('chmod',['+x',tool]);assert.equal(chmod.status,0);
  const run=spawnSync(process.execPath,[resolve('scripts/repack-dmg.mjs'),image],{encoding:'utf8',env:{...process.env,FOLIQUO_HDIUTIL:tool}});
  assert.notEqual(run.status,0);
  assert.match(run.stderr,/checksum changed/);
  assert.equal(await readFile(image,'utf8'),'original-image-bytes');
 }finally{await rm(root,{recursive:true,force:true});}
});
