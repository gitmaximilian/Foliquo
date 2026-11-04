import {createHash} from 'node:crypto';
import {resolveContextSnapshot} from './context.mjs';
import {languageKey,documentTypeKey} from './context-keys.mjs';

export function personalRuleQuestions(payload,initial){
 if(!initial.ruleResolution)return {context:initial,questions:[]};
 const library=payload.contextLibrarySnapshot;
 if(!library){if(initial.ruleResolution.pending||initial.ruleResolution.conflicts.length)throw new Error('Der eingefrorene Regelbestand fehlt. Bitte diesen Auftrag mit den aktuellen Regeln neu starten.');return {context:initial,questions:[]};}
 const meta={...(payload.ruleContextMetadata||payload.metadata),ruleDecisions:{...(payload.ruleDecisions||{})}},questions=[];
 const answers=payload.metadata.clarifications||[];let updated=false;
 const binding=createHash('sha256').update(JSON.stringify(library.rules.rules.map(rule=>({id:rule.id,version:rule.version})))).digest('hex').slice(0,24);
 const pendingFields=new Set(initial.ruleResolution.decisions.filter(item=>item.state==='pending_scope').flatMap(item=>Object.keys(item.scope)).filter(key=>key!=='profileId'&&!(key.endsWith('Language')?languageKey(meta[key]):documentTypeKey(meta[key]))));
 for(const key of pendingFields){
  const context=`Foli scope · ${key} · ${binding}`,answer=answers.find(item=>item.context===context)?.answer;
  if(typeof answer==='string'&&answer.length<=120&&(key.endsWith('Language')?languageKey(answer):documentTypeKey(answer))){meta[key]=answer.trim();updated=true;}
  else questions.push({kind:'personal-rule-scope',scopeField:key,question:key==='documentType'?'Für welchen Dokumenttyp sollen die gespeicherten Regeln geprüft werden?':key==='sourceLanguage'?'Welche Quellsprache soll für die gespeicherten Regeln gelten?':'Welche Zielsprache soll für die gespeicherten Regeln gelten?',context});
 }
 for(const conflict of initial.ruleResolution.conflicts){
  const context=`Foli rule choice · ${conflict.id}`,answer=answers.find(item=>item.context===context)?.answer;
  const value=typeof answer==='string'?answer.trim():'',number=/^\d+$/.test(value)?Number(value):null;
  const selected=conflict.choices.filter((choice,index)=>choice.id===value||number===index+1);
  if(selected.length===1){meta.ruleDecisions[conflict.id]=selected[0].id;updated=true;}
  else questions.push({kind:'personal-rule',question:'Deine freigegebenen Regeln widersprechen sich. Welche Regel soll für diesen Auftrag gelten? Gib ihre Nummer an.',displayContext:conflict.choices.map((choice,index)=>`${index+1}: ${choice.title}`).join(' | '),context});
 }
 let context=initial;
 if(updated){
  context=resolveContextSnapshot(library,meta);payload.ruleDecisions=meta.ruleDecisions;payload.ruleContextMetadata=meta;payload.contextSnapshot=context;
  // A resolved scope can reveal a previously unknown conflict. Ask it now,
  // rather than silently choosing a rule or issuing a translation request.
  const known=new Set(questions.map(question=>question.context));
  for(const conflict of context.ruleResolution.conflicts){const key=`Foli rule choice · ${conflict.id}`;if(!known.has(key))questions.push({kind:'personal-rule',question:'Deine freigegebenen Regeln widersprechen sich. Welche Regel soll für diesen Auftrag gelten? Gib ihre Nummer an.',displayContext:conflict.choices.map((choice,index)=>`${index+1}: ${choice.title}`).join(' | '),context:key});}
 }
 const remaining=new Set(context.ruleResolution.conflicts.map(conflict=>`Foli rule choice · ${conflict.id}`));
 return {context,questions:questions.filter(question=>question.kind!=='personal-rule'||remaining.has(question.context))};
}
