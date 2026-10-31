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
    for(const item of content.items){
     if(typeof item.str!=='string'||!item.str.trim())continue;
     const transform=Util.transform(viewport.transform,item.transform),baselineLength=Math.hypot(transform[0],transform[1])||1,height=Math.max(1,Math.hypot(transform[2],transform[3])),direction=[transform[0]/baselineLength,transform[1]/baselineLength];
     if(direction[0]<-1e-6||Math.abs(direction[0])<=1e-6&&direction[1]<0){direction[0]*=-1;direction[1]*=-1;}
     const normal=[-direction[1],direction[0]],start=[transform[4],transform[5]],baseline=start[0]*normal[0]+start[1]*normal[1],itemWidth=Math.max(1,Number(item.width)||0),actualDirection=[transform[0]/baselineLength,transform[1]/baselineLength],normalLength=Math.hypot(transform[2],transform[3])||1,vertical=[transform[2]/normalLength,transform[3]/normalLength],end=[start[0]+actualDirection[0]*itemWidth,start[1]+actualDirection[1]*itemWidth],farStart=[start[0]+vertical[0]*height,start[1]+vertical[1]*height],farEnd=[end[0]+vertical[0]*height,end[1]+vertical[1]*height],corners=[start,end,farStart,farEnd],left=Math.min(...corners.map(point=>point[0])),right=Math.max(...corners.map(point=>point[0])),top=Math.min(...corners.map(point=>point[1])),bottom=Math.max(...corners.map(point=>point[1])),along=start[0]*direction[0]+start[1]*direction[1],alongEnd=end[0]*direction[0]+end[1]*direction[1];
     let row=rows.find(candidate=>candidate.direction[0]*direction[0]+candidate.direction[1]*direction[1]>.995&&Math.abs(candidate.baseline-baseline)<=Math.max(height,candidate.height)*.55);
     if(!row){row={baseline,height,direction,parts:[],left,right,top,bottom};rows.push(row);}
     row.parts.push({start:Math.min(along,alongEnd),end:Math.max(along,alongEnd),text:item.str});row.left=Math.min(row.left,left);row.right=Math.max(row.right,right);row.top=Math.min(row.top,top);row.bottom=Math.max(row.bottom,bottom);row.height=Math.max(row.height,height);
    }
    rows.sort((a,b)=>b.baseline-a.baseline);let lineNo=0;
    for(const row of rows){if(blocks.length>=5000){truncated=true;break;}const visualParts=[...row.parts].sort((a,b)=>a.start-b.start),text=row.parts.map(part=>part.text).join(' ').replace(/\s+/gu,' ').trim();if(!text)continue;const box=[clamp(row.left/viewport.width),clamp((viewport.height-row.bottom)/viewport.height),clamp((row.right-row.left)/viewport.width),clamp((row.bottom-row.top)/viewport.height)];if(box[2]<=0||box[3]<=0)continue;const gaps=visualParts.slice(1).map((part,index)=>part.start-visualParts[index].end),kind=gaps.some(gap=>gap>Math.max(24,row.height*3))?'table':row.height>=14&&text.length<120?'heading':'paragraph';lineNo++;blocks.push({kind,label:`Textzeile ${lineNo}`,fileIndex,page:pageNumber,box,sourceText:text,translated:'',extractionMethod:'embedded-text'});}
   }
  }catch(error){if(error.message==='Das Quellinventar überschreitet die Seitenobergrenze.')throw error;}finally{await loading?.destroy?.();}
 }
 blocks.truncated=truncated;blocks.sparsePages=sparsePages;return blocks;
}

function targetNodeIds(document,text,sourceId=''){
 const needle=clean(text);
 const found=[],linked=[];
 for(const block of document?.blocks||[]){
  if(block.type==='table'){
   if(sourceId&&block.sourceBlockIds?.includes(sourceId))linked.push(block.id);
   for(const row of block.rows){const rowText=clean(row.map(cell=>cell.text).join(' | '));if(sourceId&&row.some(cell=>cell.sourceBlockIds?.includes(sourceId))){for(const cell of row)if(cell.sourceBlockIds?.includes(sourceId))linked.push(cell.id);}else if(rowText&&needle&&rowText.includes(needle))found.push(...row.map(cell=>cell.id));else for(const cell of row)if(needle&&clean(cell.text).includes(needle))found.push(cell.id);}
   continue;
  }
  const parts=block.type==='list'?block.items.map(value=>({id:block.id,text:value})):block.type==='pageBreak'?[]:[{id:block.id,text:block.content}];
  for(const part of parts)if(sourceId&&block.sourceBlockIds?.includes(sourceId))linked.push(part.id);else if(needle&&clean(part.text).includes(needle))found.push(part.id);
 }
 return [...new Set(linked.length?linked:found)].slice(0,200);
}

