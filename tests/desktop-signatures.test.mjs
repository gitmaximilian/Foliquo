import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectDesktopSignatures} from '../lib/desktop-signatures.mjs';

test('macOS report keeps code signing, Gatekeeper acceptance, and stapled notarization distinct',()=>{
 const calls=[],run=(command,args)=>{calls.push([command,args]);if(command==='codesign'&&args[0]==='--verify')return {status:0};if(command==='codesign')return {status:0,stderr:'Authority=Developer ID Application: Fictional Publisher'};return {status:0,stdout:'accepted'};};
 const report=inspectDesktopSignatures({platform:'darwin',apps:['/tmp/Fictional.app'],diskImages:['/tmp/Fictional.dmg'],run});
 assert.equal(report.status,'signed-and-notarized');assert.equal(report.codeSignature,'valid');assert.equal(report.notarization,'ticket-valid');assert.equal(report.artifacts[0].gatekeeper,'accepted');assert.equal(calls.filter(([command])=>command==='xcrun').length,2);
});

test('macOS Gatekeeper rejection is not mislabeled as a missing notarization ticket',()=>{
 const report=inspectDesktopSignatures({platform:'darwin',apps:['/tmp/Fictional.app'],run:(command,args)=>command==='spctl'?{status:1,stderr:'rejected'}:{status:0,stderr:command==='codesign'?'Authority=Fictional':'',stdout:command==='xcrun'?'The ticket is valid':''}});
 assert.equal(report.codeSignature,'valid');assert.equal(report.notarization,'ticket-valid');assert.equal(report.artifacts[0].gatekeeper,'rejected');assert.equal(report.status,'signed-but-rejected');
});

test('macOS unsigned or invalid bundles are reported from verification output',()=>{
 const unsigned=inspectDesktopSignatures({platform:'darwin',apps:['/tmp/Fictional.app'],run:()=>({status:1,stderr:'code object is not signed at all'})});assert.equal(unsigned.status,'unsigned');assert.equal(unsigned.codeSignature,'unsigned');
 const invalid=inspectDesktopSignatures({platform:'darwin',apps:['/tmp/Fictional.app'],run:()=>({status:1,stderr:'code signature invalid'})});assert.equal(invalid.status,'invalid');
 let appIndex=0;const mixed=inspectDesktopSignatures({platform:'darwin',apps:['/tmp/Signed.app','/tmp/Unsigned.app'],run:(command,args)=>{if(command==='codesign'&&args[0]==='--verify')return appIndex++===0?{status:0}:{status:1,stderr:'code object is not signed at all'};return {status:0,stderr:'Authority=Fictional'};}});assert.equal(mixed.status,'mixed');assert.equal(mixed.codeSignature,'mixed');
});

test('Windows Authenticode checks each installer while Linux reports OS signing as not applicable',()=>{
 const run=(command,args,options)=>({status:0,stdout:JSON.stringify({status:options.env.FOLIQUO_SIGNATURE_FILE==='one.exe'?'Valid':'NotSigned',subject:'CN=Fictional'})});
 const windows=inspectDesktopSignatures({platform:'win32',files:['one.exe','two.msix'],run});assert.equal(windows.status,'mixed');assert.deepEqual(windows.artifacts.map(item=>item.codeSignature),['valid','unsigned']);
 const signed=inspectDesktopSignatures({platform:'win32',files:['one.exe'],run:()=>({status:0,stdout:'{"status":"Valid","subject":"CN=Fictional"}'})});assert.equal(signed.status,'signed');
 const linux=inspectDesktopSignatures({platform:'linux'});assert.equal(linux.status,'not-applicable');assert.equal(linux.codeSignature,'not-applicable');
});
