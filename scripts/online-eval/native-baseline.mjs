// Evaluation helper (no product code path): measures the native LibreOffice export used by Foliquo today.
// Uses only fictional fixtures from scripts/office-slim.mjs and the same PDF-page-content signature.
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir,cpus,totalmem} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {PDFDocument} from 'pdf-lib';
import {findOffice} from '../../lib/formats.mjs';
import {fixtureInputs,conversionSignatures,pdfSignature} from '../office-slim.mjs';
const run=promisify(execFile);
const soffice=await findOffice();
const version=(await run(soffice,['--version'])).stdout.trim();
const dir=await mkdtemp(join(tmpdir(),'foliquo-online-eval-'));
try{
 const inputs=await fixtureInputs(soffice,dir);
 const timings={};
 const a=await conversionSignatures(soffice,inputs,join(dir,'run1'));
 const t0=Date.now();const b=await conversionSignatures(soffice,inputs,join(dir,'run2'));const total=Date.now()-t0;
 const deterministic=Object.keys(a).every(k=>JSON.stringify(a[k])===JSON.stringify(b[k]));
 for(const input of inputs){const name=input.split('/').pop();const s=Date.now();await conversionSignatures(soffice,[input],join(dir,'t-'+name));timings[name]=Date.now()-s;}
 const pages={};for(const k of Object.keys(a))pages[k]=a[k].length;
 console.log(JSON.stringify({version,cpus:cpus().length,memGB:Math.round(totalmem()/2**30),files:Object.keys(a).length,deterministic,totalMsForAll:total,perFileMs:timings,pages,signatures:a},null,1));
}finally{await rm(dir,{recursive:true,force:true});}
