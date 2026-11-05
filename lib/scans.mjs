import sharp from 'sharp';
import {PDFDocument} from 'pdf-lib';
import {getDocument,OPS,Util} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas,DOMMatrix,ImageData,Path2D} from '@napi-rs/canvas';
import {fileURLToPath} from 'node:url';
import {scanMetrics} from '../dist/scan-metrics.mjs';

export const SCAN_BOUNDS=Object.freeze({maxPagePixels:490000,maxPageSide:700,maxConcurrentPages:1,maxImagePixels:50000000,maxPagesPerFile:50,maxOperators:100000,maxTextItems:5000});
const assets=path=>fileURLToPath(new URL(path,import.meta.url)).replaceAll('\\','/')+'/';
const abort=signal=>signal?.throwIfAborted();
function pdfEvidence(operators,content,viewport){
 let matrix=[1,0,0,1,0,0],stack=[],minDpi=Infinity,dominantImages=0,limited=operators.fnArray.length>SCAN_BOUNDS.maxOperators;
 const area=viewport.width*viewport.height;
 for(let i=0;i<Math.min(operators.fnArray.length,SCAN_BOUNDS.maxOperators);i++){
  const op=operators.fnArray[i],args=operators.argsArray[i];
  if(op===OPS.save)stack.push([...matrix]);else if(op===OPS.restore)matrix=stack.pop()||[1,0,0,1,0,0];else if(op===OPS.transform)matrix=Util.transform(matrix,args);
  else if(op===OPS.paintFormXObjectBegin){stack.push([...matrix]);if(args[0])matrix=Util.transform(matrix,args[0]);}else if(op===OPS.paintFormXObjectEnd)matrix=stack.pop()||[1,0,0,1,0,0];
  else if(op===OPS.paintImageXObject||op===OPS.paintInlineImageXObject){
   const width=op===OPS.paintImageXObject?args[1]:args[0]?.width,height=op===OPS.paintImageXObject?args[2]:args[0]?.height,w=Math.hypot(matrix[0],matrix[1]),h=Math.hypot(matrix[2],matrix[3]);
   if(Number.isFinite(width)&&Number.isFinite(height)&&w>0&&h>0&&w*h>=area*.2){const dpi=Math.min(width/w,height/h)*72;if(Number.isFinite(dpi)&&dpi>0){minDpi=Math.min(minDpi,dpi);dominantImages++;}}
  }
 }
 const items=content.items.filter(item=>typeof item.str==='string'&&item.str.trim()),votes=new Map();let total=0,nearEdge=false;
 for(const item of items.slice(0,SCAN_BOUNDS.maxTextItems)){
  const transform=Util.transform(viewport.transform,item.transform),angle=(Math.atan2(transform[1],transform[0])*180/Math.PI+360)%360,nearest=(Math.round(angle/90)*90)%360,difference=Math.min(Math.abs(angle-nearest),360-Math.abs(angle-nearest));
  const weight=Math.min(100,item.str.replace(/\s/g,'').length);total+=weight;if(difference<10)votes.set(nearest,(votes.get(nearest)||0)+weight);
  const x=transform[4],y=transform[5],height=Math.hypot(transform[2],transform[3]);if(x<viewport.width*.025||x+Math.abs(item.width)>viewport.width*.975||y-height<viewport.height*.025||y>viewport.height*.975)nearEdge=true;
 }
 const [dominant,weight]=[...votes.entries()].sort((a,b)=>b[1]-a[1])[0]||[0,0],reliable=items.length>=3&&total>=20&&weight/total>=.85;
 return {resolution:Number.isFinite(minDpi)?{kind:'raster-estimate',dpi:Math.round(minDpi),dominantImages,limited}:{kind:'unknown',dpi:null,dominantImages:0,limited},pageKind:dominantImages?'image-pdf':items.length?'text-pdf':'vector-or-unknown',orientationSuggestion:reliable&&dominant?{rotation:(360-dominant)%360,method:'text-baselines',confidence:'heuristic'}:null,orientationStatus:reliable?'text-baselines':'unknown',nearEdge,textItemsLimited:items.length>SCAN_BOUNDS.maxTextItems};
}
export async function analyzeScan(file,{signal,onStart,onPage}={}){
 abort(signal);
 if(file.type!=='application/pdf'){
  const image=sharp(file.bytes,{limitInputPixels:SCAN_BOUNDS.maxImagePixels}).rotate(),info=await image.metadata();await onStart?.({name:file.name,pages:1,pdf:false});abort(signal);
  const {data,info:sample}=await image.resize({width:700,height:700,fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).removeAlpha().raw().toBuffer({resolveWithObject:true});abort(signal);
  const metrics=scanMetrics({data,width:sample.width,height:sample.height,channels:sample.channels,originalWidth:info.width,originalHeight:info.height}),page={number:1,status:'analyzed',...metrics,sampleWidth:sample.width,sampleHeight:sample.height,orientation:info.orientation||1,orientationSuggestion:null,orientationStatus:'unknown',resolution:{kind:'pixels',width:info.width,height:info.height}};await onPage?.(page);abort(signal);return {name:file.name,pages:1,...metrics,orientation:info.orientation||1,pageReports:[page],complete:true,bounds:SCAN_BOUNDS};
 }
 globalThis.DOMMatrix??=DOMMatrix;globalThis.ImageData??=ImageData;globalThis.Path2D??=Path2D;
 const loading=getDocument({data:new Uint8Array(file.bytes),isEvalSupported:false,useWorkerFetch:false,stopAtErrors:true,maxImageSize:SCAN_BOUNDS.maxImagePixels,canvasMaxAreaInBytes:SCAN_BOUNDS.maxPagePixels*4,standardFontDataUrl:assets('../dist/vendor/pdfjs/standard_fonts/'),cMapUrl:assets('../dist/vendor/pdfjs/cmaps/'),cMapPacked:true,wasmUrl:assets('../dist/vendor/pdfjs/wasm/')});
 const cancel=()=>void loading.destroy().catch(()=>{});signal?.addEventListener('abort',cancel,{once:true});
 try{
  const document=await loading.promise;abort(signal);if(document.numPages>SCAN_BOUNDS.maxPagesPerFile)throw new Error('Maximal 50 PDF-Seiten pro Datei.');
  await onStart?.({name:file.name,pdf:true,pages:document.numPages});const pageReports=[];
  for(let number=1;number<=document.numPages;number++){
   abort(signal);let page,canvas,report;
   try{
    page=await document.getPage(number);const base=page.getViewport({scale:1}),scale=Math.min(1,700/Math.max(base.width,base.height),Math.sqrt(SCAN_BOUNDS.maxPagePixels/(base.width*base.height))),viewport=page.getViewport({scale});canvas=createCanvas(Math.max(3,Math.floor(viewport.width)),Math.max(3,Math.floor(viewport.height)));const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);await page.render({canvas,canvasContext:context,viewport,background:'#fff'}).promise;abort(signal);
    const content=await page.getTextContent(),operators=await page.getOperatorList(),evidence=pdfEvidence(operators,content,base),pixels=context.getImageData(0,0,canvas.width,canvas.height),metrics=scanMetrics({data:pixels.data,width:canvas.width,height:canvas.height,channels:4,checkResolution:false});
    // White vector pages are not evidence of photographic overexposure or blur.
    if(evidence.pageKind==='text-pdf'){const keep=metrics.warningCodes.map((code,index)=>({code,message:metrics.warnings[index]})).filter(item=>!['blur','overexposed','dark'].includes(item.code));metrics.warningCodes=keep.map(item=>item.code);metrics.warnings=keep.map(item=>item.message);}
    if(evidence.resolution.limited||evidence.textItemsLimited){metrics.warningCodes.push('analysis-limited');metrics.warnings.push('Die lokale Seitenprüfung wurde begrenzt. Die gesamte Originalseite visuell prüfen.');}
    if(evidence.resolution.dpi!==null&&evidence.resolution.dpi<150){metrics.warningCodes.push('low-resolution-pdf');metrics.warnings.push('Geringe geschätzte PDF-Bildauflösung: kleine Schrift am Original prüfen.');}
    if(evidence.orientationSuggestion){metrics.warningCodes.push('orientation');metrics.warnings.push('Textzeilen erscheinen gedreht. Drehvorschlag vor dem Übernehmen visuell prüfen.');}
    if(evidence.nearEdge&&!metrics.warningCodes.includes('edge')){metrics.warningCodes.push('edge');metrics.warnings.push('Dunkle Inhalte nahe am Rand: auf abgeschnittene Angaben prüfen.');}
    report={number,status:'analyzed',...metrics,...evidence,width:base.width,height:base.height,sampleWidth:canvas.width,sampleHeight:canvas.height};
   }catch(error){abort(signal);report={number,status:'failed',warnings:['Diese Seite konnte nicht analysiert werden. Vor dem Übersetzen vollständig visuell prüfen.'],warningCodes:['analysis-failed'],orientationSuggestion:null,orientationStatus:'unknown'};}
   finally{if(canvas){canvas.width=1;canvas.height=1;}page?.cleanup();}
   pageReports.push(report);await onPage?.(report);abort(signal);await document.cleanup();
  }
  return {name:file.name,pdf:true,pages:document.numPages,pageReports,warnings:[...new Set(pageReports.flatMap(page=>page.warnings))],complete:pageReports.every(page=>page.status==='analyzed'),bounds:SCAN_BOUNDS};
 }finally{signal?.removeEventListener('abort',cancel);await loading.destroy().catch(()=>{});}
}
export async function correctScan(file,input){if(![0,90,180,270].includes(input.rotation||0))throw new Error('Drehung muss 0, 90, 180 oder 270 Grad sein.');let image;if(file.type==='application/pdf'){let pdf=await PDFDocument.load(file.bytes);if(input.pageOrder){const order=input.pageOrder,count=pdf.getPageCount();if(!Array.isArray(order)||order.length!==count||new Set(order).size!==count||order.some(n=>!Number.isInteger(n)||n<1||n>count))throw new Error('Seitenreihenfolge muss jede PDF-Seite genau einmal enthalten.');const sorted=await PDFDocument.create();for(const page of await sorted.copyPages(pdf,order.map(n=>n-1)))sorted.addPage(page);pdf=sorted;}const crops=input.crops||{};if(!crops||typeof crops!=='object'||Array.isArray(crops)||Object.keys(crops).length>pdf.getPageCount())throw new Error('Ungültige PDF-Zuschnitte.');for(const [pageText,b]of Object.entries(crops)){const number=Number(pageText);if(String(number)!==pageText||!Number.isInteger(number)||number<1||number>pdf.getPageCount()||!Array.isArray(b)||b.length!==4||!b.every(n=>Number.isFinite(n)&&n>=0&&n<=1)||b[2]<=0||b[3]<=0||b[0]+b[2]>1||b[1]+b[3]>1)throw new Error('Ungültiger relativer PDF-Zuschnitt.');const p=pdf.getPage(number-1),box=p.getCropBox(),rotation=((p.getRotation().angle%360)+360)%360;let x,y,w,h;if(rotation===90){x=box.x+(1-(b[1]+b[3]))*box.width;y=box.y+b[0]*box.height;w=b[3]*box.width;h=b[2]*box.height;}else if(rotation===180){x=box.x+(1-(b[0]+b[2]))*box.width;y=box.y+b[1]*box.height;w=b[2]*box.width;h=b[3]*box.height;}else if(rotation===270){x=box.x+b[1]*box.width;y=box.y+(1-(b[0]+b[2]))*box.height;w=b[3]*box.width;h=b[2]*box.height;}else{x=box.x+b[0]*box.width;y=box.y+(1-(b[1]+b[3]))*box.height;w=b[2]*box.width;h=b[3]*box.height;}p.setCropBox(x,y,w,h);}const rotations=input.rotations||{};if(!rotations||typeof rotations!=='object'||Array.isArray(rotations)||Object.keys(rotations).length>pdf.getPageCount()||Object.entries(rotations).some(([page,angle])=>!/^[1-9]\d*$/.test(page)||Number(page)<1||Number(page)>pdf.getPageCount()||![0,90,180,270].includes(angle)))throw new Error('Ungültige PDF-Seitendrehungen.');for(const [index,p]of pdf.getPages().entries())p.setRotation({type:'degrees',angle:(p.getRotation().angle+(rotations[index+1]??input.rotation??0))%360});return {name:file.name.replace(/\.pdf$/i,'-korrigiert.pdf'),type:'application/pdf',bytes:Buffer.from(await pdf.save())};}
 if(input.pageOrder||input.rotations)throw new Error('Seitenreihenfolge und Seitendrehungen nur für PDFs.');image=sharp(file.bytes,{limitInputPixels:50000000}).rotate();const normalized=await image.png().toBuffer(),meta=await sharp(normalized).metadata();image=sharp(normalized);if(input.crop){const b=input.crop;if(!Array.isArray(b)||b.length!==4||!b.every(n=>Number.isFinite(n)&&n>=0&&n<=1)||b[2]<=0||b[3]<=0||b[0]+b[2]>1||b[1]+b[3]>1)throw new Error('Ungültiger relativer Zuschnitt.');image=image.extract({left:Math.floor(b[0]*meta.width),top:Math.floor(b[1]*meta.height),width:Math.max(1,Math.floor(b[2]*meta.width)),height:Math.max(1,Math.floor(b[3]*meta.height))});}const bytes=await image.rotate(input.rotation||0).png().toBuffer();return {name:file.name.replace(/\.[^.]+$/,'')+'-korrigiert.png',type:'image/png',bytes};}
