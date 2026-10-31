import {normalizeGlossaryEntry} from './glossary.mjs';

const MAX_BYTES=1024*1024,MAX_ROWS=1000,ESCAPE='\u200B';
const headers=['source','target','allowedVariants','sourceLanguage','targetLanguage','documentType','scope','scopeId','matchMode','status','note'];
const formulaLike=value=>/^[\s\t\r\n]*[=+@-]/.test(value);

function rowsOf(text,delimiter){
 const rows=[];let row=[],cell='',quoted=false,afterQuote=false;
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(quoted){if(char==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;afterQuote=true;}}else cell+=char;continue;}
  if(afterQuote&&char!==delimiter&&char!=='\r'&&char!=='\n'&&char!==' '&&char!=='\t')throw new Error('CSV enthält unerwartete Zeichen hinter einem Anführungszeichen.');
  if(char==='"'){if(cell.trim())throw new Error('CSV enthält ein Anführungszeichen außerhalb eines Feldes.');cell='';quoted=true;afterQuote=false;}
  else if(char===delimiter){row.push(cell);cell='';afterQuote=false;}
  else if(char==='\r'||char==='\n'){if(char==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(value=>value.trim()))rows.push(row);row=[];cell='';afterQuote=false;}
  else{cell+=char;if(!/\s/.test(char))afterQuote=false;}
 }
 if(quoted)throw new Error('CSV enthält ein nicht geschlossenes Anführungszeichen.');
 row.push(cell);if(row.some(value=>value.trim()))rows.push(row);
 if(rows.length>MAX_ROWS+2)throw new Error('CSV darf höchstens 1.000 Begriffe enthalten.');
 return rows;
}

function delimiterOf(text){
 let quoted=false,comma=0,semicolon=0;
 for(let i=0;i<text.length;i++){const char=text[i];if(char==='"'){if(quoted&&text[i+1]==='"'){i++;continue;}quoted=!quoted;}else if(!quoted&&(char==='\n'||char==='\r'))break;else if(!quoted&&char===',')comma++;else if(!quoted&&char===';')semicolon++;}
 return semicolon>comma?';':',';
}

export function parseGlossaryCSV(input,{mapping={}}={}){
 if(typeof input!=='string')throw new Error('CSV-Datei ist ungültig.');
 let text=input.charCodeAt(0)===0xFEFF?input.slice(1):input;
 if(Buffer.byteLength(text,'utf8')>MAX_BYTES)throw new Error('CSV-Datei darf höchstens 1 MB groß sein.');
 const delimiter=delimiterOf(text),rows=rowsOf(text,delimiter);if(!rows.length)return {delimiter,rows:[],errors:[{row:1,error:'CSV enthält keine Spaltenüberschrift.'}]};
 let reversible=false,headerOffset=1;
 if(rows[0][0]==='# Foliquo Glossary v1 · reversible formula-safe export'){reversible=true;headerOffset=2;rows.shift();}
 const names=rows.shift().map(value=>value.trim().replace(/^\uFEFF/,''));
 if(new Set(names).size!==names.length)return {delimiter,headers:names,rows:[],errors:[{row:1,error:'Spaltennamen dürfen nicht doppelt vorkommen.'}]};
 const columns=Object.fromEntries(headers.map(key=>{const mapped=mapping?.[key];return [key,Number.isInteger(mapped)?mapped:names.indexOf(typeof mapped==='string'?mapped:key)];}));
 if(columns.source<0||columns.target<0)return {delimiter,headers:names,rows:[],errors:[{row:1,error:'Bitte die Quell- und Zielspalte zuordnen.'}]};
 const errors=[],result=[],seen=new Map();
 rows.forEach((values,index)=>{
  const rowNumber=index+headerOffset+1,record=Object.fromEntries(headers.map(name=>[name,columns[name]>=0?values[columns[name]]??'':'']));
  if(reversible)for(const key of Object.keys(record))if(record[key].startsWith(ESCAPE))record[key]=record[key].slice(ESCAPE.length);
  if(!record.source.trim()||!record.target.trim()){errors.push({row:rowNumber,error:'source und target sind erforderlich.'});return;}
  if(record.source.length>300||record.target.length>300||(record.allowedVariants||'').length>6000||(record.sourceLanguage||'').length>50||(record.targetLanguage||'').length>50||(record.documentType||'').length>120||(record.scopeId||'').length>100||(record.note||'').length>500){errors.push({row:rowNumber,error:'Ein Feld überschreitet die erlaubte Länge.'});return;}
  if(record.scope&&!['global','profile','job'].includes(record.scope)||record.matchMode&&!['word','phrase','case-sensitive'].includes(record.matchMode)||record.status&&!['approved','proposed','disabled'].includes(record.status)){errors.push({row:rowNumber,error:'scope, matchMode oder status enthält einen unbekannten Wert.'});return;}
  const term=normalizeGlossaryEntry(record),signature=[term.source.normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase(),term.sourceLanguage.toLocaleLowerCase(),term.targetLanguage.toLocaleLowerCase(),term.documentType.toLocaleLowerCase(),term.scope,term.scopeId,term.matchMode].join('\u0000');
  if(seen.has(signature)){if(seen.get(signature).target===term.target) return;errors.push({row:rowNumber,error:`Widersprüchliches Ziel zum Eintrag in Zeile ${seen.get(signature).row}.`});return;}
  seen.set(signature,{target:term.target,row:rowNumber});result.push({row:rowNumber,entry:term});
 });
 return {delimiter,headers:names,rows:result,errors};
}