/** Build a deterministic inventory. Page entries are deliberately unreviewed: a page existing does not prove its contents were read. */
export function buildSourceInventory({files=[],pageCounts=[],fields=[],regions=[],sourceBlocks=[],document=null,previousInventory=null}={}){
 if(!Array.isArray(files)||files.length>10||!Array.isArray(pageCounts)||!Array.isArray(fields)||!Array.isArray(regions)||!Array.isArray(sourceBlocks))throw new Error('Quellinventar ist ungültig.');
 const items=[];
 const fileIds=files.map((file,index)=>`doc-${hash(Buffer.from(file.data||'','base64')).slice(0,20)}-${index}`);
 const pageId=(fileIndex,page)=>`page-${hash(`${fileIds[fileIndex]}:${page}`).slice(0,24)}`;
 for(let fileIndex=0;fileIndex<files.length;fileIndex++){
  const count=Math.max(1,Math.min(10000,Number.isInteger(pageCounts[fileIndex])?pageCounts[fileIndex]:1));
  for(let page=1;page<=count;page++){
   const id=pageId(fileIndex,page),previous=previousInventory?.items?.find(item=>item.id===id),decision=previous?.review?.decision,targets=targetNodeIds(document,'',id),coverageStatus=decision==='unreadable'?'unreadable-confirmed':decision==='exclude'?'excluded-reviewed':decision==='map'&&targets.length?'mapped':'unreviewed';items.push({id,documentId:fileIds[fileIndex],pageId:id,kind:'other',label:`Seite ${page}`,fileIndex,page,box:null,extractionMethod:'manual',coverageStatus,targetNodeIds:targets,review:previous?.review||null});
  }
 }
 const occurrences=new Map(),seen=new Set();
 const add=(kind,entry,sourceText,targetText,label,association='')=>{
  const fileIndex=Number.isInteger(entry.fileIndex)&&entry.fileIndex>=0&&entry.fileIndex<files.length?entry.fileIndex:0;
  const pageNum=Number.isInteger(entry.page)&&entry.page>=1?entry.page:1;
  const location=JSON.stringify(boundedBox(entry.box)),dedupeKey=`${fileIndex}:${pageNum}:${clean(sourceText)}:${clean(targetText)}:${location}`;if(seen.has(dedupeKey))return;seen.add(dedupeKey);
  const fingerprint=`${kind}\0${clean(sourceText)}\0${clean(label)}\0${location}`,occurrence=occurrences.get(fingerprint)||0;occurrences.set(fingerprint,occurrence+1);
  const sourceHash=hash(`${fingerprint}\0${occurrence}`);
  const id=`src-${hash(`${fileIds[fileIndex]}:${pageNum}:${sourceHash}`).slice(0,28)}`;
  const targets=targetNodeIds(document,targetText,id),previous=previousInventory?.items?.find(item=>item.id===id),decision=previous?.review?.decision;
  let coverageStatus=targets.length?'mapped':'unreviewed',review=previous?.review||null;
  if(decision==='unmap'){coverageStatus='unreviewed';}
  else if(decision==='map'){if(targets.length)coverageStatus='mapped';else review=null;}
  else if(decision==='unreadable')coverageStatus='unreadable-confirmed';
  else if(decision==='exclude')coverageStatus='excluded-reviewed';
  items.push({id,documentId:fileIds[fileIndex],pageId:pageId(fileIndex,pageNum),kind,label:String(label||kind).slice(0,150),fileIndex,page:pageNum,box:boundedBox(entry.box),extractionMethod:['embedded-text','local-ocr','manual'].includes(entry.extractionMethod)?entry.extractionMethod:'model',...(association==='field'&&typeof entry.id==='string'?{fieldId:entry.id}:typeof entry.fieldId==='string'?{fieldId:entry.fieldId}:{}),...(association==='region'&&typeof entry.id==='string'?{regionId:entry.id}:typeof entry.regionId==='string'?{regionId:entry.regionId}:{}),...(entry.extractionMethod==='local-ocr'?{certainty:'uncertain',confidence:Number.isFinite(entry.confidence)?Math.max(0,Math.min(100,Math.round(entry.confidence))):null}:{}),sourceText:String(sourceText||'').slice(0,2000),targetText:String(targetText||'').slice(0,2000),coverageStatus,targetNodeIds:targets,review});
 };
 for(const source of sourceBlocks)add(source.kind||'paragraph',source,source.sourceText,source.translated,source.label);
 for(const field of fields)add('other',field,field.source,field.translated,field.label,'field');
 for(const region of regions)add(region.kind||'other',region,region.source,region.translated,region.label,'region');
 return {schema:1,items,summary:sourceCoverage(items),truncated:sourceBlocks.truncated===true,ocrIncomplete:sourceBlocks.ocrIncomplete===true};
}

