import { readFile } from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {createTranslationWord} from './word.mjs';
import {officeToPDF} from './formats.mjs';
import {translationInstructions,parseFinalTranslation,translationTitle,normalizeTranslation,finalTextQuestions} from './translation-policy.mjs';
import {stampBlocks} from './stamp-blocks.mjs';
import {layoutSettings} from './workspace.mjs';

export {validateUpload as validateDocuments} from './formats.mjs';
const identifierRow=cells=>cells.length===2&&(/(?:national|personal|document|identity|identification|licen[cs]e|driver|registration|serial|reference|identität|identifikation|dokument|ausweis|führerschein|kenn|akten)/iu.test(cells[0])||/رقم/u.test(cells[0]))&&/(?:nummer|number|no\.?|nr\.?|رقم)/iu.test(cells[0])&&/\p{N}/u.test(cells[1])&&/^[\p{L}\p{M}\p{N} ./-]+$/u.test(cells[1]);
async function translationFonts(pdf){
  const roots=[process.env.FOLIQUO_APTOS_FONT_DIR,...(process.platform==='win32'?[join(process.env.WINDIR||'C:\\Windows','Fonts')]:process.platform==='darwin'?[join(homedir(),'Library/Fonts'),'/Library/Fonts']:[join(homedir(),'.local/share/fonts'),join(homedir(),'.fonts'),'/usr/local/share/fonts','/usr/share/fonts/truetype/msttcorefonts'])].filter(Boolean);
  const names={regular:['Aptos.ttf','Aptos-Regular.ttf'],bold:['Aptos-Bold.ttf'],italic:['Aptos-Italic.ttf'],boldItalic:['Aptos-BoldItalic.ttf']};
  for(const root of roots){try{const files=await Promise.all(Object.values(names).map(async candidates=>{for(const name of candidates){try{return await readFile(join(root,name));}catch{}}throw new Error('Aptos font face unavailable');}));return await Promise.all(files.map(bytes=>pdf.embedFont(bytes,{subset:false})));}catch{}}
  // Aptos is assigned as the Word body font. If this computer has no licensed
  // Aptos installation, keep the PDF portable with the bundled OFL sans face.
  return await Promise.all(['LiberationSans-Regular.ttf','LiberationSans-Bold.ttf','LiberationSans-Italic.ttf','LiberationSans-BoldItalic.ttf'].map(async file=>pdf.embedFont(await readFile(new URL(`../dist/vendor/pdfjs/standard_fonts/${file}`,import.meta.url)),{subset:false})));
}
export async function createTranslationPDF(text, documents = [], metadata = {}) {
  if (typeof text !== 'string' || !text.trim() || text.length > 1000000) throw new Error('Der Übersetzungstext fehlt oder ist zu lang.');
  text=normalizeTranslation(text,metadata.targetLanguage);
  if(finalTextQuestions(text,metadata.targetLanguage).length)throw new Error('Es sind noch Angaben offen. Bitte die Rückfragen vor dem PDF-Export klären.');
  if(metadata.layout||(metadata.language==='Arabisch'&&metadata.targetLanguage==='Deutsch'))return createStyledPDF(text,documents,{...metadata,layout:layoutSettings(metadata.layout)});
  if(metadata.targetLanguage==='Arabisch') return createArabicPDF(text,documents,metadata);
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const [font,bold,italic] = await translationFonts(pdf); const supported = new Set(font.getCharacterSet());
  const clean = str => Array.from(str.replace(/\r\n/g,'\n').replace(/[\x00-\x08\x0B-\x1F\x7F]/g,'')).map(c => c==='\n'||c==='\t'||supported.has(c.codePointAt(0))?c:(()=>{throw new Error('Ein Zeichen kann nicht dargestellt werden. Bitte die betreffende Stelle in Lautschrift klären.');})()).join('');
  const margin=70,width=595.28,height=841.89,maxWidth=width-margin*2,size=11,leading=16;
  const title=translationTitle(metadata);
  const textPages=[];let page,y;
  function wrap(value,available=maxWidth,face=font,fontSize=size){
    const lines=[];let current='';
    for(const word of clean(value).replace(/\t/g,'    ').split(/\s+/)){
      const candidate=current?`${current} ${word}`:word;
      if(face.widthOfTextAtSize(candidate,fontSize)<=available){current=candidate;continue;}
      if(current){lines.push(current);current='';}
      for(const char of word){if(current&&face.widthOfTextAtSize(current+char,fontSize)>available){lines.push(current);current='';}current+=char;}
    }
    if(current)lines.push(current);return lines.length?lines:[''];
  }
  function draw(value,x,at,sizeValue=size,face=font){page.drawText(value,{x,y:at,size:sizeValue,font:face,color:rgb(0,0,0)});}
  function newPage(){
    page=pdf.addPage([width,height]);textPages.push(page);y=height-80;
    const titleSize=Math.min(12, (width-60)/bold.widthOfTextAtSize(title,1)),titleWidth=bold.widthOfTextAtSize(title,titleSize);const x=(width-titleWidth)/2;
    draw(title,x,height-42,titleSize,bold);page.drawLine({start:{x,y:height-44},end:{x:x+titleWidth,y:height-44},thickness:.6,color:rgb(0,0,0)});
  }
  function ensure(amount){if(y-amount<60)newPage();}
  function line(value,{face=font,align='left',gap=leading}={}){ensure(gap);const x=align==='right'?width-margin-face.widthOfTextAtSize(value,size):margin;draw(value,x,y,size,face);y-=gap;}
  function paragraph(value){wrap(value).forEach(l=>line(l));}
  function tableRow(cells){
    const split=cells.length===2?[maxWidth*.38,maxWidth*.62]:cells.map(()=>maxWidth/cells.length);
    const content=cells.map((c,i)=>wrap(c,split[i]-14));const rows=Math.max(...content.map(c=>c.length));let offset=0;
    while(offset<rows){
      ensure(leading+14);const count=Math.min(rows-offset,Math.max(1,Math.floor((y-65)/leading)-1)),rowHeight=count*leading+12;
      let x=margin;
      for(let i=0;i<cells.length;i++){
        page.drawRectangle({x,y:y-rowHeight+5,width:split[i],height:rowHeight,borderWidth:.5,borderColor:rgb(0,0,0)});
        content[i].slice(offset,offset+count).forEach((v,j)=>draw(v,x+7,y-8-j*leading));x+=split[i];
      }
      y-=rowHeight;offset+=count;if(offset<rows)newPage();
    }
  }
  function box(value){const content=wrap(value,maxWidth-16);let offset=0;while(offset<content.length){ensure(leading+16);const count=Math.min(content.length-offset,Math.max(1,Math.floor((y-65)/leading)-1)),boxHeight=count*leading+14;page.drawRectangle({x:margin,y:y-boxHeight+5,width:maxWidth,height:boxHeight,borderWidth:.6,borderColor:rgb(0,0,0)});content.slice(offset,offset+count).forEach((l,i)=>draw(l,margin+8,y-9-i*leading));y-=boxHeight+8;offset+=count;if(offset<content.length)newPage();}}
  function stampBox(lines){
    const content=lines.flatMap(value=>wrap(value,maxWidth-16));let offset=0;
    while(offset<content.length){
      ensure(leading+16);
      const count=Math.min(content.length-offset,Math.max(1,Math.floor((y-65)/leading)-1)),boxHeight=count*leading+14;
      page.drawRectangle({x:margin,y:y-boxHeight+5,width:maxWidth,height:boxHeight,borderWidth:.6,borderColor:rgb(0,0,0)});
      content.slice(offset,offset+count).forEach((value,i)=>draw(value,margin+8,y-9-i*leading));
      y-=boxHeight+8;offset+=count;if(offset<content.length)newPage();
    }
  }
  newPage();
  if(metadata.example){line('FIKTIVE BEISPIELDATEN',{face:bold});line('');}
  const body=clean(text);let afterTable=false;
  for(const block of stampBlocks(body)){
    if(block.type==='stamp'){stampBox(block.lines);afterTable=false;continue;}
    const raw=block.value;
    const value=raw.trim();if(value==='[Seitenumbruch]'){newPage();afterTable=false;continue;}
    if(afterTable&&!value.includes(' | ')&&!value.includes('\t')){y-=leading*1.5;afterTable=false;}
    if(!value){y-=7;continue;}
    if(/^(ÜBERSETZUNGSENTWURF|Übersetzungsentwurf|NICHT BEGLAUBIGT|UNBEGLAUBIGTER ENTWURF)/i.test(value))continue;
    if(/^\(?(Vorderseite|Rückseite|Seite \d+)\)?[:.]?$/i.test(value)){ensure(leading*3);y-=7;line(value.startsWith('(')?value:`(${value.replace(/[:.]$/,'')})`,{face:italic,align:'right',gap:24});continue;}
    if(value.includes(' | ')||value.includes('\t')){const cells=value.split(value.includes('\t')?'\t':' | ').map(c=>c.trim()).filter((c,i,a)=>c||i>0&&i<a.length-1);if(identifierRow(cells)){if(afterTable)y-=leading*1.5;paragraph(`${cells[0]}: ${cells[1]}`);afterTable=false;}else{tableRow(cells);afterTable=true;}continue;}
    if(/^\[(Stempel|Siegel|Rundstempel|Roter|Blauer|Schwarzer)/i.test(value)){box(value);continue;}
    if(/^(PRÜFHINWEISE|Eintragungsdaten|Geburtsangaben|Angaben zum Kind|Angaben zur Mutter|Angaben zum Vater|Mutter|Vater|Anmerkungen)[:.]?$/i.test(value)){ensure(leading*3);y-=5;line(value,{face:bold});continue;}
    paragraph(value);
  }
  const translationPageCount=textPages.length;
  textPages.forEach((p,i)=>{p.drawText('Automatischer Entwurf · nicht beglaubigt',{x:margin,y:30,size:7,font,color:rgb(.45,.45,.45)});const pageNumber=`${i+1} / ${translationPageCount}`,pageWidth=font.widthOfTextAtSize(pageNumber,7);p.drawText(pageNumber,{x:width-margin-pageWidth,y:30,size:7,font,color:rgb(.45,.45,.45)});});
  if(documents.length){
    for(const file of documents){
      if(file.type==='application/pdf'){
        let source;try{source=await PDFDocument.load(file.bytes);}catch{throw new Error('Ein Original-PDF ist verschlüsselt oder beschädigt. Bitte eine unverschlüsselte, lesbare Datei hochladen.');}
        if(source.getPageCount()>50||pdf.getPageCount()+source.getPageCount()>150)throw new Error('Zu viele PDF-Seiten. Bitte kleinere Dokumente verwenden.');
        (await pdf.copyPages(source,source.getPageIndices())).forEach(p=>pdf.addPage(p));
      }else{
        let image;try{image=file.type==='image/png'?await pdf.embedPng(new Uint8Array(file.bytes)):await pdf.embedJpg(new Uint8Array(file.bytes));}catch{throw new Error('Eine Bilddatei konnte nicht in das PDF übernommen werden.');}
        const sheet=pdf.addPage([width,height]),dims=image.scaleToFit(width-margin*2,height-100);sheet.drawImage(image,{x:(width-dims.width)/2,y:(height-dims.height)/2,width:dims.width,height:dims.height});
        sheet.drawText('Ausgangsdokument · Anhang',{x:margin,y:30,size:7,font,color:rgb(.45,.45,.45)});
      }
    }
  }
  pdf.setTitle('Foliquo – Übersetzung');pdf.setAuthor('Foliquo');pdf.setSubject('Übersetzung mit Ausgangsdokumenten zur Prüfung und Beglaubigung durch den Übersetzer');
  return Buffer.from(await pdf.save());
}

export function translationRequest(model, documents, metadata) {
  return {
    model, store:false, stream:true,
    instructions: translationInstructions(metadata.targetLanguage,metadata.sourceLanguage||'Automatisch'),
    input:[{role:'user',content:[{type:'input_text',text:`Bitte diese Dokumente vollständig nach ${metadata.targetLanguage||'Deutsch'} übersetzen. Kontext (unverbindliche Benutzereingabe): ${JSON.stringify(metadata)}`},...documents.flatMap((f,index) => [{type:'input_text',text:`Datei ${index+1} von ${documents.length}, Bestandteil desselben Dokuments: ${f.originalName||f.name}`},f.type === 'application/pdf' ? {type:'input_file',filename:f.name,file_data:`data:application/pdf;base64,${f.bytes.toString('base64')}`} : {type:'input_image',image_url:`data:${f.type};base64,${f.bytes.toString('base64')}`,detail:'high'}])]}],
  };
}

export const parseTranslation = parseFinalTranslation;
async function createArabicPDF(text,documents,metadata){
 const escape=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const display=value=>escape(value).replace(/\b\d{2}\.\d{2}\.\d{4}\b/g,date=>'<span dir="ltr">&#8206;'+date+'&#8206;</span>');
 const blocks=stampBlocks(text).map(block=>{if(block.type==='stamp')return '<table class="stamp"><tr><td>'+block.lines.map(display).join('<br>')+'</td></tr></table>';const value=block.value.trim();if(!value)return '<p class="spacer"></p>';if(value.includes(' | '))return '<table><tr>'+value.split(' | ').map(c=>'<td>'+display(c)+'</td>').join('')+'</tr></table>';return '<p dir="auto">'+display(value)+'</p>';}).join('');
 const html='<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>@page{size:A4;margin:2.2cm}body{font-family:Aptos,Arial,Tahoma,sans-serif;font-size:11pt;color:black;line-height:1.55}h1{font-family:Aptos,Arial,sans-serif;font-size:14pt;text-align:center;text-decoration:underline;margin:0 0 28pt}p{margin:0 0 6pt}.spacer{height:4pt}table{border-collapse:collapse;width:100%;margin:0}td{border:0.5pt solid black;padding:5pt;vertical-align:top}</style></head><body><h1 dir="ltr">'+escape(translationTitle(metadata))+'</h1>'+blocks+'</body></html>';
 const pdf=await PDFDocument.load(await officeToPDF(Buffer.from(html),'html'));
 const pages=pdf.getPages();pages.forEach((p,i)=>p.drawText(`${i+1}/${pages.length}`,{x:60,y:25,size:7}));
 for(const file of documents){if(file.type==='application/pdf'){const source=await PDFDocument.load(file.bytes);(await pdf.copyPages(source,source.getPageIndices())).forEach(p=>pdf.addPage(p));}else{const image=file.type==='image/png'?await pdf.embedPng(new Uint8Array(file.bytes)):await pdf.embedJpg(new Uint8Array(file.bytes));const page=pdf.addPage([595.28,841.89]),d=image.scaleToFit(475,720);page.drawImage(image,{x:(595.28-d.width)/2,y:(841.89-d.height)/2,width:d.width,height:d.height});}}
 pdf.setTitle('Foliquo - Übersetzung ins Arabische');return Buffer.from(await pdf.save());
}

async function createStyledPDF(text,documents,metadata){
 const layout=layoutSettings(metadata.layout);
 const pdf=await PDFDocument.load(await officeToPDF(createTranslationWord(text,metadata),'docx'));
 if(layout.includeOriginals!==false)for(const file of documents){if(file.type==='application/pdf'){const source=await PDFDocument.load(file.bytes);(await pdf.copyPages(source,source.getPageIndices())).forEach(p=>pdf.addPage(p));}else{const image=file.type==='image/png'?await pdf.embedPng(new Uint8Array(file.bytes)):await pdf.embedJpg(new Uint8Array(file.bytes));const page=pdf.addPage([595.28,841.89]),d=image.scaleToFit(475,720);page.drawImage(image,{x:(595.28-d.width)/2,y:(841.89-d.height)/2,width:d.width,height:d.height});}}
 pdf.setTitle('Foliquo – Übersetzung');return Buffer.from(await pdf.save());
}
