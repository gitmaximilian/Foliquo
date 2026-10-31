import {createHash} from 'node:crypto';

const normalize=value=>String(value||'').normalize('NFKC').replace(/[\s\u200e\u200f]+/gu,' ').trim().toLocaleLowerCase();
const fingerprint=value=>createHash('sha256').update(value).digest('hex').slice(0,20);

/** Flag repeated critical source values that received different translations; never edits output. */
export function repeatedCriticalValueChecks(fields=[]){
 if(!Array.isArray(fields))return [];
 const groups=new Map();
 for(const field of fields){
  if(!field||!['name','number','date'].includes(field.kind)||typeof field.source!=='string'||typeof field.translated!=='string')continue;
  const source=normalize(field.source),translated=normalize(field.translated);
  if(!source||!translated)continue;
  const key=`${field.kind}\0${source}`,group=groups.get(key)||{kind:field.kind,source:field.source,values:new Map(),pages:new Set()};
  const value=group.values.get(translated)||{text:field.translated.trim(),count:0};value.count++;group.values.set(translated,value);
  if(Number.isInteger(field.page)&&field.page>0)group.pages.add(field.page);
  groups.set(key,group);
 }
 return [...groups.entries()].filter(([,group])=>group.values.size>1).map(([key,group])=>{
  const pages=[...group.pages].sort((a,b)=>a-b);
  return {
  id:`consistency-${group.kind}-${fingerprint(key)}`,
  label:`Wiederholter Wert: ${group.kind==='name'?'Name':group.kind==='date'?'Datum':'Nummer'}`,
  kind:'consistency',source:group.source,
  translated:[...group.values.values()].map(value=>value.text).join(' · '),
  values:[...group.values.values()].map(value=>({text:value.text,occurrences:value.count})),
  pages,present:true,consistent:null,severity:'review',
  issue:`Derselbe erkannte Quellwert hat unterschiedliche Übersetzungen (Seiten: ${pages.length?pages.join(', '):'unbekannt'}). Original und Kontext seitenübergreifend vergleichen; Foliquo ändert keine Werte automatisch.`,confirmed:false
 }});
}
