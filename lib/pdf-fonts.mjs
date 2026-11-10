import {PDFDict,PDFName} from 'pdf-lib';

/** Inspect translation pages only. Original annex fonts are not export substitutes. */
export function inspectTranslationFonts(pdf,translationPages,{maxPages=150,maxObjects=2048,maxFonts=64}={}){
 const actual=new Set(),visited=new WeakSet();let objects=0,limited=translationPages>maxPages;
 const lookup=value=>pdf.context.lookup(value);
 const dictionary=value=>{const resolved=lookup(value);return resolved instanceof PDFDict?resolved:resolved?.dict instanceof PDFDict?resolved.dict:null;};
 function resources(value,depth=0){
  if(!value)return;const resource=dictionary(value);if(!resource||visited.has(resource))return;if(depth>8||objects++>=maxObjects){limited=true;return;}visited.add(resource);
  const fonts=dictionary(resource.get(PDFName.of('Font')));
  if(fonts)for(const [,ref]of fonts.entries()){
   if(objects++>=maxObjects){limited=true;break;}
   const font=dictionary(ref),base=font?.lookupMaybe(PDFName.of('BaseFont'),PDFName);if(!base)continue;
   const name=base.decodeText().replace(/^[A-Z]{6}\+/,'').replace(/[\x00-\x1f\x7f]/g,'').slice(0,100);
   if(name&&!actual.has(name)){if(actual.size>=maxFonts){limited=true;break;}actual.add(name);}
  }
  const forms=dictionary(resource.get(PDFName.of('XObject')));if(forms)for(const [,ref]of forms.entries()){const form=dictionary(ref);resources(form?.get(PDFName.of('Resources')),depth+1);}
 }
 const scannedPages=Math.min(translationPages,maxPages,pdf.getPageCount());
 for(let index=0;index<scannedPages;index++)try{resources(pdf.getPage(index).node.Resources());}catch{limited=true;}
 return {method:'page-font-resources',actual:[...actual].sort(),scannedPages,totalPages:translationPages,limited,status:actual.size?'available':'unknown'};
}
