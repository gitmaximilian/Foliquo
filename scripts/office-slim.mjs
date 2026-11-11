// Removes LibreOffice modules that Foliquo never uses (spreadsheets, presentations,
// drawings, databases, Basic IDE, galleries and document templates) from the copy
// bundled with the desktop app, then proves that every export and upload
// conversion still produces identical PDF page content. The original installation
// is never modified. macOS is excluded because removing files would invalidate the
// LibreOffice.app code signature.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,readdir,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {PDFArray,PDFDocument,PDFRawStream,decodePDFRawStream} from 'pdf-lib';

const run=promisify(execFile);

// Module libraries, named without platform prefix/suffix (Linux: lib<name>lo.so, Windows: <name>lo.dll).
export const UNUSED_MODULES=Object.freeze(['PresentationMinimizer','analysis','animcore','basctl','date','dba','dbahsql','pdfimport','pricing','sc','scd','scfilt','scn','scui','sd','sdbt','sdd','sdui','slideshow','solver','vbaobj','wpftcalc','wpftdraw','wpftimpress']);
export const UNUSED_LAUNCHERS=Object.freeze(['sbase','scalc','sdraw','simpress','smath']);
export const UNUSED_SHARE=Object.freeze(['gallery','wizards']);
export const UNUSED_UI_MODULES=Object.freeze(['BasicIDE','dbapp','dbbrowser','dbquery','dbrelation','dbreport','dbtable','dbtdata','sbibliography','scalc','sdraw','simpress','smath']);
export const UNUSED_REGISTRY=Object.freeze(['calc','draw','impress','ogltrans','pdfimport']);
// Writer/Web needs share/template/common/internal (html.stw); without it HTML, and therefore the Arabic PDF export, changes layout.
export const KEPT_TEMPLATES=Object.freeze(['common/internal']);

export function slimTargets(officeRoot,platform=process.platform){
 if(platform!=='linux'&&platform!=='win32')return [];
 const library=platform==='win32'?name=>`${name}lo.dll`:name=>`lib${name}lo.so`,launcher=platform==='win32'?name=>`${name}.exe`:name=>name;
 return [
  ...UNUSED_MODULES.map(name=>join(officeRoot,'program',library(name))),
  ...UNUSED_LAUNCHERS.map(name=>join(officeRoot,'program',launcher(name))),
  ...UNUSED_SHARE.map(name=>join(officeRoot,'share',name)),
  ...UNUSED_UI_MODULES.map(name=>join(officeRoot,'share','config','soffice.cfg','modules',name)),
  ...UNUSED_REGISTRY.map(name=>join(officeRoot,'share','registry',`${name}.xcd`)),
 ];
}

async function size(path){const info=await stat(path).catch(()=>null);if(!info)return 0;if(!info.isDirectory())return info.size;let total=0;for(const entry of await readdir(path))total+=await size(join(path,entry));return total;}

async function pruneTemplates(officeRoot){
 const templates=join(officeRoot,'share','template');let removed=0;
 if(!(await stat(templates).catch(()=>null))?.isDirectory())return 0;
 const keep=KEPT_TEMPLATES.map(path=>join(templates,...path.split('/')));
 async function walk(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
   const path=join(directory,entry.name);
   if(keep.includes(path))continue;
   if(entry.isDirectory()&&keep.some(kept=>kept.startsWith(path+sep))){await walk(path);continue;}
   removed+=await size(path);await rm(path,{recursive:true,force:true});
  }
 }
 await walk(templates);return removed;
}

export async function slimOffice(officeRoot,platform=process.platform){
 let removed=0;const paths=[];
 for(const path of slimTargets(officeRoot,platform)){const bytes=await size(path);if(!bytes)continue;await rm(path,{recursive:true,force:true});removed+=bytes;paths.push(relative(officeRoot,path));}
 if(platform==='linux'||platform==='win32')removed+=await pruneTemplates(officeRoot);
 return {removed,paths};
}

