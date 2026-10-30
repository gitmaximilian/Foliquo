import {createHash} from 'node:crypto';

const hash=value=>createHash('sha256').update(value).digest('hex');
const clean=value=>String(value||'').normalize('NFKC').replace(/[\s\u200e\u200f]+/gu,' ').trim().toLocaleLowerCase();
const boundedBox=value=>Array.isArray(value)&&value.length===4&&value.every(Number.isFinite)?value:null;

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
export function buildSourceInventory({files=[],pageCounts=[],fields=[],regions=[],document=null}={}){
 if(!Array.isArray(files)||files.length>10||!Array.isArray(pageCounts)||!Array.isArray(fields)||!Array.isArray(regions))throw new Error('Quellinventar ist ungültig.');
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
  items.push({id,documentId:fileIds[fileIndex],pageId:pageId(fileIndex,pageNum),kind,label:String(label||kind).slice(0,150),fileIndex,page:pageNum,box:boundedBox(entry.box),extractionMethod:entry.extractionMethod==='local-ocr'?'local-ocr':'model',sourceText:String(sourceText||'').slice(0,2000),targetText:String(targetText||'').slice(0,2000),coverageStatus:targets.length?'mapped':'unreviewed',targetNodeIds:targets,review:null});
 };
 for(const field of fields)add('other',field,field.source,field.translated,field.label);
 for(const region of regions)add(region.kind||'other',region,region.source,region.translated,region.label);
 return {schema:1,items,summary:sourceCoverage(items)};
}

export function sourceCoverage(items=[]){
 const total=items.length,reviewed=items.filter(item=>item.coverageStatus==='mapped'||item.coverageStatus==='unreadable-confirmed'||item.coverageStatus==='excluded-reviewed').length;
 const mapped=items.filter(item=>item.coverageStatus==='mapped').length;
 return {total,reviewed,mapped,open:total-reviewed,percent:total?Math.round(reviewed*100/total):0,label:'zugeordnete/geprüfte Quellbereiche'};
}
