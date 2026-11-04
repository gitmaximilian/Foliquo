import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('desktop finalizer reports host verification status and checksums only built artifacts',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-desktop-report-'));
 const macosAppRoot=await mkdtemp(join(tmpdir(),'foliquo-desktop-empty-apps-'));
 try{
  await writeFile(join(directory,'Fictional.flatpak'),'fictional-package');
  await writeFile(join(directory,'Fictional.dmg'),'fictional-disk-image');
  const result=spawnSync(process.execPath,[resolve('scripts/finalize-desktop.mjs')],{encoding:'utf8',env:{...process.env,FOLIQUO_DESKTOP_FINAL_DIR:directory,FOLIQUO_DESKTOP_MACOS_APP_ROOT:macosAppRoot,DESKTOP_PLATFORM:'linux-x64',GITHUB_SHA:'fictional-commit'}});
  assert.equal(result.status,0,result.stderr||result.stdout);
  const report=JSON.parse(await readFile(join(directory,'BUILD-REPORT.json'),'utf8'));
  assert.equal(report.commit,'fictional-commit');
  assert.equal(report.platform,'linux-x64');
  const verifierPlatform=process.platform==='darwin'?'macOS':process.platform==='win32'?'Windows':process.platform==='linux'?'Linux':process.platform;
  assert.equal(report.signatureVerificationPlatform,verifierPlatform);
  assert.equal(report.osSignature.status,process.platform==='linux'?'not-applicable':'unverified');
  assert.equal(report.tauriUpdaterSignature,'absent');
  assert.equal(report.artifactSizes['Fictional.dmg'].bytes,20);
  assert.equal(report.artifactSizes['Fictional.dmg'].mib,0);
  assert.deepEqual(Object.keys(report.checksums),['Fictional.dmg','Fictional.flatpak']);
  const text=await readFile(join(directory,'BUILD-REPORT.txt'),'utf8');
  assert.match(text,new RegExp(`OS code signature: ${report.osSignature.status}`));
  assert.match(text,new RegExp(`Signature verification platform: ${verifierPlatform}`));
  assert.match(text,/Fictional\.dmg 20 bytes \(0 MiB\)/);
  assert.match(await readFile(join(directory,'SHA256SUMS'),'utf8'),/Fictional\.flatpak/);
 }finally{await Promise.all([rm(directory,{recursive:true,force:true}),rm(macosAppRoot,{recursive:true,force:true})]);}
});
