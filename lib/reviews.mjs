import {protectionConflicts} from './protection.mjs';
import {proposeRevision,rememberVersion} from './revisions.mjs';
import {diagnosticFor,readableError} from './diagnostics.mjs';
function sourceInventorySnapshot(value){if(!value)return null;return {schema:value.schema,truncated:value.truncated===true,summary:value.summary,items:(value.items||[]).map(({sourceText,targetText,...item})=>item)};}
// Reviews live with their owning job and expire with its documents; no browser storage.
export function reviewState(job){
 if(job.status!=='succeeded'||!job.result)throw new Error('Die Übersetzung ist noch nicht fertig oder nicht mehr verfügbar.');
 if(!job.review)job.review={version:1,busy:false,hasQuestions:false,messages:[{role:'assistant',text:'Deine Übersetzung ist bereit. Beschreibe deine Änderungen hier. Ich aktualisiere die Vorschau; du lädst die finale Fassung herunter, wenn du zufrieden bist.'}],requests:[],error:null,diagnostic:null,finalizedVersion:null};
 return job.review;
}
export function reviewSnapshot(job){const r=reviewState(job);return {jobId:job.id,version:r.version,busy:r.busy,hasQuestions:r.hasQuestions,fieldQuestion:r.fieldQuestion||null,messages:r.messages,error:r.error,diagnostic:r.diagnostic,finalizedVersion:r.finalizedVersion,learningOffer:job.learningOffer||null,styleReferences:job.result.context?.appliedLearning||[],checks:job.result.checks||[],protectedFields:job.protectedFields||[],regions:job.result.regions||[],references:job.result.references||[],sourceInventory:sourceInventorySnapshot(job.result.sourceInventory),preflight:job.result.preflight||null,dossierId:job.result.context?.dossierId||null,fields:job.result.fields||[],practice:job.practice||null,versions:(r.versions||[]).map(({text,checks,fields,context,detected,regions,references,...v})=>v),proposal:r.proposal?{changes:r.proposal.changes,createdAt:r.proposal.createdAt,protectedConflicts:protectionConflicts(job,r.proposal.result)}:null};}
export async function applyReview(job,{prompt,version,requestId,staged=false},revise,build,onDiagnostic=()=>{}){
 const r=reviewState(job);
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>4000||!Number.isInteger(version)||typeof requestId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(requestId))throw new Error('Bitte eine Änderung mit maximal 4000 Zeichen eingeben.');
 if(r.requests.includes(requestId))return reviewSnapshot(job);
 if(r.proposal)throw new Error('Bitte zuerst den Änderungsvorschlag übernehmen oder verwerfen.');
 if(r.busy)throw new Error('Für diesen Auftrag wird bereits eine Änderung bearbeitet.');
 if(version!==r.version)throw new Error('Die Vorschau wurde inzwischen aktualisiert. Bitte den Chat neu öffnen.');
 r.requests.push(requestId);r.requests=r.requests.slice(-20);r.busy=true;r.error=null;r.diagnostic=null;r.messages.push({role:'user',text:prompt.trim()});r.messages=r.messages.slice(-30);
 try{
  const update=await revise(job,r.messages);
  if(update.requiresInput){r.hasQuestions=true;r.messages.push({role:'assistant',text:update.questions.map(q=>`${q.question}${q.context?'\n'+q.context:''}`).join('\n\n')});}
  else {const result=await build(update,job.result); // Commit only when both exports exist.
  if(!result.pdf||!result.word)throw new Error('Die neue Fassung konnte nicht vollständig erstellt werden.');
  if(staged){proposeRevision(job,result);}else{rememberVersion(job);job.result=result;job.resultBytes=Buffer.byteLength(JSON.stringify(result));r.version++;r.hasQuestions=false;r.finalizedVersion=null;r.messages.push({role:'assistant',text:'Änderung übernommen. Die Vorschau zeigt die neue Fassung. Du kannst weitere Änderungen anfordern oder die finalen Dateien herunterladen.'});rememberVersion(job);}}
 }catch(error){r.diagnostic=diagnosticFor(error,{stage:'review',jobId:job.id,model:job.model});r.error=readableError(error,r.diagnostic);r.messages.push({role:'assistant',text:'Die Änderung konnte nicht übernommen werden. Die bisherige Fassung bleibt erhalten. '+r.error});onDiagnostic(r.diagnostic);
 }finally{r.busy=false;job.finishedAt=Date.now();job.reviewBytes=Buffer.byteLength(JSON.stringify(r));}
 return reviewSnapshot(job);
}
export function finalReview(job,version){const r=reviewState(job);if(version!==r.version)throw new Error('Bitte die aktuelle Vorschau laden, bevor du final herunterlädst.');r.finalizedVersion=r.version;job.finishedAt=Date.now();return job.result;}
