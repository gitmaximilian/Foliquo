import {createHash} from 'node:crypto';
import {getDocument,Util} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {fileURLToPath} from 'node:url';

const hash=value=>createHash('sha256').update(value).digest('hex');
const clean=value=>String(value||'').normalize('NFKC').replace(/[\s\u200e\u200f]+/gu,' ').trim().toLocaleLowerCase();
const boundedBox=value=>Array.isArray(value)&&value.length===4&&value.every(Number.isFinite)?value:null;
const clamp=value=>Math.max(0,Math.min(1,value));

/** Read embedded PDF text locally. Image-only pages are left for OCR/manual review. */
export async function extractEmbeddedSourceBlocks(documents=[],{maxPages=150}={}){
 const blocks=[];let count=0,truncated=false;const sparsePages=[];
 for(let fileIndex=0;fileIndex<documents.length;fileIndex++){
  if(count>=maxPages){truncated=true;break;}
  const file=documents[fileIndex];if(file.type!=='application/pdf')continue;
  let loading;try{loading=getDocument({data:new Uint8Array(file.bytes),isEvalSupported:false,useWorkerFetch:false,disableFontFace:true,standardFontDataUrl:fileURLToPath(new URL('../dist/vendor/pdfjs/standard_fonts/',import.meta.url))+'/',cMapUrl:fileURLToPath(new URL('../dist/vendor/pdfjs/cmaps/',import.meta.url))+'/',cMapPacked:true,wasmUrl:fileURLToPath(new URL('../dist/vendor/pdfjs/wasm/',import.meta.url))+'/' });const pdf=await loading.promise;
   for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
    if(blocks.length>=5000){truncated=true;break;}
    if(++count>maxPages){truncated=true;break;}
    const page=await pdf.getPage(pageNumber),viewport=page.getViewport({scale:1}),content=await page.getTextContent(),rows=[],pageText=content.items.filter(item=>typeof item.str==='string'&&item.str.trim()).map(item=>item.str).join(' ');if(content.items.filter(item=>typeof item.str==='string'&&item.str.trim()).length<20||pageText.trim().length<80)sparsePages.push({fileIndex,page:pageNumber});
    for(const item of content.items){if(typeof item.str!=='string'||!item.str.trim())continue;const transform=Util.transform(viewport.transform,item.transform),height=Math.max(1,Math.hypot(transform[2],transform[3])),x=transform[4],baseline=transform[5];let row=rows.find(candidate=>Math.abs(candidate.baseline-baseline)<=Math.max(height,candidate.height)*.55);if(!row){row={baseline,height,parts:[],left:x,right:x,top:baseline-height,bottom:baseline};rows.push(row);}row.parts.push({x,width:Math.max(1,item.width),text:item.str});row.left=Math.min(row.left,x);row.right=Math.max(row.right,x+Math.max(1,item.width));row.top=Math.min(row.top,baseline-height);row.bottom=Math.max(row.bottom,baseline);row.height=Math.max(row.height,height);}
    rows.sort((a,b)=>b.baseline-a.baseline);let lineNo=0;
    for(const row of rows){if(blocks.length>=5000){truncated=true;break;}const visualParts=[...row.parts].sort((a,b)=>a.x-b.x),text=row.parts.map(part=>part.text).join(' ').replace(/\s+/gu,' ').trim();if(!text)continue;const box=[clamp(row.left/viewport.width),clamp((viewport.height-row.bottom)/viewport.height),clamp((row.right-row.left)/viewport.width),clamp((row.bottom-row.top)/viewport.height)];if(box[2]<=0||box[3]<=0)continue;const gaps=visualParts.slice(1).map((part,index)=>part.x-(visualParts[index].x+Math.max(1,visualParts[index].width||0))),kind=gaps.some(gap=>gap>Math.max(24,row.height*3))?'table':row.height>=14&&text.length<120?'heading':'paragraph';lineNo++;blocks.push({kind,label:`Textzeile ${lineNo}`,fileIndex,page:pageNumber,box,sourceText:text,translated:'',extractionMethod:'embedded-text'});}
   }
  }catch(error){if(error.message==='Das Quellinventar überschreitet die Seitenobergrenze.')throw error;}finally{await loading?.destroy?.();}
 }
 blocks.truncated=truncated;blocks.sparsePages=sparsePages;return blocks;
}

