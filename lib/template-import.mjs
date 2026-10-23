import {unzipSync,strFromU8} from 'fflate';
import {defaultLayout,layoutSettings} from './workspace.mjs';
const decode=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
export function inspectWord(bytes){
 if(bytes.length>10*1024*1024)throw new Error('Word-Vorlagen dürfen maximal 10 MB groß sein.');
 let total=0;const files=unzipSync(new Uint8Array(bytes),{filter:f=>{if(!/^word\/(document|styles|header\d*|footer\d*)\.xml$/.test(f.name))return false;total+=f.originalSize;if(f.originalSize>8*1024*1024||total>12*1024*1024)throw new Error('Entpackte Vorlage ist zu groß.');return true;}});
 if(!files['word/document.xml'])throw new Error('Bitte eine makrofreie DOCX-Datei auswählen.');
 const doc=strFromU8(files['word/document.xml']),styles=files['word/styles.xml']?strFromU8(files['word/styles.xml']):'';
 const textOf=xml=>[...xml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)].map(m=>[...m[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(t=>decode(t[1])).join('')).join('\n');
 const text=textOf(doc),font=(styles.match(/w:ascii="([^"]+)"/)||doc.match(/w:ascii="([^"]+)"/))?.[1];
 const size=Number((styles.match(/<w:sz w:val="(\d+)"/)||doc.match(/<w:sz w:val="(\d+)"/))?.[1])/2;
 const margin=Number(doc.match(/<w:pgMar[^>]*w:left="(\d+)"/)?.[1])*25.4/1440;
 const line=Number((styles.match(/<w:spacing[^>]*w:line="(\d+)"/)||doc.match(/<w:spacing[^>]*w:line="(\d+)"/))?.[1])/240;
 const layout=layoutSettings({...defaultLayout,...(['Arial','Times New Roman','Noto Serif'].includes(font)?{font}:{}),...(size>=8&&size<=16?{fontSize:size}:{}),...(margin>=15&&margin<=35?{margin:Math.round(margin)}:{}),...(line>=1&&line<=2?{lineHeight:Math.round(line*100)/100}:{})});
 const tableFields=[...doc.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].map(m=>m[0].match(/<w:tc[\s>][\s\S]*?<\/w:tc>/)?.[0]).filter(Boolean).map(textOf).filter(v=>v.length>=2&&v.length<=80&&!/^\[/.test(v));
 const fields=[...new Set([...tableFields,...[...text.matchAll(/^([\p{L}][^:\n]{1,59}):/gmu)].map(m=>m[1].trim())])].slice(0,40);
 return {text,layout,fields,confirmed:false,notes:['Vorschlag aus DOCX-Struktur; vor Verwendung bestätigen.','Kopf-/Fußzeilen und Beglaubigungstext werden wegen möglicher persönlicher Angaben nicht automatisch übernommen.','Komplexe freie Positionierung wird auf Absätze und Tabellen übertragen.']};
}
