// Search normalization is deliberately separate from factual value comparison.
// Numeric glyphs are preserved; matches always map back to the original UTF-16 span.
const segmenter=new Intl.Segmenter('und',{granularity:'grapheme'});
export function foldSearchText(input,{positions=false}={}){
 if(typeof input!=='string')throw new Error('Invalid search text.');let text='';const starts=[],ends=[];
 for(const {segment,index}of segmenter.segment(input)){
  const folded=/\p{N}/u.test(segment)?segment.normalize('NFC'):segment.normalize('NFD').replace(/\p{M}/gu,'').replace(/[\u0640\u061c\u200e\u200f]/gu,'').toLowerCase().replace(/ß/gu,'ss').replace(/ς/gu,'σ');
  text+=folded;if(positions)for(let unit=0;unit<folded.length;unit++){starts.push(index);ends.push(index+segment.length);}
 }
 return positions?{text,starts,ends}:text;
}
export function searchGrams(folded){const chars=Array.from(folded),grams=new Set();for(let i=0;i+1<chars.length;i++)grams.add(chars[i]+chars[i+1]);return grams;}
export function parseSearchQuery(query){
 if(typeof query!=='string'||query.length>160||query.includes('\0'))throw new Error('Bitte einen Suchtext mit 2 bis 160 Zeichen eingeben.');const text=query.trim(),folded=foldSearchText(text);if(Array.from(folded).length<2)throw new Error('Bitte einen Suchtext mit 2 bis 160 Zeichen eingeben.');return {folded,numeric:/^[\p{N}\s./-]+$/u.test(text)&&/\p{N}/u.test(text),grams:[...searchGrams(folded)]};
}
export function findSearchMatch(original,query,{from=0}={}){
 const folded=foldSearchText(original,{positions:true});let cursor=0;
 while(cursor<=folded.text.length-query.folded.length){const index=folded.text.indexOf(query.folded,cursor);if(index<0)return null;cursor=index+Math.max(1,query.folded.length);const start=folded.starts[index],end=folded.ends[index+query.folded.length-1];if(start<from)continue;
  if(query.numeric&&(/\p{N}$/u.test(original.slice(Math.max(0,start-2),start))||/^\p{N}/u.test(original.slice(end,end+2))))continue;
  return {start,end};
 }return null;
}
export function searchSnippet(text,match,{context=90}={}){
 let start=Math.max(0,match.start-context),end=Math.min(text.length,match.end+context);if(start&&/[\uDC00-\uDFFF]/u.test(text[start]))start--;if(end<text.length&&/[\uD800-\uDBFF]/u.test(text[end-1]))end++;return {text:text.slice(start,end),highlights:[{start:match.start-start,end:match.end-start}],leading:start>0,trailing:end<text.length};
}
