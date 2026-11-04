const clean=value=>typeof value==='string'?value.normalize('NFKC').replace(/\p{M}/gu,''):'';
function canonical(value,caseSensitive){const text=clean(value);return caseSensitive?text:text.toLocaleLowerCase();}
function contains(text,needle,mode,caseSensitive){const haystack=canonical(text,caseSensitive),term=canonical(needle,caseSensitive);if(!term)return false;if(mode!=='word')return haystack.includes(term);let from=0;while((from=haystack.indexOf(term,from))>=0){const before=from?Array.from(haystack.slice(0,from)).at(-1):'',after=Array.from(haystack.slice(from+term.length))[0]||'',wordChar=character=>Boolean(character&&/[\p{L}\p{N}\p{M}_]/u.test(character));if(!wordChar(before)&&!wordChar(after))return true;from+=Math.max(1,term.length);}return false;}
function arabic(value){return /\p{Script=Arabic}/u.test(value||'');}

/**
 * Compare selected glossary terms against locally extracted source text and the final translation.
 * This creates review items only; it never rewrites a translation or claims Arabic morphology was verified.
 */
export function glossaryAuditChecks(text='',terms=[],sourceParts=[]){
 const source=Array.isArray(sourceParts)?sourceParts.filter(value=>typeof value==='string').join('\n'):'';
 if(!source||!Array.isArray(terms))return [];
 const checks=[];
 for(const term of terms){
  if(!term||typeof term.source!=='string'||typeof term.target!=='string'||!term.source.trim()||!term.target.trim())continue;
  const mode=['word','case-sensitive'].includes(term.matchMode)?term.matchMode:'phrase',caseSensitive=mode==='case-sensitive';
  if(!contains(source,term.source,mode,caseSensitive))continue;
  const allowedVariants=[...new Set((Array.isArray(term.allowedVariants)?term.allowedVariants:[]).filter(value=>typeof value==='string').map(value=>value.normalize('NFKC').trim()).filter(value=>value&&value.length<=300))].slice(0,20),matchedVariant=allowedVariants.find(value=>contains(text,value,mode,caseSensitive)),present=contains(text,term.target,mode,caseSensitive)||Boolean(matchedVariant),arabicTarget=arabic(term.target)||allowedVariants.some(arabic),id=typeof term.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(term.id)?term.id:`${checks.length+1}`;
  checks.push({id:`glossary-${id}`,label:`Glossar: ${term.source}`,kind:'glossary',source:term.source,translated:term.target,allowedVariants,present,matchedVariant:matchedVariant||'',consistent:present?true:arabicTarget?null:false,severity:present?'info':arabicTarget?'review':'warning',issue:present?'':arabicTarget?'Exakte Wortform oder freigegebene Variante nicht gefunden. Arabische Flexion und angehängte Wortbestandteile werden nicht automatisch bewertet; bitte am Kontext prüfen.':'Die freigegebene Zielbezeichnung oder eine ihrer erlaubten Varianten wurde nicht exakt gefunden. Bitte am Kontext prüfen.',confirmed:false,termId:term.id||null,termVersion:Number.isSafeInteger(term.version)?term.version:1});
 }
 return checks;
}
