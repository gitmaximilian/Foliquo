import {createHash,randomUUID} from 'node:crypto';
import {approveTranslationSegmentRetry,interruptTranslationSegment,markTranslationSegmentNeedsInput,translatedSegmentSourcesMatch,translatedSegmentsMatch} from './translation-segments.mjs';
import {interruptCheckpoint} from './checkpoints.mjs';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const shortString=(value,limit)=>typeof value==='string'&&value.length>0&&value.length<=limit;

/** Freeze the inputs for one deliberate, resumable review request. */
export function createRevisionTask({jobId,version,provider,model,contextVersion='',messages,translationSegments,text,documents,pageCounts}){
 if(!shortString(jobId,100)||!Number.isInteger(version)||version<1||!shortString(provider,40)||!shortString(model,200)||typeof contextVersion!=='string'||contextVersion.length>500||!Array.isArray(messages)||messages.length<1||messages.length>30||messages.some(message=>!message||!['user','assistant'].includes(message.role)||!shortString(message.text,30000))||!translatedSegmentsMatch(translationSegments,text)||!translatedSegmentSourcesMatch(translationSegments,documents,pageCounts))throw new Error('Der Änderungsauftrag passt nicht zur aktuellen Übersetzung oder Quelle.');
 const map=structuredClone(translationSegments),history=messages.map(({role,text})=>({role,text})),binding=digest({jobId,version,provider,model,contextVersion,history,map});
 const segments=map.segments.map((segment,index)=>({...segment,dependencies:index?[map.segments[index-1].id]:[],provider,model,contextVersion,promptVersion:'revision-segment-v1',fingerprint:digest({binding,id:segment.id}),status:'pending',attempts:[],usageIds:[],resultRef:null,round:0,answers:[]}));
 return {schema:1,id:randomUUID(),jobId,version,provider,model,contextVersion,sourceFingerprint:map.sourceFingerprint,binding,map,history,status:'pending',segments,checkpoints:{},createdAt:Date.now(),pendingQuestions:[]};
}

/** Validate the stored plan against the current result before any provider call. */
export function revisionTaskMatches(task,{jobId,version,provider,model,contextVersion='',translationSegments,text,documents,pageCounts}){
 if(!(task?.schema===1&&task.jobId===jobId&&task.version===version&&task.provider===provider&&task.model===model&&task.contextVersion===contextVersion&&task.sourceFingerprint===translationSegments?.sourceFingerprint&&['pending','running','interrupted','needs_input','complete','failed'].includes(task.status)&&Array.isArray(task.history)&&task.history.length>0&&task.history.length<=30&&task.history.every(message=>message&&['user','assistant'].includes(message.role)&&shortString(message.text,30000))&&task.map&&task.checkpoints&&typeof task.checkpoints==='object'&&!Array.isArray(task.checkpoints)&&translatedSegmentsMatch(translationSegments,text)&&translatedSegmentSourcesMatch(translationSegments,documents,pageCounts)&&task.binding===digest({jobId,version,provider,model,contextVersion,history:task.history,map:translationSegments})&&digest(task.map)===digest(translationSegments)&&Array.isArray(task.segments)&&task.segments.length===translationSegments.segments.length))return false;
 return task.segments.every((segment,index)=>{const original=translationSegments.segments[index],expectedDependencies=index?[translationSegments.segments[index-1].id]:[];return segment?.id===original.id&&segment.fileIndex===original.fileIndex&&segment.start===original.start&&segment.end===original.end&&JSON.stringify(segment.pageRange)===JSON.stringify(original.pageRange)&&JSON.stringify(segment.sourcePageIds)===JSON.stringify(original.sourcePageIds)&&JSON.stringify(segment.sourceBlockIds)===JSON.stringify(original.sourceBlockIds)&&JSON.stringify(segment.dependencies)===JSON.stringify(expectedDependencies)&&segment.provider===provider&&segment.model===model&&segment.contextVersion===contextVersion&&segment.promptVersion==='revision-segment-v1'&&segment.fingerprint===digest({binding:task.binding,id:original.id})&&['pending','in_flight','complete','needs_input','interrupted_unknown','failed'].includes(segment.status)&&Array.isArray(segment.attempts)&&Array.isArray(segment.usageIds)&&Number.isInteger(segment.round)&&segment.round>=0&&segment.round<=8&&Array.isArray(segment.answers)&&segment.answers.length===segment.round*2&&segment.answers.every((message,index)=>message?.role===(index%2?'user':'assistant')&&shortString(message.text,index%2?4000:600000));});
}

