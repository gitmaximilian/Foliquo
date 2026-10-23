import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm, mkdir, access } from 'node:fs/promises';
import { join, extname, win32 } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import convertHEIC from 'heic-convert';
import bmp from 'bmp-js';
import { unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
const run = promisify(execFile);
export const TYPES = {
 pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',tif:'image/tiff',tiff:'image/tiff',bmp:'image/bmp',heic:'image/heic',heif:'image/heif',avif:'image/avif',
 docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',doc:'application/msword',odt:'application/vnd.oasis.opendocument.text',rtf:'application/rtf',txt:'text/plain',md:'text/markdown',
};
function zipContains(bytes,required){let total=0,count=0,found=false;try{unzipSync(bytes,{filter:file=>{total+=file.originalSize;count++;if(total>150*1024*1024||count>3000)throw new Error('Archive too large');if(file.name===required)found=true;return false;}});}catch{throw new Error('Die Office-Datei ist beschädigt oder ungewöhnlich groß.');}return found;}
export function validateUpload(files){
 if(!Array.isArray(files)||!files.length||files.length>10)throw new Error('Bitte 1 bis 10 Dateien auswählen.');let total=0;
 return files.map(f=>{
  if(!f||typeof f.name!=='string'||!f.name||f.name.length>240||typeof f.data!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(f.data))throw new Error('Ungültige Dateiübertragung.');
  const bytes=Buffer.from(f.data,'base64'),extension=extname(f.name).slice(1).toLowerCase();total+=bytes.length;
  if(!bytes.length||bytes.length>20*1024*1024||total>35*1024*1024)throw new Error('Maximal 20 MB pro Datei und 35 MB insgesamt.');
  const type=TYPES[extension];if(!type)throw new Error(`Dateiformat .${extension||'?'} wird nicht unterstützt.`);
  const h=bytes.subarray(0,16),ascii=h.toString('latin1');let valid=false;
  if(type==='application/pdf')valid=ascii.startsWith('%PDF-');
  else if(type==='image/jpeg')valid=h[0]===255&&h[1]===216&&h[2]===255;
  else if(type==='image/png')valid=h.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  else if(type==='image/webp')valid=ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP';
  else if(type==='image/gif')valid=/^GIF8[79]a/.test(ascii);
  else if(type==='image/tiff')valid=h.subarray(0,4).equals(Buffer.from([73,73,42,0]))||h.subarray(0,4).equals(Buffer.from([77,77,0,42]));
  else if(type==='image/bmp')valid=ascii.startsWith('BM');
  else if(['image/heic','image/heif','image/avif'].includes(type))valid=ascii.slice(4,8)==='ftyp';
  else if(extension==='docx')valid=ascii.startsWith('PK')&&zipContains(bytes,'word/document.xml');
  else if(extension==='odt')valid=ascii.startsWith('PK')&&zipContains(bytes,'content.xml');
  else if(extension==='doc')valid=h.subarray(0,8).equals(Buffer.from([208,207,17,224,161,177,26,225]));
  else if(extension==='rtf')valid=ascii.startsWith('{\\rtf');
  else if(type.startsWith('text/')){try{const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);valid=!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text);}catch{}}
  if(!valid)throw new Error(`${f.name}: Inhalt und Dateiformat passen nicht zusammen oder die Datei ist beschädigt.`);
  return {name:f.name,type,bytes,extension};
 });
}
async function temporary(callback){const directory=await mkdtemp(join(tmpdir(),'translateocr-convert-'));try{return await callback(directory);}finally{await rm(directory,{recursive:true,force:true});}}
export function officeCandidates({platform=process.platform,env=process.env,home=homedir(),resources=process.resourcesPath}={}){
 const paths=env.TRANSLATEOCR_SOFFICE?[env.TRANSLATEOCR_SOFFICE]:[];
 if(resources){
  if(platform==='win32')for(const exe of ['soffice.com','soffice.exe'])paths.push(win32.join(resources,'libreoffice','program',exe));
  else if(platform==='darwin')paths.push(join(resources,'libreoffice','LibreOffice.app','Contents','MacOS','soffice'));
  else paths.push(join(resources,'libreoffice','program','soffice'));
 }
 if(platform==='win32')for(const base of [env.ProgramFiles||'C:\\Program Files',env['ProgramFiles(x86)']||'C:\\Program Files (x86)'])for(const exe of ['soffice.com','soffice.exe'])paths.push(win32.join(base,'LibreOffice','program',exe));
 else if(platform==='darwin')paths.push(join(home,'.cache/codex-runtimes/codex-primary-runtime/dependencies/native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/MacOS/soffice'),'/Applications/LibreOffice.app/Contents/MacOS/soffice');
 else paths.push('/usr/bin/libreoffice','/usr/bin/soffice','/usr/local/bin/soffice');
 return [...new Set(paths)];
}
export async function findOffice(){for(const candidate of officeCandidates()){try{await access(candidate);return candidate;}catch{}}throw new Error('LibreOffice wurde nicht gefunden. Bitte LibreOffice installieren oder TRANSLATEOCR_SOFFICE auf die ausführbare Datei setzen.');}
export async function officeToPDF(bytes,extension){
 return temporary(async directory=>{
  const soffice=await findOffice();
  const profile=join(directory,'profile');await mkdir(join(profile,'user'),{recursive:true});
  await writeFile(join(profile,'user','registrymodifications.xcu'),'<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item><item oor:path="/org.openoffice.Office.Writer/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>0</value></prop></item></oor:items>',{mode:0o600});
  const normalized=extension==='md'?'txt':extension,input=join(directory,`input.${normalized}`);await writeFile(input,bytes,{mode:0o600});
  try{await run(soffice,[`-env:UserInstallation=${pathToFileURL(profile).href}`,'--headless','--nologo','--nodefault','--norestore',...(normalized==='txt'?['--infilter=Text (encoded):UTF8']:[]),'--convert-to','pdf','--outdir',directory,input],{timeout:60000,maxBuffer:100000,env:{...process.env,TMPDIR:directory,XDG_CACHE_HOME:join(directory,'cache')}});
   const output=await readFile(join(directory,'input.pdf'));if(output.subarray(0,5).toString()!=='%PDF-')throw new Error('Not PDF');return output;
  }catch{throw new Error('Die Datei konnte nicht als PDF geöffnet werden. Bitte eine unverschlüsselte, intakte Datei verwenden.');}
 });
}
export async function specialImageToPNG(file){
 try{
  if(file.type==='image/bmp'){
   if(file.bytes.length<54)throw new Error('Invalid BMP');const width=Math.abs(file.bytes.readInt32LE(18)),height=Math.abs(file.bytes.readInt32LE(22));if(!width||!height||width*height>50000000)throw new Error('Too many pixels');
   const decoded=bmp.decode(file.bytes),rgba=Buffer.alloc(decoded.width*decoded.height*4);for(let i=0;i<rgba.length;i+=4){rgba[i]=decoded.data[i+3];rgba[i+1]=decoded.data[i+2];rgba[i+2]=decoded.data[i+1];rgba[i+3]=255;}
   return await sharp(rgba,{raw:{width:decoded.width,height:decoded.height,channels:4}}).png().toBuffer();
  }
  return Buffer.from(await convertHEIC({buffer:file.bytes,format:'PNG'}));
 }catch{throw new Error('Dieses Bild konnte nicht gelesen werden. Bitte alternativ als JPG oder PNG speichern.');}
}
async function imageToPDF(file){
 if(['image/heic','image/heif','image/bmp'].includes(file.type)){
  const png=await specialImageToPNG(file);return imageToPDF({...file,type:'image/png',extension:'png',bytes:png});
 }
 const info=await sharp(file.bytes,{limitInputPixels:50000000}).metadata();const count=file.type==='image/tiff'?(info.pages||1):1;if(count>50)throw new Error('Bitte maximal 50 Bildseiten pro Datei verwenden.');
 const pdf=await PDFDocument.create();
 for(let i=0;i<count;i++){
  const png=await sharp(file.bytes,{page:i,pages:1,limitInputPixels:50000000}).rotate().png().toBuffer();const image=await pdf.embedPng(new Uint8Array(png));const p=pdf.addPage([595.28,841.89]);const d=image.scaleToFit(515,762);p.drawImage(image,{x:(595.28-d.width)/2,y:(841.89-d.height)/2,width:d.width,height:d.height});
 }
 return Buffer.from(await pdf.save());
}
export async function prepareDocuments(files){
 const result=[];let total=0;
 for(const file of files){
  let normalized=file;
  if(!['application/pdf','image/jpeg','image/png'].includes(file.type)){
   let bytes;try{bytes=file.type.startsWith('image/')?await imageToPDF(file):await officeToPDF(file.bytes,file.extension);}catch(error){throw new Error(`${file.name}: ${error.message}`);}
   normalized={name:file.name.replace(/\.[^.]+$/,'')+'.pdf',type:'application/pdf',bytes,originalName:file.name};
  }
  total+=normalized.bytes.length;if(total>35*1024*1024)throw new Error('Die konvertierten Dokumente sind zusammen größer als 35 MB. Bitte weniger Dateien auf einmal verarbeiten.');
  if(normalized.type==='application/pdf'){let doc;try{doc=await PDFDocument.load(normalized.bytes);}catch{throw new Error(`${file.name}: PDF ist beschädigt oder verschlüsselt.`);}if(doc.getPageCount()>50)throw new Error('Maximal 50 PDF-Seiten pro Datei.');}
  result.push(normalized);
 }
 return result;
}
