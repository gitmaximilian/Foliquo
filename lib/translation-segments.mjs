import {createHash} from 'node:crypto';

const hash=value=>createHash('sha256').update(value).digest('hex');
const validString=value=>typeof value==='string'&&value.length>0&&value.length<=200;

/** Build a deterministic, bounded page plan without retaining file bytes in the plan. */
export function buildTranslationPlan({documents=[],pageCounts=[],sourceBlocks=[],provider='unknown',model='unknown',contextVersion='',promptVersion='translation-request-v1',maxPagesPerSegment=5,maxBytesPerSegment=12*1024*1024}={}){
 if(!Array.isArray(documents)||documents.length<1||documents.length>10||!Array.isArray(pageCounts)||pageCounts.length!==documents.length||!Array.isArray(sourceBlocks)||sourceBlocks.length>5000||!validString(provider)||!validString(model)||!validString(promptVersion)||typeof contextVersion!=='string'||contextVersion.length>500)throw new Error('Übersetzungsplan ist ungültig.');
 if(!Number.isInteger(maxPagesPerSegment)||maxPagesPerSegment<1||maxPagesPerSegment>20||!Number.isInteger(maxBytesPerSegment)||maxBytesPerSegment<1024*1024||maxBytesPerSegment>64*1024*1024)throw new Error('Abschnittsgrenzen sind ungültig.');
 const sourceFingerprint=hash(JSON.stringify(documents.map((file,index)=>({index,name:String(file.name||'').slice(0,200),type:String(file.type||'').slice(0,100),digest:hash(file.bytes||file.data||''),pages:pageCounts[index]}))));
 const fileIds=documents.map((file,index)=>`doc-${hash(Buffer.isBuffer(file.bytes)?file.bytes:Buffer.from(file.data||'','base64')).slice(0,20)}-${index}`);
 const segments=[];
 for(let fileIndex=0;fileIndex<documents.length;fileIndex++){
  const pages=pageCounts[fileIndex],file=documents[fileIndex];if(!Number.isInteger(pages)||pages<1||pages>10000)throw new Error('Seitenzahl im Übersetzungsplan ist ungültig.');
  const byteLength=Buffer.isBuffer(file.bytes)?file.bytes.length:typeof file.data==='string'?Math.floor(file.data.length*3/4):0,estimatedPageBytes=Math.max(1,Math.ceil(byteLength/pages));
  let firstPage=1;
  while(firstPage<=pages){
   const bySize=Math.max(1,Math.floor(maxBytesPerSegment/estimatedPageBytes)),span=Math.min(maxPagesPerSegment,bySize,pages-firstPage+1),lastPage=firstPage+span-1;
   const sourceBlockIds=sourceBlocks.filter(block=>block.fileIndex===fileIndex&&Number.isInteger(block.page)&&block.page>=firstPage&&block.page<=lastPage&&typeof block.id==='string').map(block=>block.id).slice(0,5000);
   const id=`seg-${hash(`${sourceFingerprint}:${fileIndex}:${firstPage}:${lastPage}`).slice(0,24)}`;
   const fingerprint=hash(JSON.stringify({id,sourceFingerprint,provider,model,promptVersion,contextVersion}));
   segments.push({id,fileIndex,sourcePageIds:Array.from({length:span},(_,index)=>`page-${hash(`${fileIds[fileIndex]}:${firstPage+index}`).slice(0,24)}`),pageRange:[firstPage,lastPage],sourceBlockIds,dependencies:segments.length?[segments.at(-1).id]:[],provider,model,promptVersion,contextVersion,fingerprint,status:'pending',attempts:[],resultRef:null,usageIds:[]});firstPage=lastPage+1;
   if(segments.length>200)throw new Error('Der Auftrag hat zu viele Übersetzungsabschnitte. Bitte Dokumente getrennt einreichen.');
  }
 }
 return {schema:1,version:1,sourceFingerprint,contextVersion,provider,model,promptVersion,createdAt:Date.now(),segments};
}

