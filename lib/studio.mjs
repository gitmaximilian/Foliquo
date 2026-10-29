import {createHash,randomUUID} from 'node:crypto';
import {string} from './workspace.mjs';
import {sourceFields} from './verification.mjs';
const arabic=/\p{Script=Arabic}/u;
function questionIdentity(kind,field,context,occurrence=0){const location={kind,fileIndex:field.fileIndex,page:field.page,box:Array.isArray(field.box)?field.box.map(n=>Math.round(n*1000)/1000):null,label:String(field.label||'').normalize('NFKC').replace(/\s+/g,' ').trim(),source:String(field.source||'').normalize('NFKC').replace(/\s+/g,' ').trim(),context:String(context||'').normalize('NFKC').replace(/\s+/g,' ').trim(),occurrence};return `q-${createHash('sha256').update(JSON.stringify(location)).digest('hex').slice(0,24)}`;}
// Match answers to the same source location. If both locations have boxes,
// geometry takes precedence over repeated labels or question wording.
function sameQuestionLocation(question,answer){
 const norm=value=>String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
 if(question.id&&answer.questionId===question.id)return true;
 if(Number.isInteger(answer.fileIndex)&&Number.isInteger(question.fileIndex)&&answer.fileIndex!==question.fileIndex)return false;
 if(Number.isInteger(answer.page)&&Number.isInteger(question.page)&&answer.page!==question.page)return false;
 const a=answer.box,b=question.box,hasBoxes=Array.isArray(a)&&Array.isArray(b)&&a.length===4&&b.length===4;
 if(hasBoxes){const intersection=Math.max(0,Math.min(a[0]+a[2],b[0]+b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[1]+a[3],b[1]+b[3])-Math.max(a[1],b[1]));return intersection/(a[2]*a[3]+b[2]*b[3]-intersection)>.65;}
 if(norm(question.context)&&norm(question.context)===norm(answer.context))return true;
 return Boolean(norm(question.question)&&norm(question.question)===norm(answer.question));
}
function alreadyAnswered(question,answers=[]){return answers.some(answer=>sameQuestionLocation(question,answer));}
export function resolvedAsUnreadable(question,answers=[]){return answers.some(answer=>answer.unreadable&&sameQuestionLocation(question,answer));}
export function intakeQuestions(inventory,uncertain,meta,facts=[],documents=[]){
 const answered=meta.clarifications||[];const questions=[],occurrences=new Map();
 for(const field of inventory.filter(f=>f.kind==='name'&&arabic.test(f.source))){
  const context=`Namensabgleich: ${field.source}`,base=JSON.stringify([field.fileIndex,field.page,field.label,field.source,context]),occurrence=Array.isArray(field.box)?0:(occurrences.get(base)||0);occurrences.set(base,occurrence+1);const question={...field,id:questionIdentity('name',field,context,occurrence),suggestion:typeof field.suggestion==='string'&&!arabic.test(field.suggestion)?field.suggestion:'',question:`Welche lateinische Schreibweise von „${field.source}“ steht im Pass oder soll nach Prüfung verwendet werden?`,context};
  if((meta.nameSpellings?.trim()&&(inventory.filter(f=>f.kind==='name'&&arabic.test(f.source)).length===1||meta.nameSpellings.includes(field.source)))||facts.some(f=>f.confirmed&&f.key==='personName'&&/^(name|full name|vollständiger name)$/i.test(field.label))||alreadyAnswered(question,answered)||questions.some(existing=>existing.id===question.id))continue;
  questions.push(question);
 }
 if(uncertain!==undefined&&uncertain!==null){
  if(!Array.isArray(uncertain)||uncertain.length>20)throw Object.assign(new Error('Die Erfassung unleserlicher Stellen hat ein ungültiges Format geliefert. Bitte erneut versuchen.'),{code:'INVALID_UNCERTAIN_REGIONS'});
  for(const [index,value] of uncertain.entries()){
   // Model-provided labels are optional descriptions, not required user inputs.
   // Keep the uncertainty visible even if the model omits or overfills a label.
   const region=value&&typeof value==='object'?value:{};
   if(region.kind==='signature'||/unterschrift|signature/iu.test(String(region.label||'')))continue;
   const label=typeof region.label==='string'&&region.label.trim()?region.label.trim().slice(0,150):`Unleserliche Stelle ${index+1}`;
   const location=sourceFields([{...region,label,source:'',translated:''}],documents)[0];
   const context=`Unleserliche Stelle: ${label}`,base=JSON.stringify([location.fileIndex,location.page,label,context]),occurrence=Array.isArray(location.box)?0:(occurrences.get(base)||0);occurrences.set(base,occurrence+1);const question={...location,id:questionIdentity('unreadable',location,context,occurrence),kind:'unreadable',question:`Bitte „${label}“ entziffern oder eine bessere Aufnahme dieser Stelle ergänzen.`,context};
   if(alreadyAnswered(question,answered)||questions.some(existing=>existing.id===question.id))continue;
   questions.push(question);
  }
 }
 return questions.filter(question=>!alreadyAnswered(question,answered)).slice(0,10);
}
export function correctionCandidates(jobs,owner,language){const candidates=new Map();for(const job of jobs.filter(j=>j.owner===owner&&j.targetLanguage===language)){const versions=job.review?.versions||[];for(let i=1;i<versions.length;i++){for(const field of versions[i].fields||[]){const old=versions[i-1].fields?.find(f=>f.id===field.id);if(!old||old.translated===field.translated||!field.source||!field.translated||field.kind!=='other'||/\d|\bname\b|geburt|pass|nummer/i.test(field.label+' '+field.source+' '+field.translated)||field.source.length>300||field.translated.length>300)continue;const key=JSON.stringify([field.source,field.translated]);const c=candidates.get(key)||{source:field.source,target:field.translated,count:0,jobs:new Set()};c.count++;c.jobs.add(job.id);candidates.set(key,c);}}}return [...candidates.values()].filter(c=>c.count>=2).map(({jobs,...c})=>({...c,jobCount:jobs.size}));}
export function practiceSnapshot(job){const p=job.practice||{};return {...p,corrections:Math.max(0,(job.review?.version||1)-1),activeSeconds:p.startedAt?Math.round(((p.stoppedAt||Date.now())-p.startedAt)/1000):0};}
export function recordPractice(job,input,review){if(input.version!==review.version||review.busy)throw new Error('Bitte die aktuelle abgeschlossene Fassung wählen.');job.practice||={};const p=job.practice;if(input.action==='start'){if(!p.startedAt||p.stoppedAt){p.startedAt=Date.now();p.stoppedAt=null;}return practiceSnapshot(job);}if(input.action==='finish'){if(!p.startedAt)throw new Error('Praxistest zuerst starten.');if(!Number.isFinite(input.manualMinutes)||input.manualMinutes<0||input.manualMinutes>1440||!Number.isInteger(input.rating)||input.rating<1||input.rating>5)throw new Error('Manuelle Vergleichszeit und Bewertung 1–5 angeben.');p.stoppedAt=Date.now();p.manualMinutes=input.manualMinutes;p.rating=input.rating;p.notes=string(input.notes||'',4000);p.id||=randomUUID();return practiceSnapshot(job);}throw new Error('Unbekannte Praxistest-Aktion.');}
export function practiceReport(jobs,owner){return {schema:1,createdAt:new Date().toISOString(),note:'Anonymisierte technische Kennzahlen, keine Dokumenttexte oder Freitextnotizen.',cases:jobs.filter(j=>j.owner===owner&&j.practice?.stoppedAt).map((j,i)=>{const p=practiceSnapshot(j);return {case:i+1,seconds:p.activeSeconds,manualMinutes:p.manualMinutes,rating:p.rating,corrections:p.corrections};})};}
