import {unzipSync,strFromU8} from 'fflate';
import {defaultLayout,layoutSettings} from './workspace.mjs';

const decode=value=>String(value||'').replace(/&(#x[\da-f]+|#\d+|lt|gt|quot|apos|amp);/giu,(_,entity)=>{
 if(entity[0]==='#'){const hex=entity[1]?.toLowerCase()==='x',code=Number.parseInt(entity.slice(hex?2:1),hex?16:10);return Number.isFinite(code)&&code<=0x10ffff?String.fromCodePoint(code):'';}
 return ({lt:'<',gt:'>',quot:'"',apos:"'",amp:'&'})[entity.toLowerCase()]||'';
});
function parseXml(xml){
 const root={name:'#root',attrs:{},children:[]},stack=[root];
 for(const token of String(xml).matchAll(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<![^>]*>|<[^>]+>|[^<]+/g)){
  const raw=token[0];if(raw.startsWith('<!--')||raw.startsWith('<?')||raw.startsWith('<!'))continue;
  if(raw.startsWith('</')){const name=raw.slice(2,-1).trim();for(let i=stack.length-1;i>0;i--)if(stack[i].name===name){stack.length=i;break;}continue;}
  if(raw.startsWith('<')){
   const name=raw.match(/^<([^\s/>]+)/)?.[1];if(!name)continue;
   const attrs={};for(const match of raw.slice(name.length+1).matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs[match[1]]=decode(match[2]??match[3]);
   const node={name,attrs,children:[]};stack.at(-1).children.push(node);if(!/\/>$/.test(raw))stack.push(node);
  }else if(raw.trim())stack.at(-1).children.push({name:'#text',value:decode(raw)});
 }
 return root;
}
const children=(node,local)=>node?.children?.filter(child=>child.name==='#text'||child.name.split(':').at(-1)===local)||[];
const first=(node,local)=>children(node,local).find(child=>child.name!=='#text');
const descendants=(node,local)=>{const out=[];for(const child of node?.children||[])if(child.name!=='#text'){if(child.name.split(':').at(-1)===local)out.push(child);out.push(...descendants(child,local));}return out;};
const val=node=>node?.attrs?.['w:val']??node?.attrs?.['w:ascii']??node?.attrs?.['w:eastAsia']??null;
const twips=value=>Number.isFinite(Number(value))?Math.round(Number(value)*25.4/1440*100)/100:null;
const points=value=>Number.isFinite(Number(value))?Number(value)/2:null;
function textOf(node){return (node?.children||[]).map(child=>child.name==='#text'?child.value:(child.name.split(':').at(-1)==='t'||child.name.split(':').at(-1)==='delText'?textOf(child):textOf(child))).join('');}
function paragraphInfo(node,styleMap){
 const pPr=first(node,'pPr'),styleId=val(first(pPr,'pStyle'))||'',style=styleMap.get(styleId)||{},rPr=first(node,'rPr'),direct={};
 const align=val(first(pPr,'jc'));if(align)direct.alignment=align;
 const ind=first(pPr,'ind');if(ind)direct.indentLeft=twips(ind.attrs['w:left']);
 const spacing=first(pPr,'spacing');if(spacing){direct.spaceBefore=points(val({attrs:{'w:val':spacing.attrs['w:before']}}));direct.spaceAfter=points(val({attrs:{'w:val':spacing.attrs['w:after']}}));direct.lineSpacing=spacing.attrs['w:line']?Number(spacing.attrs['w:line'])/240:null;}
 if(first(pPr,'keepNext'))direct.keepNext=true;if(first(pPr,'keepLines'))direct.keepLines=true;if(first(pPr,'pageBreakBefore'))direct.pageBreakBefore=true;
 const runs=descendants(node,'r').map(run=>{const rp=first(run,'rPr'),font=first(rp,'rFonts'),size=first(rp,'sz');return {text:textOf(run),bold:Boolean(first(rp,'b')),italic:Boolean(first(rp,'i')),underline:Boolean(first(rp,'u')),font:font?.attrs?.['w:ascii']||font?.attrs?.['w:hAnsi']||null,fontSize:points(val(size))};}).filter(run=>run.text);
 const effective={...style,...direct};
 const own=descendants(node,'rPr')[0];if(own){const f=first(own,'rFonts'),s=first(own,'sz');if(f)effective.font=f.attrs?.['w:ascii']||f.attrs?.['w:hAnsi']||null;if(s)effective.fontSize=points(val(s));}
 return {text:textOf(node),styleId,styleName:style.name||styleId||'Normal',format:effective,runs};
}
function styleCatalog(xml){
 const root=parseXml(xml),raw=new Map();for(const node of descendants(root,'style')){const id=node.attrs['w:styleId'];if(!id)continue;raw.set(id,{id,name:val(first(node,'name'))||id,basedOn:val(first(node,'basedOn'))||'',pPr:first(node,'pPr'),rPr:first(node,'rPr')});}
 const resolved=new Map();function resolve(id,seen=new Set()){if(resolved.has(id))return resolved.get(id);const item=raw.get(id);if(!item)return {};if(seen.has(id)||seen.size>12)return {name:item.name};seen.add(id);const parent=resolve(item.basedOn,seen),p=item.pPr,r=item.rPr,out={...parent,name:item.name};
  const align=val(first(p,'jc'));if(align)out.alignment=align;const spacing=first(p,'spacing');if(spacing){if(spacing.attrs['w:before'])out.spaceBefore=points(Number(spacing.attrs['w:before']));if(spacing.attrs['w:after'])out.spaceAfter=points(Number(spacing.attrs['w:after']));if(spacing.attrs['w:line'])out.lineSpacing=Number(spacing.attrs['w:line'])/240;}
  const font=first(r,'rFonts');if(font)out.font=font.attrs['w:ascii']||font.attrs['w:hAnsi']||null;const size=first(r,'sz');if(size)out.fontSize=points(val(size));if(first(r,'b'))out.bold=true;if(first(r,'i'))out.italic=true;resolved.set(id,out);return out;}
 for(const id of raw.keys())resolve(id);return resolved;
}
function sectionInfo(node){const pg=first(node,'pgSz'),mar=first(node,'pgMar'),cols=first(node,'cols');const width=twips(pg?.attrs?.['w:w']),height=twips(pg?.attrs?.['w:h']);return {
 pageWidthMm:width,pageHeightMm:height,orientation:pg?.attrs?.['w:orient']||null,
 marginsMm:{top:twips(mar?.attrs?.['w:top']),right:twips(mar?.attrs?.['w:right']),bottom:twips(mar?.attrs?.['w:bottom']),left:twips(mar?.attrs?.['w:left'])},
 columns:Number(cols?.attrs?.['w:num']||1),columnGapMm:twips(cols?.attrs?.['w:space']),headerDistanceMm:twips(first(node,'pgMar')?.attrs?.['w:header']),footerDistanceMm:twips(first(node,'pgMar')?.attrs?.['w:footer']),
 };
}
export function inspectWord(bytes){
 if(bytes.length>10*1024*1024)throw new Error('Word-Vorlagen dürfen maximal 10 MB groß sein.');
 let total=0,count=0;const wanted=/^word\/(document|styles|numbering|settings|header\d*|footer\d*)\.xml$/;const files=unzipSync(new Uint8Array(bytes),{filter:file=>{count++;total+=file.originalSize;if(count>3000||file.originalSize>8*1024*1024||total>24*1024*1024)throw new Error('Entpackte Vorlage ist zu groß.');return wanted.test(file.name);}});
 if(!files['word/document.xml'])throw new Error('Bitte eine makrofreie DOCX-Datei auswählen.');
 const doc=parseXml(strFromU8(files['word/document.xml'])),styles=files['word/styles.xml']?styleCatalog(strFromU8(files['word/styles.xml'])):new Map();
 const paragraphs=descendants(doc,'p').map(p=>paragraphInfo(p,styles)).filter(p=>p.text.trim());
 const tables=descendants(doc,'tbl').map((table,index)=>{const grid=first(table,'tblGrid'),columns=children(grid,'gridCol').map(col=>twips(col.attrs['w:w'])),rows=children(table,'tr').map(row=>children(row,'tc').map(cell=>({text:descendants(cell,'t').map(n=>n.children?.map(c=>c.value||'').join('')||'').join(''),widthMm:twips(first(cell,'tcPr')&&first(first(cell,'tcPr'),'tcW')?.attrs?.['w:w']),gridSpan:Number(val(first(first(cell,'tcPr'),'gridSpan'))||1),verticalMerge:val(first(first(cell,'tcPr'),'vMerge'))||null})));return {index:index+1,columnsMm:columns,rows};});
 const sections=descendants(doc,'sectPr').map(sectionInfo);const numbering=files['word/numbering.xml']?descendants(parseXml(strFromU8(files['word/numbering.xml'])),'abstractNum').length:0;
 const text=paragraphs.map(p=>p.text).join('\n');
 const fontCounts={},sizeCounts={},alignments={};for(const p of paragraphs){if(p.format.font)fontCounts[p.format.font]=(fontCounts[p.format.font]||0)+p.runs.length||1;if(p.format.fontSize)sizeCounts[p.format.fontSize]=(sizeCounts[p.format.fontSize]||0)+1;if(p.format.alignment)alignments[p.format.alignment]=(alignments[p.format.alignment]||0)+1;}
 const allFonts=Object.entries(fontCounts).sort((a,b)=>b[1]-a[1]),allSizes=Object.entries(sizeCounts).sort((a,b)=>b[1]-a[1]),firstSection=sections[0],font=allFonts[0]?.[0],size=Number(allSizes[0]?.[0]);
 const paragraphStyleCounts={},paragraphFormatCounts={};for(const p of paragraphs){paragraphStyleCounts[p.styleName]=(paragraphStyleCounts[p.styleName]||0)+1;const key=JSON.stringify({alignment:p.format.alignment||null,font:p.format.font||null,fontSize:p.format.fontSize||null,bold:p.format.bold||false,italic:p.format.italic||false,indentLeft:p.format.indentLeft||null,spaceBefore:p.format.spaceBefore||null,spaceAfter:p.format.spaceAfter||null,lineSpacing:p.format.lineSpacing||null,keepNext:p.format.keepNext||false,keepLines:p.format.keepLines||false,pageBreakBefore:p.format.pageBreakBefore||false});paragraphFormatCounts[key]=(paragraphFormatCounts[key]||0)+1;}
 const tablePatterns={};for(const table of tables){const pattern=JSON.stringify({columnsMm:table.columnsMm,rowCount:table.rows.length,gridSpans:table.rows.map(row=>row.map(cell=>cell.gridSpan)),verticalMerges:table.rows.reduce((n,row)=>n+row.filter(cell=>cell.verticalMerge).length,0)});tablePatterns[pattern]=(tablePatterns[pattern]||0)+1;}
 const layout=layoutSettings({...defaultLayout,...(['Arial','Times New Roman','Noto Serif'].includes(font)?{font}:{}),...(size>=8&&size<=16?{fontSize:size}:{}),...(firstSection?.marginsMm?.left>=15&&firstSection?.marginsMm?.left<=35?{margin:Math.round(firstSection.marginsMm.left)}:{}),...(paragraphs.find(p=>p.format.lineSpacing)?.format.lineSpacing?{lineHeight:Math.max(1,Math.min(2,paragraphs.find(p=>p.format.lineSpacing).format.lineSpacing))}:{})});
 const tableFields=tables.flatMap(t=>(t.rows||[]).filter(row=>row.length>1).map(row=>row[0]?.text||'')).filter(v=>v.length>=2&&v.length<=80&&!/^\[/.test(v));const fields=[...new Set([...tableFields,...paragraphs.filter(p=>!/^\s*\[/.test(p.text)).map(p=>p.text.match(/^([\p{L}][^:\n]{1,59}):/u)?.[1]?.trim()).filter(Boolean)])].slice(0,60);
 const notes=['Vollständige DOCX-Struktur lokal ausgewertet; Makros und externe Verknüpfungen wurden nicht ausgeführt.','Kopf-/Fußzeilen werden auf Formatmerkmale geprüft; ihre Texte werden nicht als allgemeine Regeln gespeichert.','Beobachtete Schriftgrößen sind Vorschläge und können durch die feste Ausgabevorgabe übersteuert werden.'];
 const storedStyles=[...styles.values()].map(({id,name,basedOn,...format})=>({id,name,basedOn,...format})).slice(0,240),storedParagraphs=paragraphs.slice(0,4000),storedTables=tables.slice(0,300);
 const analysis={format:'docx',paragraphCount:paragraphs.length,tableCount:tables.length,numberedListDefinitions:numbering,styles:storedStyles,paragraphs:storedParagraphs,tables:storedTables,paragraphStyleCounts,paragraphFormatCounts,tablePatterns,coverage:{styles:{stored:storedStyles.length,total:styles.size},paragraphs:{stored:storedParagraphs.length,total:paragraphs.length},tables:{stored:storedTables.length,total:tables.length}},sections,headersAndFooters:Object.keys(files).filter(name=>/header\d*\.xml|footer\d*\.xml/.test(name)).map(name=>({part:name,paragraphs:descendants(parseXml(strFromU8(files[name])),'p').length})),fontCounts:Object.fromEntries(allFonts),sizeCounts:Object.fromEntries(allSizes),alignments};
 return {text,layout,fields,analysis,confirmed:false,notes};
}