/** Treat an in-flight request after process exit as possibly billed. */
export function interruptRevisionTask(task){
 const usageIds=new Set();let hadInFlight=false;for(const segment of task?.segments||[])if(segment.status==='in_flight'){hadInFlight=true;const phase=`revision-${segment.id}-${segment.round}`,checkpoint=task.checkpoints?.[phase];if(checkpoint?.status==='complete'){segment.status='pending';const attempt=segment.attempts?.at(-1);if(attempt?.status==='in_flight'){attempt.status='complete';attempt.finishedAt=checkpoint.finishedAt||Date.now();}}else{interruptTranslationSegment(task,segment.id);const attempt=segment.attempts?.at(-1);if(attempt?.status==='unknown')usageIds.add(attempt.usageId);}}
 for(const [phase,checkpoint] of Object.entries(task?.checkpoints||{}))if(checkpoint.status==='in_flight'){hadInFlight=true;interruptCheckpoint(task,phase,checkpoint.fingerprint);const attempt=checkpoint.attempts?.at(-1);if(attempt?.status==='unknown')usageIds.add(attempt.usageId);}
 if(task&&(task.status==='running'||hadInFlight))task.status='interrupted';return [...usageIds].filter(id=>shortString(id,200));
}

export function revisionUnknownSegments(task){
 return (Array.isArray(task?.segments)?task.segments:[]).filter(segment=>{const checkpoint=task.checkpoints?.[`revision-${segment.id}-${segment.round}`];return segment.status==='interrupted_unknown'||(segment.status==='pending'&&checkpoint?.status==='interrupted'&&checkpoint.attempts?.at(-1)?.status==='unknown');});
}

export function approveRevisionRetry(task,{confirmUnknown=false}={}){
 if(task?.status!=='interrupted')throw new Error('Diese Überarbeitung wartet nicht auf Fortsetzung.');const unknown=revisionUnknownSegments(task);if(unknown.length&&confirmUnknown!==true)throw new Error('Die unterbrochene Anfrage kann erneut Kosten oder Kontingent verbrauchen. Bitte die Wiederholung ausdrücklich bestätigen.');for(const segment of unknown)if(segment.status==='interrupted_unknown')approveTranslationSegmentRetry(task,segment.id);for(const segment of task.segments||[])if(segment.status==='failed'){segment.status='pending';delete segment.errorCode;}task.status='pending';return task;
}

export function askRevisionQuestions(task,segmentId,questions,resultRef){
 if(!Array.isArray(questions)||!questions.length||questions.length>100||questions.some(question=>!question||!shortString(question.question,2000)||question.context!==undefined&&(typeof question.context!=='string'||question.context.length>4000)))throw new Error('Die Rückfragen des Abschnitts sind ungültig.');
 const segment=markTranslationSegmentNeedsInput(task,segmentId,{resultRef});task.pendingQuestions=structuredClone(questions);task.waitingSegment=segment.id;task.status='needs_input';return task;
}

export function answerRevisionQuestions(task,answer){
 const segment=task?.segments?.find(item=>item.id===task.waitingSegment);if(task?.status!=='needs_input'||!segment||segment.status!=='needs_input'||typeof answer!=='string'||!shortString(answer.trim(),4000))throw new Error('Die Rückfrage kann nicht fortgesetzt werden.');if(segment.round>=8)throw new Error('Zu viele Rückfragen zu diesem Abschnitt. Bitte die Überarbeitung neu beginnen.');
 segment.answers.push({role:'assistant',text:task.pendingQuestions.map(question=>`${question.question}${question.context?'\n'+question.context:''}`).join('\n\n')},{role:'user',text:answer.trim()});segment.round++;segment.status='pending';task.pendingQuestions=[];delete task.waitingSegment;task.status='pending';return task;
}