export function beginTranslationSegment(plan,segmentId,usageId,now=Date.now()){
 const segment=plan?.segments?.find(item=>item.id===segmentId);if(!segment||typeof usageId!=='string'||!usageId||usageId.length>200)throw new Error('Übersetzungsabschnitt oder Verwendungs-ID fehlt.');
 if(segment.status==='complete')throw new Error('Der gespeicherte Abschnitt darf nicht erneut angefragt werden.');
 if(segment.status==='interrupted_unknown'&&segment.retryApproved!==true)throw new Error('Ein unterbrochener Anbieteraufruf braucht eine bewusste Wiederholungsfreigabe.');
 if((segment.dependencies||[]).some(id=>plan.segments.find(item=>item.id===id)?.status!=='complete'))throw new Error('Vorgelagerte Übersetzungsabschnitte sind noch nicht gespeichert.');
 segment.status='in_flight';segment.startedAt=now;delete segment.finishedAt;delete segment.retryApproved;segment.attempts.push({usageId,startedAt:now,status:'in_flight'});segment.attempts=segment.attempts.slice(-20);segment.usageIds=[...new Set([...segment.usageIds,usageId])].slice(-40);return segment;
}

export function completeTranslationSegment(plan,segmentId,{resultRef,usageId=null},now=Date.now()){
 const segment=plan?.segments?.find(item=>item.id===segmentId);if(!segment||segment.status!=='in_flight'||!validString(resultRef))throw new Error('Der Abschnitt kann nicht als gespeichert bestätigt werden.');
 segment.status='complete';segment.resultRef=resultRef;segment.finishedAt=now;const attempt=segment.attempts.at(-1);if(attempt){attempt.status='complete';attempt.finishedAt=now;}if(usageId)segment.usageIds=[...new Set([...segment.usageIds,usageId])].slice(-40);return segment;
}

export function interruptTranslationSegment(plan,segmentId,now=Date.now()){
 const segment=plan?.segments?.find(item=>item.id===segmentId);if(!segment||segment.status!=='in_flight')return segment||null;segment.status='interrupted_unknown';segment.finishedAt=now;const attempt=segment.attempts.at(-1);if(attempt?.status==='in_flight'){attempt.status='unknown';attempt.finishedAt=now;}return segment;
}

export function failTranslationSegment(plan,segmentId,errorCode,now=Date.now()){
 const segment=plan?.segments?.find(item=>item.id===segmentId);if(!segment||segment.status!=='in_flight')throw new Error('Der Abschnitt kann nicht als fehlgeschlagen markiert werden.');
 segment.status='failed';segment.errorCode=typeof errorCode==='string'&&/^[A-Z0-9_]{1,80}$/.test(errorCode)?errorCode:'SEGMENT_FAILED';segment.finishedAt=now;const attempt=segment.attempts.at(-1);if(attempt?.status==='in_flight'){attempt.status='failed';attempt.finishedAt=now;}return segment;
}

export function approveTranslationSegmentRetry(plan,segmentId){const segment=plan?.segments?.find(item=>item.id===segmentId);if(!segment||segment.status!=='interrupted_unknown')throw new Error('Für diesen Abschnitt ist keine unklare Anfrage offen.');segment.retryApproved=true;segment.status='pending';return segment;}

export function translationPlanProgress(plan){const segments=plan?.segments||[],complete=segments.filter(segment=>segment.status==='complete').length,unknown=segments.filter(segment=>segment.status==='interrupted_unknown').length;return {total:segments.length,complete,pending:segments.filter(segment=>segment.status==='pending').length,inFlight:segments.filter(segment=>segment.status==='in_flight').length,unknown,failed:segments.filter(segment=>segment.status==='failed').length,percent:segments.length?Math.round(complete*100/segments.length):0};}
