import {createHash,randomUUID} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';

const activeStatuses=new Set(['queued','running','cancelling','awaiting_answers']);

function pagesLabel(pages){
 const ordered=[...pages].sort((a,b)=>a-b);let parts=[];
 for(let i=0;i<ordered.length;){let end=i;while(end+1<ordered.length&&ordered[end+1]===ordered[end]+1)end++;parts.push(end===i?String(ordered[i]):`${ordered[i]}-${ordered[end]}`);i=end+1;}
 return parts.join(',');
}

export function createImportBatch({owner,clientId,requestId,provider,model,metadata,files,groups,pageCounts,now=Date.now()}){
 if(typeof owner!=='string'||typeof clientId!=='string'||typeof requestId!=='string'||requestId.length<8||requestId.length>100||typeof provider!=='string'||typeof model!=='string')throw new Error('Ungültiger Stapelauftrag.');
 if(!Array.isArray(files)||files.length<1||files.length>10||!Array.isArray(groups)||groups.length<2||groups.length>10)throw new Error('Ein vorbereiteter Stapel braucht 1 bis 10 Dateien und 2 bis 10 Aufträge.');
 const totalBytes=files.reduce((sum,file)=>sum+(Buffer.isBuffer(file.bytes)?file.bytes.length:0),0);if(totalBytes>35*1024*1024)throw new Error('Ein Stapel darf insgesamt höchstens 35 MB groß sein.');
 const counts=files.map((file,index)=>pageCounts?.[index]??(file.type==='application/pdf'?null:1));
 if(counts.some((count,index)=>!Number.isInteger(count)||count<1||count>50&&files[index].type==='application/pdf'))throw new Error('Ungültige Seitenanzahl im Stapel.');
 const assigned=files.map(()=>new Set()),wholeFiles=new Set();
 const normalized=groups.map((group,index)=>{
  const rawItems=Array.isArray(group?.items)?group.items:Array.isArray(group?.fileIndexes)?group.fileIndexes.map(fileIndex=>({fileIndex,pages:null})):null;
  if(!rawItems||rawItems.length<1||rawItems.length>10)throw new Error('Jeder vorbereitete Auftrag braucht mindestens eine Datei oder einen PDF-Seitenbereich.');
  const groupFiles=new Set();
  const items=rawItems.map(raw=>{
   const fileIndex=raw?.fileIndex;
   if(!Number.isInteger(fileIndex)||fileIndex<0||fileIndex>=files.length)throw new Error('Ungültige Dateizuordnung im Stapel.');
   if(groupFiles.has(fileIndex))throw new Error('Eine Datei darf pro Auftrag nur einmal vorkommen.');groupFiles.add(fileIndex);
   const count=counts[fileIndex];if(raw.pages!==undefined&&raw.pages!==null&&!Array.isArray(raw.pages))throw new Error('Ungültiger PDF-Seitenbereich.');const pages=raw.pages===undefined||raw.pages===null?null:[...raw.pages];
   if(pages===null){
    if(assigned[fileIndex].size||wholeFiles.has(fileIndex))throw new Error('Eine Datei darf nur einem Auftrag zugeordnet werden.');
    wholeFiles.add(fileIndex);
    if(count!==null)for(let page=1;page<=count;page++)assigned[fileIndex].add(page);
   }else{
    if(files[fileIndex].type!=='application/pdf'||count===null)throw new Error('Seitenbereiche sind nur für PDF-Dateien möglich.');
    if(!pages.length||pages.length>count||pages.some(page=>!Number.isInteger(page)||page<1||page>count)||new Set(pages).size!==pages.length)throw new Error('Ungültiger PDF-Seitenbereich.');
    if(wholeFiles.has(fileIndex))throw new Error('Eine Datei darf nur einem Auftrag zugeordnet werden.');
    for(const page of pages){if(assigned[fileIndex].has(page))throw new Error('Eine PDF-Seite darf nur einem Auftrag zugeordnet werden.');assigned[fileIndex].add(page);}
   }
   return {fileIndex,pages};
  });
  const name=typeof group.name==='string'?group.name.trim().slice(0,100):'';
  return {index,name:name||`Auftrag ${index+1}`,items,fileIndexes:[...groupFiles],jobId:null};
 });
 for(let index=0;index<files.length;index++){
  if(counts[index]===null)throw new Error('PDF-Seiten müssen vor dem Stapelimport geprüft werden.');
  if(assigned[index].size!==counts[index])throw new Error('Bitte jede ausgewählte Datei und jede PDF-Seite genau einem Auftrag zuordnen.');
  for(let page=1;page<=counts[index];page++)if(!assigned[index].has(page))throw new Error('Bitte jede ausgewählte Datei und jede PDF-Seite genau einem Auftrag zuordnen.');
 }
 const requestHash=createHash('sha256').update(JSON.stringify({owner,clientId,provider,model,metadata,groups:normalized,files:files.map(file=>({name:file.name,type:file.type,hash:createHash('sha256').update(file.bytes).digest('hex')}))})).digest('hex');
 return {id:randomUUID(),owner,clientId,requestId,requestHash,provider,model,metadata:structuredClone(metadata||{}),sources:files.map(file=>({name:file.name,type:file.type,data:file.bytes.toString('base64')})),groups:normalized,nextGroup:0,stopped:false,createdAt:now,updatedAt:now};
}

