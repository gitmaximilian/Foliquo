// Page images of the source documents for the Word download, so the editable file carries the original
// after the translation like the PDF does. Rendering stays local; nothing leaves the computer.
import sharp from 'sharp';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {fileURLToPath} from 'node:url';

export const SOURCE_IMAGE_BOUNDS=Object.freeze({maxPages:50,longSide:1754,quality:82,maxInputPixels:50000000});
const assets=path=>fileURLToPath(new URL(path,import.meta.url)).replaceAll('\\','/')+'/';

async function jpeg(input){
 const image=sharp(input,{limitInputPixels:SOURCE_IMAGE_BOUNDS.maxInputPixels}).rotate().flatten({background:'#ffffff'});
 const {data,info}=await image.resize({width:SOURCE_IMAGE_BOUNDS.longSide,height:SOURCE_IMAGE_BOUNDS.longSide,fit:'inside',withoutEnlargement:true}).jpeg({quality:SOURCE_IMAGE_BOUNDS.quality,mozjpeg:true}).toBuffer({resolveWithObject:true});
 return {bytes:data,width:info.width,height:info.height,type:'image/jpeg'};
}

async function pdfPages(bytes,limit){
 const loading=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useWorkerFetch:false,stopAtErrors:false,standardFontDataUrl:assets('../dist/vendor/pdfjs/standard_fonts/'),cMapUrl:assets('../dist/vendor/pdfjs/cmaps/'),cMapPacked:true,wasmUrl:assets('../dist/vendor/pdfjs/wasm/')});
 const pages=[];
 try{
  const document=await loading.promise;
  for(let number=1;number<=Math.min(document.numPages,limit);number++){
   const page=await document.getPage(number);let canvas;
   try{
    const base=page.getViewport({scale:1}),scale=SOURCE_IMAGE_BOUNDS.longSide/Math.max(base.width,base.height),viewport=page.getViewport({scale});
    canvas=createCanvas(Math.max(1,Math.round(viewport.width)),Math.max(1,Math.round(viewport.height)));const context=canvas.getContext('2d');
    context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);
    await page.render({canvas,canvasContext:context,viewport,background:'#ffffff'}).promise;
    pages.push(await jpeg(await canvas.encode('png')));
   }finally{if(canvas){canvas.width=1;canvas.height=1;}page.cleanup();}
  }
  await document.cleanup();
 }finally{await loading.destroy().catch(()=>{});}
 return pages;
}

// documents: [{name,type,bytes}] as used for the PDF export; returns one image per source page, in order.
export async function sourcePageImages(documents=[]){
 const pages=[];
 for(const file of documents){
  const left=SOURCE_IMAGE_BOUNDS.maxPages-pages.length;if(left<=0)break;
  if(file.type==='application/pdf')pages.push(...await pdfPages(file.bytes,left));
  else if(['image/jpeg','image/png'].includes(file.type))pages.push(await jpeg(file.bytes));
 }
 return pages;
}