function quote(value,delimiter){let text=String(value??'');if(text.startsWith(ESCAPE)||formulaLike(text))text=ESCAPE+text;return /["\r\n]/.test(text)||text.includes(delimiter)?`"${text.replace(/"/g,'""')}"`:text;}
export function exportGlossaryCSV(entries=[]){
 const delimiter=',';
 return ['# Foliquo Glossary v1 · reversible formula-safe export',headers.join(delimiter),...entries.map(entry=>headers.map(header=>{const value=header==='allowedVariants'?(Array.isArray(entry.allowedVariants)?entry.allowedVariants.join('\n'):''):entry[header]??(header==='status'?'approved':header==='scope'?'global':'');return quote(value,delimiter);}).join(delimiter))].join('\r\n')+'\r\n';
}

export function compareGlossaryImport(parsed,existing=[]){
 const signature=entry=>[(entry.matchMode==='case-sensitive'?entry.source.normalize('NFKC').replace(/\s+/g,' '):entry.source.normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase()),(entry.sourceLanguage||'any').toLocaleLowerCase(),(entry.targetLanguage||'Deutsch').toLocaleLowerCase(),(entry.documentType||'any').toLocaleLowerCase(),entry.scope||'global',entry.scopeId||entry.jobId||entry.profileId||'',entry.matchMode||'phrase'].join('\u0000');
 const variants=entry=>JSON.stringify([...new Set((Array.isArray(entry.allowedVariants)?entry.allowedVariants:typeof entry.allowedVariants==='string'?entry.allowedVariants.split(/\r?\n/):[]).filter(value=>typeof value==='string').map(value=>value.normalize('NFKC').trim()).filter(Boolean))].sort());
 const saved=new Map();for(const entry of existing){const key=signature(entry),items=saved.get(key)||[];items.push(entry);saved.set(key,items);}
 const duplicates=[],conflicts=[];
 for(const item of parsed.rows){const matches=saved.get(signature(item.entry))||[];if(matches.some(entry=>entry.target.normalize('NFKC').trim()===item.entry.target.normalize('NFKC').trim()&&variants(entry)===variants(item.entry)))duplicates.push({row:item.row,source:item.entry.source});else if(matches.length)conflicts.push({row:item.row,source:item.entry.source,targets:[...new Set(matches.flatMap(entry=>[entry.target,...(Array.isArray(entry.allowedVariants)?entry.allowedVariants:[])]).concat([item.entry.target,...(item.entry.allowedVariants||[])]))]});}
 return {duplicates,conflicts};
}