function targetNodeIds(document,text){
 const needle=clean(text);if(!needle)return [];
 const found=[];
 for(const block of document?.blocks||[]){
  if(block.type==='table'){
   for(const row of block.rows){const rowText=clean(row.map(cell=>cell.text).join(' | '));if(rowText.includes(needle))found.push(...row.map(cell=>cell.id));else for(const cell of row)if(clean(cell.text).includes(needle))found.push(cell.id);}
   continue;
  }
  const parts=block.type==='list'?block.items.map(value=>({id:block.id,text:value})):block.type==='pageBreak'?[]:[{id:block.id,text:block.content}];
  for(const part of parts)if(clean(part.text).includes(needle))found.push(part.id);
 }
 return [...new Set(found)].slice(0,20);
}

/** Build a deterministic inventory. Page entries are deliberately unreviewed: a page existing does not prove its contents were read. */
export function buildSourceInventory({files=[],pageCounts=[],fields=[],regions=[],sourceBlocks=[],document=null}={}){
 if(!Array.isArray(files)||files.length>10||!Array.isArray(pageCounts)||!Array.isArray(fields)||!Array.isArray(regions)||!Array.isArray(sourceBlocks))throw new Error('Quellinventar ist ungültig.');
 const items=[];
 const fileIds=files.map((file,index)=>`doc-${hash(Buffer.from(file.data||'','base64')).slice(0,20)}-${index}`);
 const pageId=(fileIndex,page)=>`page-${hash(`${fileIds[fileIndex]}:${page}`).slice(0,24)}`;
 for(let fileIndex=0;fileIndex<files.length;fileIndex++){
  const count=Math.max(1,Math.min(10000,Number.isInteger(pageCounts[fileIndex])?pageCounts[fileIndex]:1));
  for(let page=1;page<=count;page++){
   const id=pageId(fileIndex,page);items.push({id,documentId:fileIds[fileIndex],pageId:id,kind:'other',label:`Seite ${page}`,fileIndex,page,box:null,extractionMethod:'manual',coverageStatus:'unreviewed',targetNodeIds:[],review:null});
  }
 }
 const occurrences=new Map(),seen=new Set();
 const add=(kind,entry,sourceText,targetText,label)=>{
  const fileIndex=Number.isInteger(entry.fileIndex)&&entry.fileIndex>=0&&entry.fileIndex<files.length?entry.fileIndex:0;
  const pageNum=Number.isInteger(entry.page)&&entry.page>=1?entry.page:1;
  const location=JSON.stringify(boundedBox(entry.box)),dedupeKey=`${fileIndex}:${pageNum}:${clean(sourceText)}:${clean(targetText)}:${location}`;if(seen.has(dedupeKey))return;seen.add(dedupeKey);
  const fingerprint=`${kind}\0${clean(sourceText)}\0${clean(label)}\0${location}`,occurrence=occurrences.get(fingerprint)||0;occurrences.set(fingerprint,occurrence+1);
  const sourceHash=hash(`${fingerprint}\0${occurrence}`);
  const id=`src-${hash(`${fileIds[fileIndex]}:${pageNum}:${sourceHash}`).slice(0,28)}`;
  const targets=targetNodeIds(document,targetText);
  items.push({id,documentId:fileIds[fileIndex],pageId:pageId(fileIndex,pageNum),kind,label:String(label||kind).slice(0,150),fileIndex,page:pageNum,box:boundedBox(entry.box),extractionMethod:['embedded-text','local-ocr','manual'].includes(entry.extractionMethod)?entry.extractionMethod:'model',...(entry.extractionMethod==='local-ocr'?{certainty:'uncertain',confidence:Number.isFinite(entry.confidence)?Math.max(0,Math.min(100,Math.round(entry.confidence))):null}:{}),sourceText:String(sourceText||'').slice(0,2000),targetText:String(targetText||'').slice(0,2000),coverageStatus:targets.length?'mapped':'unreviewed',targetNodeIds:targets,review:null});
 };
 for(const source of sourceBlocks)add(source.kind||'paragraph',source,source.sourceText,source.translated,source.label);
 for(const field of fields)add('other',field,field.source,field.translated,field.label);
 for(const region of regions)add(region.kind||'other',region,region.source,region.translated,region.label);
 return {schema:1,items,summary:sourceCoverage(items),truncated:sourceBlocks.truncated===true,ocrIncomplete:sourceBlocks.ocrIncomplete===true};
}

export function sourceCoverage(items=[]){
 const total=items.length,reviewed=items.filter(item=>item.coverageStatus==='mapped'||item.coverageStatus==='unreadable-confirmed'||item.coverageStatus==='excluded-reviewed').length;
 const mapped=items.filter(item=>item.coverageStatus==='mapped').length;
 return {total,reviewed,mapped,open:total-reviewed,percent:total?Math.round(reviewed*100/total):0,label:'zugeordnete/geprüfte Quellbereiche'};
}
