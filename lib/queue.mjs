import { randomUUID } from 'node:crypto';
import {diagnosticFor,readableError} from './diagnostics.mjs';
import {checkpointState} from './checkpoints.mjs';
const TERMINAL = new Set(['succeeded','failed','cancelled','expired']);
const MAX_MEMORY = 160 * 1024 * 1024;
function resolveAnswer(q,a){
 const unreadable=a?.unreadable===true;
 if(!a||!unreadable&&(typeof a.answer!=='string'||!a.answer.trim()||a.answer.length>4000))throw new Error('Bitte jede Rückfrage beantworten (maximal 4000 Zeichen je Antwort).');
 return {questionId:q.id,question:q.question,context:q.context,answer:unreadable?'Vom Benutzer bestätigt: Diese Stelle ist im Original unleserlich. An dieser Stelle einen entsprechenden Vermerk in der Zielsprache ausgeben.':a.answer.trim(),...(unreadable?{unreadable:true}:{}),fileIndex:q.fileIndex,page:q.page,box:q.box};
}
export class TranslationQueue {
 constructor(run,{now=()=>Date.now(),maxPending=8,onDiagnostic=()=>{},onChange=()=>{},onCheckpoint=async()=>{},retentionMs=3600000}={}){this.run=run;this.onChange=onChange;this.onCheckpoint=onCheckpoint;this.retentionMs=retentionMs;this.onDiagnostic=onDiagnostic;this.now=now;this.maxPending=maxPending;this.jobs=[];this.active=null;this.paused=false;this.pauseReason='';this.history=new Map();this.scheduled=false;}
 estimate(model,units=1){return Math.max(20,Math.min(600,(this.history.get(model)||18)*Math.max(1,units)+10));}
 get busy(){return Boolean(this.active)||this.jobs.some(j=>j.status==='queued');}
 get memory(){return this.jobs.reduce((sum,j)=>sum+(j.payload?.files.reduce((n,f)=>n+f.bytes.length,0)||0)+(j.clarificationDraft?.files?.reduce((n,f)=>n+f.bytes.length,0)||0)+(j.resultBytes||0)+(j.reviewBytes||0),0);}
 cleanup(){for(const j of this.jobs){if((TERMINAL.has(j.status)||j.status==='awaiting_answers')&&!j.review?.busy&&j.finishedAt&&this.now()-j.finishedAt>this.retentionMs){j.payload=null;j.result=null;j.resultBytes=0;j.review=null;j.reviewBytes=0;j.questions=[];j.clarificationDraft=null;j.status='expired';}}while(this.jobs.length>(this.retentionMs===3600000?30:1000)){const index=this.jobs.findIndex(j=>TERMINAL.has(j.status));if(index<0)break;this.jobs.splice(index,1);}this.trimMemory();}
 trimMemory(){while(this.memory>MAX_MEMORY){const j=this.jobs.find(j=>j!==this.active&&j.status==='succeeded'&&j.result&&!j.review?.busy);if(!j)break;j.result=null;j.resultBytes=0;j.review=null;j.reviewBytes=0;j.payload=null;j.status='expired';}}
 add({owner,clientId,requestId,payload}){
  this.cleanup();const existing=this.jobs.find(j=>j.owner===owner&&j.requestId===requestId);if(existing)return existing;
  if(this.jobs.filter(j=>['queued','running','cancelling','awaiting_answers'].includes(j.status)).length>=this.maxPending)throw new Error(`Maximal ${this.maxPending} laufende oder wartende Aufträge. Bitte zuerst einen Auftrag abschließen.`);
  const incoming=payload.files.reduce((sum,f)=>sum+f.bytes.length,0);if(this.memory+incoming>MAX_MEMORY)throw new Error('Die Warteschlange ist zu groß. Bitte zuerst fertige Ergebnisse herunterladen und entfernen.');
  const units=Math.max(payload.files.length,Math.ceil(incoming/(1024*1024)));
  const job={id:randomUUID(),owner,clientId,requestId,payload,provider:payload.provider||'chatgpt',stage:'queued',status:'queued',createdAt:this.now(),startedAt:null,finishedAt:null,stageStartedAt:null,units,estimatedSeconds:this.estimate(payload.model,units),model:payload.model,targetLanguage:payload.metadata.targetLanguage||'Deutsch',names:payload.files.map(f=>f.name),characters:0,error:null,result:null,questions:[],clarificationRound:0,diagnostic:null,retryAfterAt:null,budgetConsentRequired:false,events:[{time:new Date(this.now()).toISOString(),stage:'queued'}]};
  this.jobs.push(job);this.onChange();this.schedule();return job;
 }
 schedule(){if(this.scheduled)return;this.scheduled=true;queueMicrotask(()=>{this.scheduled=false;void this.pump();});}
 async pump(){
  if(this.active||this.paused)return;const j=this.jobs.find(j=>j.status==='queued');if(!j)return;
  this.active=j;j.status='running';j.stage='preparing';j.startedAt=this.now();j.stageStartedAt=this.now();j.controller=new AbortController();j.events.push({time:new Date(this.now()).toISOString(),stage:'preparing'});
  try{
   const checkpoint=async()=>{const current=checkpointState(j.payload);if(current)j.lastCheckpoint=current;await this.onCheckpoint(j);};
   await checkpoint();
   const result=await this.run(j.payload,j.controller.signal,(stage,details={})=>{
    if(j.status==='cancelling')return;
    if(stage!==j.stage){j.events.push({time:new Date(this.now()).toISOString(),stage});j.events=j.events.slice(-25);j.stage=stage;j.stageStartedAt=this.now();}
    if(details.units){j.units=details.units;j.estimatedSeconds=this.estimate(j.model,j.units);}
    if(details.characters)j.characters=details.characters;
   },checkpoint,j.owner);
   if(j.controller.signal.aborted)throw new DOMException('Abgebrochen','AbortError');
   if(result.requiresInput){j.status='awaiting_answers';j.stage='questions';j.events.push({time:new Date(this.now()).toISOString(),stage:'questions'});j.questions=result.questions.map(q=>({...q,id:typeof q.id==='string'&&/^q-[a-f0-9]{24}$/.test(q.id)?q.id:randomUUID()}));j.detected=result.detected;return;}
   j.questions=[];j.result=result;j.resultBytes=Buffer.byteLength(JSON.stringify(result));j.status='succeeded';j.stage='done';j.events.push({time:new Date(this.now()).toISOString(),stage:'done'});j.payload=null;
   const seconds=Math.max(1,(this.now()-j.startedAt)/1000),sample=seconds/Math.max(1,j.units),previous=this.history.get(j.model);
   this.history.set(j.model,previous?previous*.7+sample*.3:sample);
  }catch(error){
   if(j.controller.signal.aborted){j.status='cancelled';j.error=null;j.payload=null;}
   else{j.status='failed';j.diagnostic=diagnosticFor(error,{stage:j.stage,jobId:j.id,model:j.model,fileCount:j.names.length});j.error=readableError(error,j.diagnostic);j.budgetConsentRequired=error.code==='BUDGET_UNKNOWN_ESTIMATE';if(Number.isFinite(error.retryAfterMs)&&error.retryAfterMs>0){j.retryAfterAt=this.now()+Math.min(86400000,error.retryAfterMs);j.error+=` Bitte erst nach ${new Date(j.retryAfterAt).toLocaleTimeString()} erneut versuchen.`;}j.events.push({time:new Date(this.now()).toISOString(),stage:'failed',diagnosticId:j.diagnostic.id});this.onDiagnostic(j.diagnostic);if(error.pauseQueue){this.paused=true;this.pauseReason=j.error;}}
  }finally{j.finishedAt=this.now();j.controller=null;this.active=null;this.trimMemory();this.onChange();this.schedule();}
 }
 find(id,owner){const j=this.jobs.find(j=>j.id===id&&j.owner===owner);if(!j)throw new Error('Auftrag nicht gefunden.');return j;}
 cancel(id,owner){const j=this.find(id,owner);if(['queued','awaiting_answers'].includes(j.status)){j.questions=[];j.clarificationDraft=null;j.status='cancelled';j.finishedAt=this.now();j.payload=null;}else if(j.status==='running'){j.status='cancelling';j.controller.abort();}return j;}
 retry(id,owner){const j=this.find(id,owner);if(j.status!=='failed'||!j.payload)throw new Error('Dieser Auftrag kann nicht erneut gestartet werden. Bitte die Dateien nochmals hinzufügen.');if(j.retryAfterAt&&this.now()<j.retryAfterAt)throw new Error(`Der Anbieter bittet bis ${new Date(j.retryAfterAt).toLocaleTimeString()} zu warten.`);if(this.jobs.filter(j=>['queued','running','cancelling','awaiting_answers'].includes(j.status)).length>=this.maxPending)throw new Error('Die Warteschlange ist voll.');j.status='queued';j.stage='queued';j.diagnostic=null;j.events.push({time:new Date(this.now()).toISOString(),stage:'queued'});j.error=null;j.interrupted=false;j.retryAfterAt=null;j.budgetConsentRequired=false;j.startedAt=null;j.finishedAt=null;j.characters=0;j.result=null;this.jobs.splice(this.jobs.indexOf(j),1);this.jobs.push(j);this.schedule();return j;}
 saveClarificationDraft(id,owner,answers,files){
  const j=this.find(id,owner);if(j.status!=='awaiting_answers'||!j.payload)throw new Error('Dieser Auftrag wartet nicht auf Antworten.');
  if(!Array.isArray(answers)||answers.length>100||answers.some(a=>!a||typeof a.id!=='string'||typeof a.answer!=='string'||a.answer.length>4000))throw new Error('Ungültiger Antwortentwurf.');
  const accepted=answers.filter(a=>j.questions.some(q=>q.id===a.id)).map(a=>({id:a.id,answer:a.answer}));
  if(JSON.stringify(accepted).length>30000)throw new Error('Die Antworten sind zu umfangreich. Bitte kürzer formulieren.');
  const previous=j.clarificationDraft?.files||[],incoming=files===undefined?previous:files;
  if(this.memory-previous.reduce((n,f)=>n+f.bytes.length,0)+incoming.reduce((n,f)=>n+f.bytes.length,0)>MAX_MEMORY)throw new Error('Zu viele Dokumente im Speicher.');
  j.clarificationDraft={answers:accepted,files:incoming};this.onChange();return j;
 }
 answer(id,owner,answers){
  const j=this.find(id,owner);if(j.status!=='awaiting_answers'||!j.payload)throw new Error('Dieser Auftrag wartet nicht auf Antworten.');
  if(!Array.isArray(answers)||answers.length!==j.questions.length||new Set(answers.map(a=>a?.id)).size!==j.questions.length)throw new Error('Bitte jede Rückfrage beantworten.');
  const resolved=j.questions.map(q=>resolveAnswer(q,answers.find(a=>a?.id===q.id)));
  if(j.clarificationRound>=8&&!resolved.every(answer=>answer.unreadable))throw new Error('Bitte die geklärten Angaben als Zusatzinfos in einem neuen Auftrag übergeben.');
  const history=[...(j.payload.metadata.clarifications||[]),...resolved];if(JSON.stringify(history).length>30000)throw new Error('Die Antworten sind zu umfangreich. Bitte kürzer formulieren.');
  j.payload.metadata.clarifications=history;return this.continueAnswered(j);
 }
 confirmUnreadable(id,owner,questionId){return this.confirmAnswer(id,owner,questionId,{unreadable:true});}
 confirmAnswer(id,owner,questionId,input){
  const j=this.find(id,owner);
  if(j.resolvedQuestionIds?.includes(questionId)||j.payload?.metadata.clarifications?.some(a=>a.questionId===questionId))return j;
  if(j.status!=='awaiting_answers'||!j.payload)throw new Error('Dieser Auftrag wartet nicht auf Antworten.');
  const question=j.questions.find(q=>q.id===questionId);if(!question)throw new Error('Diese Rückfrage ist nicht mehr offen.');
  if(j.clarificationRound>=8&&!input?.unreadable)throw new Error('Bitte die geklärten Angaben als Zusatzinfos in einem neuen Auftrag übergeben.');
  const history=[...(j.payload.metadata.clarifications||[]),resolveAnswer(question,input)];if(JSON.stringify(history).length>30000)throw new Error('Die Antworten sind zu umfangreich. Bitte kürzer formulieren.');
  j.payload.metadata.clarifications=history;j.resolvedQuestionIds=[...(j.resolvedQuestionIds||[]),questionId].slice(-1000);j.questions=j.questions.filter(q=>q.id!==questionId);
  if(j.clarificationDraft)j.clarificationDraft.answers=j.clarificationDraft.answers.filter(a=>a.id!==questionId);
  if(!j.questions.length)return this.continueAnswered(j);
  this.onChange();return j;
 }
 continueAnswered(j){if(j.clarificationDraft?.files?.length){j.payload.files.push(...j.clarificationDraft.files);j.names=j.payload.files.map(f=>f.name);delete j.payload.sourceExtraction;}j.clarificationDraft=null;j.clarificationRound++;j.questions=[];j.status='queued';j.stage='queued';j.diagnostic=null;j.events.push({time:new Date(this.now()).toISOString(),stage:'queued'});j.error=null;j.startedAt=null;j.finishedAt=null;j.characters=0;this.jobs.splice(this.jobs.indexOf(j),1);this.jobs.push(j);this.schedule();return j;}
 remove(id,owner){const j=this.find(id,owner);if(j.review?.busy)throw new Error('Bitte die laufende Bearbeitung zuerst abschließen.');if(!TERMINAL.has(j.status))throw new Error('Bitte den Auftrag zuerst abbrechen.');this.jobs.splice(this.jobs.indexOf(j),1);}
 pause(){this.paused=true;this.pauseReason='';}
 resume(){this.paused=false;this.pauseReason='';this.schedule();}
 snapshot(owner){
  this.cleanup();let wait=0;
  const visible=this.jobs.filter(j=>j.owner===owner);
  const entries=this.jobs.map(j=>{
   const elapsed=j.startedAt!==null?Math.max(0,((j.finishedAt??this.now())-j.startedAt)/1000):0;
   let remaining=null,progress=0;
   if(j.status==='succeeded'){progress=100;remaining=0;}
   else if(['running','cancelling'].includes(j.status)){
    remaining=elapsed<j.estimatedSeconds?Math.max(1,Math.ceil(j.estimatedSeconds-elapsed)):null;
    const stageSeconds=Math.max(0,(this.now()-j.stageStartedAt)/1000);
    progress=j.stage==='preparing'?Math.min(18,3+stageSeconds*1.2):j.stage==='translating'?Math.min(91,20+71*(1-Math.exp(-stageSeconds/Math.max(12,j.estimatedSeconds*.65)))):Math.min(99,94+stageSeconds*.5);
    wait+=remaining??Math.max(20,j.estimatedSeconds*.25);
   }
   let waitSeconds=0,position=0;
   if(j.status==='queued'){position=this.jobs.filter(x=>x.status==='queued'&&this.jobs.indexOf(x)<=this.jobs.indexOf(j)).length;waitSeconds=Math.ceil(wait);wait+=j.estimatedSeconds;}
   return {id:j.id,clientId:j.clientId,requestId:j.requestId,provider:j.provider||j.payload?.provider||'chatgpt',names:j.names,status:j.status,stage:j.stage,targetLanguage:j.targetLanguage,model:j.model,createdAt:j.createdAt,startedAt:j.startedAt,finishedAt:j.finishedAt,elapsedSeconds:Math.floor(elapsed),estimatedSeconds:Math.round(j.estimatedSeconds),remainingSeconds:remaining,waitSeconds:this.paused?null:waitSeconds,position,progress:Math.round(progress),characters:j.characters,revision:j.review?.version||1,error:j.error,interrupted:j.interrupted===true,retryAfterAt:j.retryAfterAt||null,budgetConsentRequired:j.budgetConsentRequired===true,checkpoint:j.lastCheckpoint||checkpointState(j.payload),diagnostic:j.diagnostic,events:j.events,questions:j.status==='awaiting_answers'?j.questions:[],clarificationDraft:j.status==='awaiting_answers'?{answers:j.clarificationDraft?.answers||[],files:(j.clarificationDraft?.files||[]).map(f=>({name:f.name,type:f.type}))}:null,clarificationRound:j.clarificationRound,detected:j.result?.detected||j.detected||null,hasResult:Boolean(j.result)};
  });
  return {paused:this.paused,pauseReason:this.pauseReason,jobs:entries.filter(j=>visible.some(v=>v.id===j.id)),activeId:this.active?.owner===owner?this.active.id:null};
 }
}
