import {createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';

const hash=value=>createHash('sha256').update(value).digest('hex');
function hashText(value){const digest=createHash('sha256');for(let offset=0;offset<value.length;){let end=Math.min(offset+65536,value.length);if(end<value.length&&value.charCodeAt(end-1)>=0xd800&&value.charCodeAt(end-1)<=0xdbff&&value.charCodeAt(end)>=0xdc00&&value.charCodeAt(end)<=0xdfff)end--;digest.update(value.slice(offset,end),'utf8');offset=end;}return digest.digest('hex');}
function sourceDigest(file){if(Buffer.isBuffer(file?.bytes))return hash(file.bytes);if(typeof file?.data!=='string')return null;const digest=createHash('sha256');for(let offset=0;offset<file.data.length;offset+=65536)digest.update(Buffer.from(file.data.slice(offset,offset+65536),'base64'));return digest.digest('hex');}
const validString=value=>typeof value==='string'&&value.length>0&&value.length<=200;

/** Build a deterministic, bounded page plan without retaining file bytes in the plan. */
export function buildTranslationPlan({documents=[],pageCounts=[],sourceBlocks=[],provider='unknown',model='unknown',contextVersion='',promptVersion='translation-request-v1',maxPagesPerSegment=5,maxBytesPerSegment=12*1024*1024,targetBlocksPerSegment=40}={}){
 if(!Array.isArray(documents)||documents.length<1||documents.length>10||!Array.isArray(pageCounts)||pageCounts.length!==documents.length||!Array.isArray(sourceBlocks)||sourceBlocks.length>5000||!validString(provider)||!validString(model)||!validString(promptVersion)||typeof contextVersion!=='string'||contextVersion.length>500)throw new Error('Übersetzungsplan ist ungültig.');
 if(!Number.isInteger(maxPagesPerSegment)||maxPagesPerSegment<1||maxPagesPerSegment>20||!Number.isInteger(maxBytesPerSegment)||maxBytesPerSegment<1024*1024||maxBytesPerSegment>64*1024*1024||!Number.isInteger(targetBlocksPerSegment)||targetBlocksPerSegment<1||targetBlocksPerSegment>1000)throw new Error('Abschnittsgrenzen sind ungültig.');
 const sourceInventoryFingerprint=hash(JSON.stringify(sourceBlocks.map(block=>({id:typeof block.id==='string'?block.id:'',fileIndex:block.fileIndex,page:block.page,kind:block.kind||block.type||'',label:typeof block.label==='string'?block.label:'',sourceHash:hash(typeof block.sourceText==='string'?block.sourceText:typeof block.source==='string'?block.source:'')}))));
 const sourceFingerprint=hash(JSON.stringify({documents:documents.map((file,index)=>({index,name:String(file.name||'').slice(0,200),type:String(file.type||'').slice(0,100),digest:hash(file.bytes||file.data||''),pages:pageCounts[index]})),sourceInventoryFingerprint}));
 const fileIds=documents.map((file,index)=>`doc-${hash(Buffer.isBuffer(file.bytes)?file.bytes:Buffer.from(file.data||'','base64')).slice(0,20)}-${index}`);
 const segments=[];
 for(let fileIndex=0;fileIndex<documents.length;fileIndex++){
  const pages=pageCounts[fileIndex],file=documents[fileIndex];if(!Number.isInteger(pages)||pages<1||pages>10000)throw new Error('Seitenzahl im Übersetzungsplan ist ungültig.');
  const byteLength=Buffer.isBuffer(file.bytes)?file.bytes.length:typeof file.data==='string'?Math.floor(file.data.length*3/4):0,estimatedPageBytes=Math.max(1,Math.ceil(byteLength/pages));
  const blocksPerPage=new Map();for(const block of sourceBlocks)if(block.fileIndex===fileIndex&&Number.isInteger(block.page)&&block.page>=1&&block.page<=pages)blocksPerPage.set(block.page,(blocksPerPage.get(block.page)||0)+1);
  let firstPage=1;
  while(firstPage<=pages){
   const bySize=Math.max(1,Math.floor(maxBytesPerSegment/estimatedPageBytes)),hardSpan=Math.min(maxPagesPerSegment,bySize,pages-firstPage+1);let span=0,blockCount=0;
   while(span<hardSpan){const nextPage=firstPage+span,nextCount=blocksPerPage.get(nextPage)||0;if(span>0&&blockCount+nextCount>targetBlocksPerSegment)break;span++;blockCount+=nextCount;}
   if(span===0)span=1;
   const lastPage=firstPage+span-1;
   const sourceBlockIds=sourceBlocks.filter(block=>block.fileIndex===fileIndex&&Number.isInteger(block.page)&&block.page>=firstPage&&block.page<=lastPage&&typeof block.id==='string').map(block=>block.id).slice(0,5000);
   const id=`seg-${hash(`${sourceFingerprint}:${fileIndex}:${firstPage}:${lastPage}`).slice(0,24)}`;
   const fingerprint=hash(JSON.stringify({id,sourceFingerprint,provider,model,promptVersion,contextVersion}));
   segments.push({id,fileIndex,sourcePageIds:Array.from({length:span},(_,index)=>`page-${hash(`${fileIds[fileIndex]}:${firstPage+index}`).slice(0,24)}`),pageRange:[firstPage,lastPage],sourceBlockIds,dependencies:segments.length?[segments.at(-1).id]:[],provider,model,promptVersion,contextVersion,fingerprint,status:'pending',attempts:[],resultRef:null,usageIds:[]});firstPage=lastPage+1;
   if(segments.length>200)throw new Error('Der Auftrag hat zu viele Übersetzungsabschnitte. Bitte Dokumente getrennt einreichen.');
  }
 }
 return {schema:1,version:1,sourceFingerprint,contextVersion,provider,model,promptVersion,createdAt:Date.now(),segments};
}

/** Retain source-page boundaries without storing a second copy of the translation. */
export function assembleTranslatedSegments(plan,pieces,documents,pageCounts){
 if(!Array.isArray(plan?.segments)||plan.segments.length<1||plan.segments.length>200||!Array.isArray(pieces)||pieces.length!==plan.segments.length||pieces.some(piece=>typeof piece!=='string')||!Array.isArray(documents)||!documents.length||documents.length>10||!Array.isArray(pageCounts)||pageCounts.length!==documents.length||documents.some(file=>!Buffer.isBuffer(file?.bytes)||typeof file.type!=='string'||!file.type||file.type.length>100)||pageCounts.some(count=>!Number.isInteger(count)||count<1||count>10000))throw new Error('Übersetzungsabschnitte können nicht zusammengesetzt werden.');
 const text=pieces.join('\n\n');let offset=0;
 const segments=plan.segments.map((segment,index)=>{const start=offset,end=start+pieces[index].length;offset=end+2;return {id:segment.id,fileIndex:segment.fileIndex,pageRange:[...segment.pageRange],sourcePageIds:[...segment.sourcePageIds],sourceBlockIds:[...segment.sourceBlockIds],start,end};});
 const sources=documents.map((file,index)=>({type:file.type,pages:pageCounts[index],digest:hash(file.bytes)})),translationSegments={schema:1,offsetEncoding:'utf16-code-unit',sourceFingerprint:plan.sourceFingerprint,textDigest:hashText(text),sources,segments};
 if(!translatedSegmentsMatch(translationSegments,text))throw new Error('Übersetzungsabschnitte stimmen nicht mit den Quelldateien überein.');
 return {text,translationSegments};
}

/** Reject stale or malformed boundaries before they can be used for a revision. */
export function translatedSegmentsMatch(value,text){
 if(typeof text!=='string'||value?.schema!==1||value.offsetEncoding!=='utf16-code-unit'||!/^[a-f0-9]{64}$/.test(value.sourceFingerprint||'')||value.textDigest!==hashText(text)||!Array.isArray(value.sources)||value.sources.length<1||value.sources.length>10||value.sources.some(source=>!source||typeof source.type!=='string'||!source.type||source.type.length>100||!Number.isInteger(source.pages)||source.pages<1||source.pages>10000||!/^[a-f0-9]{64}$/.test(source.digest||''))||!Array.isArray(value.segments)||value.segments.length<1||value.segments.length>200)return false;
 let offset=0,previousFile=-1,lastPage=0;const ids=new Set(),pageIds=new Set();
 for(const [index,segment] of value.segments.entries()){
  if(!segment||!/^seg-[a-f0-9]{24}$/.test(segment.id||'')||ids.has(segment.id)||!Number.isInteger(segment.fileIndex)||segment.fileIndex<0||segment.fileIndex>=value.sources.length||segment.fileIndex<previousFile||segment.fileIndex>previousFile+1||!Array.isArray(segment.pageRange)||segment.pageRange.length!==2||!Number.isInteger(segment.pageRange[0])||!Number.isInteger(segment.pageRange[1])||segment.pageRange[0]!== (segment.fileIndex===previousFile?lastPage+1:1)||segment.pageRange[1]<segment.pageRange[0]||segment.pageRange[1]>value.sources[segment.fileIndex].pages||!Array.isArray(segment.sourcePageIds)||segment.sourcePageIds.length!==segment.pageRange[1]-segment.pageRange[0]+1||segment.sourcePageIds.length>20||segment.sourcePageIds.some(id=>typeof id!=='string'||!/^page-[a-f0-9]{24}$/.test(id)||pageIds.has(id))||new Set(segment.sourcePageIds).size!==segment.sourcePageIds.length||!Array.isArray(segment.sourceBlockIds)||segment.sourceBlockIds.length>5000||segment.sourceBlockIds.some(id=>typeof id!=='string'||id.length>200)||segment.start!==offset||!Number.isInteger(segment.end)||segment.end<segment.start||segment.end>text.length)return false;
  if(segment.fileIndex!==previousFile&&previousFile>=0&&lastPage!==value.sources[previousFile].pages)return false;
  ids.add(segment.id);for(const id of segment.sourcePageIds)pageIds.add(id);previousFile=segment.fileIndex;lastPage=segment.pageRange[1];offset=segment.end;if(index<value.segments.length-1){if(text.slice(offset,offset+2)!=='\n\n')return false;offset+=2;}
 }
 return offset===text.length&&previousFile===value.sources.length-1&&lastPage===value.sources[previousFile].pages;
}

/** Confirm the working copies and their page counts before using stored ranges. */
export function translatedSegmentSourcesMatch(value,documents,pageCounts){
 return Array.isArray(value?.sources)&&value.sources.length>0&&value.sources.length<=10&&Array.isArray(documents)&&Array.isArray(pageCounts)&&documents.length===value.sources.length&&pageCounts.length===documents.length&&documents.every((file,index)=>file?.type===value.sources[index]?.type&&pageCounts[index]===value.sources[index]?.pages&&sourceDigest(file)===value.sources[index]?.digest);
}

export function beginTranslationSegment(plan,segmentId,usageId,now=Date.now()){
 const segment=plan?.segments?.find(item=>item.id===segmentId);if(!segment||typeof usageId!=='string'||!usageId||usageId.length>200)throw new Error('Übersetzungsabschnitt oder Verwendungs-ID fehlt.');
 if(segment.status==='complete')throw new Error('Der gespeicherte Abschnitt darf nicht erneut angefragt werden.');
 if(segment.status==='interrupted_unknown'&&segment.retryApproved!==true)throw new Error('Ein unterbrochener Anbieteraufruf braucht eine bewusste Wiederholungsfreigabe.');
 if((segment.dependencies||[]).some(id=>plan.segments.find(item=>item.id===id)?.status!=='complete'))throw new Error('Vorgelagerte Übersetzungsabschnitte sind noch nicht gespeichert.');
 segment.status='in_flight';segment.startedAt=now;delete segment.finishedAt;delete segment.retryApproved;delete segment.errorCode;segment.attempts.push({usageId,startedAt:now,status:'in_flight'});segment.attempts=segment.attempts.slice(-20);segment.usageIds=[...new Set([...segment.usageIds,usageId])].slice(-40);return segment;
}

export function rollbackTranslationSegmentStart(plan,segmentId){
 const segment=plan?.segments?.find(item=>item.id===segmentId);if(!segment||segment.status!=='in_flight')return segment||null;const attempt=segment.attempts.at(-1);if(attempt?.status==='in_flight'){segment.attempts.pop();segment.usageIds=segment.usageIds.filter(id=>id!==attempt.usageId);}segment.status='pending';delete segment.startedAt;return segment;
}

export function reuseTranslationSegment(plan,segmentId,resultRef,now=Date.now()){
 const segment=plan?.segments?.find(item=>item.id===segmentId);if(!segment||!validString(resultRef))throw new Error('Der gespeicherte Abschnitt kann nicht wiederverwendet werden.');segment.status='complete';segment.resultRef=resultRef;segment.finishedAt=now;delete segment.errorCode;delete segment.retryApproved;return segment;
}

export function resetTranslationSegmentAndDependents(plan,segmentId){
 const byId=new Map((plan?.segments||[]).map(segment=>[segment.id,segment])),resetIds=new Set([segmentId]);let changed=true;while(changed){changed=false;for(const segment of byId.values())if(!resetIds.has(segment.id)&&(segment.dependencies||[]).some(id=>resetIds.has(id))){resetIds.add(segment.id);changed=true;}}
 for(const id of resetIds){const segment=byId.get(id);if(!segment)continue;if(segment.status==='in_flight')throw new Error('Ein laufender Übersetzungsabschnitt kann nicht ersetzt werden.');segment.status='pending';segment.resultRef=null;delete segment.finishedAt;delete segment.errorCode;delete segment.retryApproved;}
 return [...resetIds];
}

/** Materialize only the original pages assigned to a segment for its provider request. */
export async function translationSegmentDocuments(plan,segmentId,documents=[]){
 const segment=plan?.segments?.find(item=>item.id===segmentId),file=documents[segment?.fileIndex];if(!segment||!file)throw new Error('Die Quelldatei des Übersetzungsabschnitts fehlt.');
 if(file.type!=='application/pdf')return [{...file,sourceFileIndex:segment.fileIndex,sourcePageStart:1}];
 const source=await PDFDocument.load(file.bytes),[first,last]=segment.pageRange;if(first<1||last>source.getPageCount())throw new Error('Der Seitenbereich des Übersetzungsabschnitts passt nicht zur Quelle.');
 const sliced=await PDFDocument.create();sliced.setTitle(`Foliquo source segment ${first}-${last}`);sliced.setCreationDate(new Date(0));sliced.setModificationDate(new Date(0));for(const page of await sliced.copyPages(source,Array.from({length:last-first+1},(_,index)=>first-1+index)))sliced.addPage(page);
 const name=String(file.name||`source-${segment.fileIndex+1}.pdf`).replace(/\.pdf$/iu,'');return [{...file,name:`${name}-pages-${first}-${last}.pdf`,originalName:file.originalName||file.name,bytes:Buffer.from(await sliced.save({updateMetadata:false})),sourceFileIndex:segment.fileIndex,sourcePageStart:first}];
}

export function completeTranslationSegment(plan,segmentId,{resultRef,usageId=null},now=Date.now()){
 const segment=plan?.segments?.find(item=>item.id===segmentId);if(!segment||segment.status!=='in_flight'||!validString(resultRef))throw new Error('Der Abschnitt kann nicht als gespeichert bestätigt werden.');
 segment.status='complete';segment.resultRef=resultRef;segment.finishedAt=now;const attempt=segment.attempts.at(-1);if(attempt){attempt.status='complete';attempt.finishedAt=now;}if(usageId)segment.usageIds=[...new Set([...segment.usageIds,usageId])].slice(-40);return segment;
}

export function markTranslationSegmentNeedsInput(plan,segmentId,{resultRef,usageId=null},now=Date.now()){
 const segment=plan?.segments?.find(item=>item.id===segmentId);if(!segment||!validString(resultRef)||!['in_flight','complete'].includes(segment.status))throw new Error('Der Abschnitt kann nicht auf eine Rückfrage warten.');
 segment.status='needs_input';segment.resultRef=resultRef;segment.finishedAt=now;const attempt=segment.attempts.at(-1);if(attempt&&['in_flight','unknown'].includes(attempt.status)){attempt.status='complete';attempt.finishedAt=now;}if(usageId)segment.usageIds=[...new Set([...segment.usageIds,usageId])].slice(-40);delete segment.retryApproved;return segment;
}

export function interruptTranslationSegment(plan,segmentId,now=Date.now()){
 const segment=plan?.segments?.find(item=>item.id===segmentId);if(!segment||segment.status!=='in_flight')return segment||null;segment.status='interrupted_unknown';segment.finishedAt=now;const attempt=segment.attempts.at(-1);if(attempt?.status==='in_flight'){attempt.status='unknown';attempt.finishedAt=now;}return segment;
}

export function failTranslationSegment(plan,segmentId,errorCode,now=Date.now()){
 const segment=plan?.segments?.find(item=>item.id===segmentId);if(!segment||segment.status!=='in_flight')throw new Error('Der Abschnitt kann nicht als fehlgeschlagen markiert werden.');
 segment.status='failed';segment.errorCode=typeof errorCode==='string'&&/^[A-Z0-9_]{1,80}$/.test(errorCode)?errorCode:'SEGMENT_FAILED';segment.finishedAt=now;const attempt=segment.attempts.at(-1);if(attempt?.status==='in_flight'){attempt.status='failed';attempt.finishedAt=now;}return segment;
}

export function approveTranslationSegmentRetry(plan,segmentId){const segment=plan?.segments?.find(item=>item.id===segmentId);if(!segment||segment.status!=='interrupted_unknown')throw new Error('Für diesen Abschnitt ist keine unklare Anfrage offen.');segment.retryApproved=true;segment.status='pending';return segment;}

export function translationPlanProgress(plan){const segments=plan?.segments||[],complete=segments.filter(segment=>segment.status==='complete').length,unknown=segments.filter(segment=>segment.status==='interrupted_unknown').length;return {total:segments.length,complete,pending:segments.filter(segment=>segment.status==='pending').length,inFlight:segments.filter(segment=>segment.status==='in_flight').length,needsInput:segments.filter(segment=>segment.status==='needs_input').length,unknown,failed:segments.filter(segment=>segment.status==='failed').length,percent:segments.length?Math.round(complete*100/segments.length):0};}