export function sourceCoverage(items=[]){
 const total=items.length,reviewed=items.filter(item=>item.coverageStatus==='mapped'||item.coverageStatus==='unreadable-confirmed'||item.coverageStatus==='excluded-reviewed').length;
 const mapped=items.filter(item=>item.coverageStatus==='mapped').length;
 return {total,reviewed,mapped,open:total-reviewed,percent:total?Math.round(reviewed*100/total):0,label:'zugeordnete/geprüfte Quellbereiche'};
}

export function applySourceInventoryDecision(job,input,review,{beforeCommit=()=>{}}={}){
 const inventory=job.result?.sourceInventory,document=job.result?.document;
 if(!inventory||!Array.isArray(inventory.items)||!document||!Number.isInteger(input.version)||input.version!==review.version||review.busy||review.proposal||review.hasQuestions)throw new Error('Bitte zuerst die aktuelle abgeschlossene Fassung prüfen.');
 if(typeof input.sourceId!=='string')throw new Error('Quellbereich fehlt.');
 const item=inventory.items.find(candidate=>candidate.id===input.sourceId);if(!item)throw new Error('Quellbereich nicht gefunden.');
 const action=input.action;if(!['map','unmap','unreadable','exclude'].includes(action))throw new Error('Ungültige Quellbereichsentscheidung.');
 const reason=typeof input.reason==='string'?input.reason.trim().slice(0,500):'';if(action==='exclude'&&reason.length<5)throw new Error('Ein Ausschluss braucht eine kurze Begründung.');
 let targets=[];
 if(action==='map'){
  if(!Array.isArray(input.targetNodeIds)||input.targetNodeIds.length<1||input.targetNodeIds.length>200||new Set(input.targetNodeIds).size!==input.targetNodeIds.length)throw new Error('Bitte mindestens einen eindeutigen Übersetzungsknoten auswählen.');
  const available=new Set();for(const block of document.blocks||[]){available.add(block.id);for(const row of block.rows||[])for(const cell of row)available.add(cell.id);}
  if(input.targetNodeIds.some(id=>typeof id!=='string'||!available.has(id)))throw new Error('Ungültiger Übersetzungsknoten.');targets=input.targetNodeIds;
 }
 beforeCommit();
 const priorTargets=item.targetNodeIds||[],affected=new Set([...priorTargets,...targets]);
 for(const block of document.blocks||[]){block.sourceBlockIds=(block.sourceBlockIds||[]).filter(id=>id!==item.id);for(const row of block.rows||[])for(const cell of row)cell.sourceBlockIds=(cell.sourceBlockIds||[]).filter(id=>id!==item.id);}
 for(const block of document.blocks||[]){if(targets.includes(block.id))block.sourceBlockIds=[...new Set([...(block.sourceBlockIds||[]),item.id])];for(const row of block.rows||[])for(const cell of row)if(targets.includes(cell.id))cell.sourceBlockIds=[...new Set([...(cell.sourceBlockIds||[]),item.id])];}
 item.targetNodeIds=targets;item.coverageStatus=action==='map'?'mapped':action==='unreadable'?'unreadable-confirmed':action==='exclude'?'excluded-reviewed':'unreviewed';item.review={version:review.version+1,decision:action,...(reason?{reason}:{})};
 const invalidatedCheckIds=[];for(const check of job.result.checks||[]){const mustInvalidate=(item.fieldId&&check.id===item.fieldId)||(item.regionId&&check.id===item.regionId)||check.id==='completeness'&&(item.kind==='other'&&item.label.startsWith('Seite'))||check.id==='region-coverage'&&['stamp','handwriting','signature'].includes(item.kind);if(mustInvalidate){if(check.confirmed)invalidatedCheckIds.push(check.id);check.confirmed=false;}}
 inventory.summary=sourceCoverage(inventory.items);review.version++;review.finalizedVersion=null;job.finishedAt=Date.now();job.resultBytes=Buffer.byteLength(JSON.stringify(job.result));job.reviewBytes=Buffer.byteLength(JSON.stringify(review));return {sourceId:item.id,affectedNodeIds:[...affected],invalidatedCheckIds};
}
