import {createHash} from 'node:crypto';

const keys=['titleAlign','lineHeight','margin','tableLabelWidth','paragraphSpacing','keepRows','pageNumbers'];
/** Separate contradictory approved layout values before any profile is applied. */
export function selectLearningLayout(entries){
 const candidates=entries.filter(entry=>entry.layoutApproved!==false&&entry.layout&&typeof entry.layout==='object');
 if(!candidates.length)return {};
 const layout={...candidates[0].layout},conflicting=keys.filter(key=>new Set(candidates.map(entry=>entry.layout[key]).filter(value=>value!==undefined).map(value=>JSON.stringify(value))).size>1);
 if(!conflicting.length)return {layout};
 for(const key of conflicting)delete layout[key];
 return {layout,learningLayoutConflict:{keys:conflicting,entries:candidates.map(entry=>({entryId:entry.id,name:entry.name,profileVersion:entry.analysis?.profileVersion||entry.version||1,values:Object.fromEntries(conflicting.filter(key=>entry.layout[key]!==undefined).map(key=>[key,entry.layout[key]]))}))}};
}
/** Higher-priority explicit template/profile values settle their own layout keys. */
export function unresolvedLearningLayout(conflict,explicitLayout){
 if(!conflict)return null;const unresolved=conflict.keys.filter(key=>explicitLayout?.[key]===undefined);
 return unresolved.length?{keys:unresolved,entries:conflict.entries.map(entry=>({...entry,values:Object.fromEntries(unresolved.filter(key=>entry.values[key]!==undefined).map(key=>[key,entry.values[key]]))}))}:null;
}
/** Resolve only a deliberate choice bound to the frozen candidate layouts. */
export function learningLayoutQuestions(payload,context){
 const conflict=context.learningLayoutConflict;if(!conflict?.entries?.length)return [];
 const binding=createHash('sha256').update(JSON.stringify(conflict)).digest('hex').slice(0,16),choices=conflict.entries.map((entry,index)=>`${index+1}: ${entry.name}`).join(' | '),contextKey=`Lernlayoutentscheidung · ${binding} · ${choices}`;
 const decision=(payload.metadata.clarifications||[]).find(item=>item.context===contextKey&&typeof item.answer==='string');
 const answer=decision?.answer.trim(),number=/^\d+$/.test(answer||'')?Number(answer):null,matches=conflict.entries.filter((entry,index)=>number===index+1||entry.entryId===answer||entry.name?.toLocaleLowerCase()===answer?.toLocaleLowerCase());
 if(matches.length!==1)return [{kind:'learning-layout',displayContext:choices,question:'Deine freigegebenen Muster haben unterschiedliche Layoutvorgaben. Welches Muster soll für diesen Auftrag gelten? Gib die Nummer oder den Musternamen an.',context:contextKey}];
 const chosen=matches[0];context.layout={...context.layout,...chosen.values};context.learningLayoutDecision={entryId:chosen.entryId,profileVersion:chosen.profileVersion,values:chosen.values};context.learningLayoutConflict=null;context.contextVersion=createHash('sha256').update(JSON.stringify({prior:context.contextVersion,layout:context.layout,decision:context.learningLayoutDecision})).digest('hex').slice(0,32);return [];
}
