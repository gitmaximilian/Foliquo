import {createHash} from 'node:crypto';
import {createDocumentModel,validateDocumentModel} from './document-model.mjs';

const splitTableRow=line=>{const delimiter=line.includes('\t')?'\t':line.includes(' | ')?' | ':null;return delimiter?{delimiter,cells:line.split(delimiter)}:null;};
const listLine=line=>/^\s*(?:[-*•]|\d+[.)])\s+/.test(line);
const headingLine=line=>/^\s*\(?(?:Vorderseite|Rückseite|Seite\s+\d+)\)?[:.]?\s*$/iu.test(line);
const rtlLanguage=language=>/^(?:arabisch|arabic|ar)(?:[-_].*)?$/iu.test(language);
function makeId(prefix,digest,index){return `${prefix}-${digest.slice(0,14)}-${index}`;}

export function documentFromLegacyText(input,{language='Deutsch',direction=rtlLanguage(language)?'rtl':'auto',layout=null,sourceRefs=[]}={}){
 if(typeof input!=='string'||input.length>1000000||input.includes('\0'))throw new Error('Der vorhandene Dokumenttext ist ungültig oder zu lang.');
 const trailingNewline=input.endsWith('\n'),lines=input.split('\n');if(trailingNewline)lines.pop();const digest=createHash('sha256').update(input).digest('hex'),blocks=[];
 const add=(type,fields={})=>{const index=blocks.length;blocks.push({id:makeId('b',digest,index),type,sourceBlockIds:[],...fields});};
 if(lines.length>20000){add('paragraph',{content:trailingNewline?input.slice(0,-1):input});return createDocumentModel({language,direction,blocks,layout,sourceRefs,legacy:{trailingNewline}});}
 for(let i=0;i<lines.length;){
  const line=lines[i],stamp=line.match(/^\s*(Stempel|Stamp|ختم)\s*:\s*$/iu);
  if(stamp){const content=[];while(i+1<lines.length&&lines[i+1].trim())content.push(lines[++i]);if(content.length)add('stamp',{content:content.join('\n'),properties:{marker:line}});else add('paragraph',{content:line});i++;continue;}
  const row=splitTableRow(line);
  if(row){const start=i,rows=[],rowDelimiters=[];while(i<lines.length){const next=splitTableRow(lines[i]);if(!next)break;rows.push(next.cells);rowDelimiters.push(next.delimiter);i++;}const count=Math.max(...rows.map(cells=>cells.length));if(rows.length>1000||count>20){for(const original of lines.slice(start,i))add('paragraph',{content:original});continue;}const blockIndex=blocks.length,widths=Array(count).fill(100/count),canonicalRows=rows.map((cells,rowIndex)=>cells.map((value,columnIndex)=>({id:makeId('c',digest,blockIndex*20000+rowIndex*20+columnIndex),text:value,sourceBlockIds:[]})));add('table',{rows:canonicalRows,relativeColumnWidths:widths,rowDelimiters,keepRows:true});continue;}
  if(line==='[Seitenumbruch]'){add('pageBreak');i++;continue;}
  if(listLine(line)){const items=[];while(i<lines.length&&listLine(lines[i]))items.push(lines[i++]);if(items.length>1000)for(const item of items)add('paragraph',{content:item});else add('list',{items,properties:{source:'legacy-text'}});continue;}
  if(headingLine(line))add('heading',{content:line});else add('paragraph',{content:line});i++;
 }
 return createDocumentModel({language,direction,blocks,layout,sourceRefs,legacy:{trailingNewline}});
}

export function documentToLegacyText(document){
 validateDocumentModel(document);const lines=[];
 for(const block of document.blocks){
  if(block.type==='heading'||block.type==='paragraph')lines.push(block.content);
  else if(block.type==='stamp')lines.push(block.properties?.marker||'Stempel:',...block.content.split('\n'));
  else if(block.type==='list')lines.push(...block.items);
  else if(block.type==='table')for(let index=0;index<block.rows.length;index++){const delimiter=block.rowDelimiters?.[index]||' | ';lines.push(block.rows[index].map(cell=>cell.text).join(delimiter));}
  else if(block.type==='pageBreak')lines.push('[Seitenumbruch]');
 }
 const text=lines.join('\n');return document.legacy?.trailingNewline?text+'\n':text;
}

export function adaptDocumentModel(input){
 if(typeof input==='string')return documentFromLegacyText(input);
 return validateDocumentModel(input);
}
