import {reviewRuleProposal} from './personal-rules.mjs';
import {createContextLibrarySnapshot,resolveContextSnapshot} from './context.mjs';
import {resolvePersonalRules} from './rule-resolver.mjs';
import {layoutSettings} from './workspace.mjs';
import {createTranslationPDF} from './documents.mjs';
import {createTranslationWord} from './word.mjs';

const fail=(message,code='ERR_RULE_VALIDATION')=>{throw Object.assign(new Error(message),{code});};
// Deliberately independent of uploaded text, names, headers and certification.
export const layoutExample=['FIKTIVES BEISPIEL / FICTIONAL EXAMPLE','Name | Alex Example','Dokumentnummer | DEMO-12345',
 ...Array.from({length:10},(_,i)=>`Beispiel ${i+1} | ${'Fiktiver Beispieltext zur Darstellung von Abständen, Tabellen und Seitenübergängen. '.repeat(5)}`),
 '[Seitenumbruch]','FIKTIVE FORTSETZUNG','Dieses Dokument erläutert ausschließlich eine Layouteinstellung.'].join('\n');

export function deriveLayoutPreview(workspace,input,meta={},owner=null){
 if(!input||typeof input.id!=='string'||!input.id||input.id.length>100||!['rule','proposal'].includes(input.kind)||!Number.isSafeInteger(input.version))fail('Select a saved rule or proposal version.');
 const data=workspace.data;
 const selected=(input.kind==='rule'?data.personalRules:data.ruleProposals).find(item=>item.id===input.id);
 if(!selected||selected.version!==input.version)fail('The selected version changed. Reload before previewing.','ERR_RULE_STALE');
 const snapshot=createContextLibrarySnapshot(workspace,meta,'',owner);
 const beforeSnapshot=structuredClone(snapshot);
 let rule;
 if(input.kind==='proposal'){
  if(selected.status!=='pending'||!['create','replace'].includes(selected.operation))fail('Only pending layout definitions can be previewed.');
  const copy=structuredClone({personalRules:data.personalRules,ruleProposals:[selected],ruleLibraryVersion:data.ruleLibraryVersion,glossary:data.glossary});
  rule=reviewRuleProposal(copy,selected.id,{version:selected.version,accept:true}).rule;
  snapshot.rules.rules=copy.personalRules;
 }else rule=snapshot.rules.rules.find(item=>item.id===selected.id);
 if(!rule||rule.effect.kind!=='layout')fail('This rule has no supported layout preview.');
 const applicability=resolveContextSnapshot(snapshot,meta).ruleResolution;
 const without=resolveContextSnapshot(input.kind==='proposal'?beforeSnapshot:{...snapshot,rules:{...snapshot.rules,rules:snapshot.rules.rules.filter(item=>item.id!==rule.id)}},meta);
 // The illustration changes one validated key, using the production resolver.
 // It does not pretend that an inactive, conflicting or unmatched rule applies.
 const illustration=resolvePersonalRules([{...rule,status:'active',independent:true,scope:{}}],{});
 const before=layoutSettings({...without.layout,header:'',footer:'',certification:''});
 const after=layoutSettings({...before,...illustration.layoutPatch});
 return {fictional:true,effect:rule.effect,scope:rule.scope,before,after,unchanged:before[rule.effect.key]===after[rule.effect.key],decision:applicability.decisions.find(item=>item.id===rule.id),conflicts:applicability.conflicts,libraryVersion:snapshot.rules.libraryVersion};
}

export async function renderLayoutPreview(workspace,input,meta={},owner=null){
 if(input.format!==undefined&&!['pdf','docx'].includes(input.format))fail('Unsupported preview format.');
 const result=deriveLayoutPreview(workspace,input,meta,owner),format=input.format||'pdf';
 const render=async layout=>{
  const metadata={layout,language:'Deutsch',targetLanguage:'Deutsch',fictionalLayoutPreview:true};
  const bytes=format==='pdf'?await createTranslationPDF(layoutExample,[],metadata):createTranslationWord(layoutExample,metadata);
  return Buffer.from(bytes).toString('base64');
 };
 // Sequential rendering bounds local conversion work to one document at a time.
 const before=await render(result.before),after=await render(result.after);
 return {...result,format,documents:{before,after}};
}
