import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('DMG repacker replaces the source only when compressed image verifies unchanged and smaller',async()=>{
 const root=await mkdtemp(join(tmpdir(),'foliquo-repack-test-'));
 try{
  const image=join(root,'fixture.dmg'),tool=join(root,'fake-hdiutil.mjs');
  await writeFile(image,'original-image-bytes');
  await writeFile(tool,`import {writeFile} from 'node:fs/promises';\nconst args=process.argv.slice(2);if(args[0]==='imageinfo')console.log('Checksum Value: $AB12CD34');else if(args[0]==='verify')process.exit(0);else if(args[0]==='convert')await writeFile(args.at(-1),'compressed');else process.exit(2);\n`);
  const run=spawnSync(process.execPath,[resolve('scripts/repack-dmg.mjs'),image],{encoding:'utf8',env:{...process.env,FOLIQUO_HDIUTIL:process.execPath,FOLIQUO_HDIUTIL_SCRIPT:tool}});
  assert.equal(run.status,0,run.stderr||run.stdout);
  assert.equal(await readFile(image,'utf8'),'compressed');
  assert.match(run.stdout,/checksum AB12CD34 unchanged/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('DMG repacker preserves source when the converted image checksum differs',async()=>{
 const root=await mkdtemp(join(tmpdir(),'foliquo-repack-test-'));
 try{
  const image=join(root,'fixture.dmg'),tool=join(root,'fake-hdiutil.mjs');
  await writeFile(image,'original-image-bytes');
  await writeFile(tool,`import {writeFile} from 'node:fs/promises';\nconst args=process.argv.slice(2);if(args[0]==='imageinfo')console.log(args[1].includes('.foliquo-dmg-')?'Checksum Value: $BAD0BAD0':'Checksum Value: $AB12CD34');else if(args[0]==='verify')process.exit(0);else if(args[0]==='convert')await writeFile(args.at(-1),'compressed');else process.exit(2);\n`);
  const run=spawnSync(process.execPath,[resolve('scripts/repack-dmg.mjs'),image],{encoding:'utf8',env:{...process.env,FOLIQUO_HDIUTIL:process.execPath,FOLIQUO_HDIUTIL_SCRIPT:tool}});
  assert.notEqual(run.status,0);
  assert.match(run.stderr,/checksum changed/);
  assert.equal(await readFile(image,'utf8'),'original-image-bytes');
 }finally{await rm(root,{recursive:true,force:true});}
});