// Page size plus decoded content streams; stable across runs and blind to timestamps and document IDs.
export async function pdfSignature(bytes){
 const pdf=await PDFDocument.load(bytes,{updateMetadata:false});
 return pdf.getPages().map(page=>{const contents=page.node.Contents(),streams=contents instanceof PDFArray?contents.asArray().map(ref=>pdf.context.lookup(ref)):[contents],hash=createHash('sha256');for(const stream of streams)hash.update(stream instanceof PDFRawStream?decodePDFRawStream(stream).decode():stream.getContents());const {width,height}=page.getSize();return `${width}x${height}:${hash.digest('hex')}`;});
}

async function convert(soffice,input,format,directory){
 const profile=join(directory,'profile');await mkdir(join(profile,'user'),{recursive:true});
 await run(soffice,[`-env:UserInstallation=${pathToFileURL(profile).href}`,'--headless','--nologo','--nodefault','--norestore',...(input.endsWith('.txt')?['--infilter=Text (encoded):UTF8']:[]),'--convert-to',format,'--outdir',directory,input],{timeout:120000,maxBuffer:1000000,env:{...process.env,TMPDIR:directory}});
}

export async function fixtureInputs(sourceSoffice,directory){
 const {createTranslationWord}=await import('../lib/word.mjs');
 const files=[];const add=async(name,bytes)=>{const path=join(directory,name);await writeFile(path,bytes);files.push(path);};
 const german='FIKTIVE URKUNDE\nName | Alex Example\nGeburtsdatum | 01.02.2000\nWohnort | Beispielstadt\n\nStempel:\nFiktives Standesamt\nBeispielstadt\n\n[Unterschrift: unleserlich]';
 await add('german.docx',createTranslationWord(german,{targetLanguage:'Deutsch',sourceLanguage:'Englisch'}));
 await add('english.docx',createTranslationWord('FICTIONAL CERTIFICATE\nName | Alex Example\nDate of birth | 01.02.2000\n\nStamp:\nFictional registry office\n\n[Signature: illegible]',{targetLanguage:'Englisch',sourceLanguage:'Arabisch'}));
 await add('arabic.html','<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"></head><body><h1>شهادة خيالية</h1><table border="1"><tr><td>الاسم</td><td>Alex Example</td></tr><tr><td>تاريخ الميلاد</td><td>01.02.2000</td></tr></table><p>ختم:<br>مكتب السجل الخيالي</p></body></html>');
 await add('note.txt','Fictional note\nName: Alex Example\nالاسم: مثال\n');
 for(const format of ['odt','rtf','doc']){await convert(sourceSoffice,join(directory,'german.docx'),format,directory);files.push(join(directory,`german.${format}`));}
 return files;
}

export async function conversionSignatures(soffice,inputs,directory){
 const result={};
 for(const input of inputs){const name=input.split(/[\\/]/).pop(),output=join(directory,name.replace(/\./g,'-'));await mkdir(output,{recursive:true});await convert(soffice,input,'pdf',output);result[name]=await pdfSignature(await readFile(join(output,name.replace(/\.[^.]+$/,'.pdf'))));}
 return result;
}

export async function verifySlimOffice(sourceSoffice,bundledSoffice){
 const directory=await mkdtemp(join(tmpdir(),'foliquo-office-check-'));
 try{
  const inputs=await fixtureInputs(sourceSoffice,join(directory));
  const expected=await conversionSignatures(sourceSoffice,inputs,join(directory,'source'));
  const actual=await conversionSignatures(bundledSoffice,inputs,join(directory,'bundled'));
  const changed=Object.keys(expected).filter(name=>JSON.stringify(expected[name])!==JSON.stringify(actual[name]));
  if(changed.length)throw new Error(`The slimmed LibreOffice changed PDF output for: ${changed.join(', ')}. Keep the full copy.`);
  return Object.keys(expected);
 }finally{await rm(directory,{recursive:true,force:true});}
}