export async function batchFiles(batch,group){
 const output=[];
 for(const item of group.items||group.fileIndexes.map(fileIndex=>({fileIndex,pages:null}))){
  const source=batch.sources[item.fileIndex];if(!source?.data)throw new Error('Eine noch nicht gestartete Datei ist nicht mehr verfügbar.');
  const bytes=Buffer.from(source.data,'base64');
  if(item.pages){
   const original=await PDFDocument.load(bytes),selected=await PDFDocument.create();
   for(const page of await selected.copyPages(original,item.pages.map(page=>page-1)))selected.addPage(page);
   const base=source.name.replace(/\.pdf$/i,'');output.push({name:`${base}-Seiten-${pagesLabel(item.pages)}.pdf`,type:'application/pdf',bytes:Buffer.from(await selected.save())});
  }else output.push({name:source.name,type:source.type,bytes});
 }
 return output;
}

export function batchSnapshot(batch,jobs=[]){
 const jobById=new Map(jobs.map(job=>[job.id,job]));
 const groups=batch.groups.map(group=>{const job=group.jobId?jobById.get(group.jobId):null;const items=group.items||group.fileIndexes.map(fileIndex=>({fileIndex,pages:null}));return {index:group.index,name:group.name,fileCount:items.length,names:items.map(item=>{const name=batch.sources[item.fileIndex]?.name||'Datei';return item.pages?`${name} · S. ${pagesLabel(item.pages)}`:name;}),jobId:group.jobId,status:job?.status||(group.index<batch.nextGroup?'queued':'prepared')};});
 return {id:batch.id,provider:batch.provider,model:batch.model,totalGroups:groups.length,createdGroups:groups.filter(group=>group.jobId).length,remainingGroups:groups.filter(group=>!group.jobId).length,stopped:batch.stopped,status:batch.stopped?'paused':batch.nextGroup===batch.groups.length?'submitted':'ready',groups};
}

export function batchForOwner(batches,id,owner){const batch=batches?.find(item=>item.id===id&&item.owner===owner);if(!batch)throw new Error('Stapel nicht gefunden.');return batch;}

export function availableBatchSlots(jobs,maxPending=8){return Math.max(0,maxPending-jobs.filter(job=>activeStatuses.has(job.status)).length);}

export function nextBatchGroup(batch){if(batch.stopped||batch.nextGroup>=batch.groups.length)return null;return batch.groups[batch.nextGroup]||null;}
