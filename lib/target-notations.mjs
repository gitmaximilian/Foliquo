// Fixed notations written into a translation for non-text elements. They follow
// the target language so an English or Arabic translation does not contain
// German bracket notes. German keeps the established wording unchanged.
export const TARGET_NOTATIONS=Object.freeze({
 Deutsch:{stamp:'Stempel',signature:'Unterschrift',illegible:'unleserlich',handwriting:'Handschriftlich',illegibleInOriginal:'im Original unleserlich',illegibleLine:'Im Original unleserlich',coatOfArms:'Staatswappen Syriens (Adler)',arabicLetter:'Arabischer Buchstabe, Lautschrift',stampExample:'Blauer ovaler Stempel',photo:'Lichtbild'},
 Englisch:{stamp:'Stamp',signature:'Signature',illegible:'illegible',handwriting:'Handwritten',illegibleInOriginal:'illegible in the original',illegibleLine:'Illegible in the original',coatOfArms:'Coat of arms of Syria (eagle)',arabicLetter:'Arabic letter, transliteration',stampExample:'Blue oval stamp',photo:'Photo'},
 Arabisch:{stamp:'ختم',signature:'توقيع',illegible:'غير مقروء',handwriting:'بخط اليد',illegibleInOriginal:'غير مقروء في الأصل',illegibleLine:'غير مقروء في الأصل',coatOfArms:'شعار الجمهورية العربية السورية (عقاب)',arabicLetter:'حرف عربي، النطق',stampExample:'ختم أزرق بيضاوي',photo:'صورة شخصية'},
 Französisch:{stamp:'Cachet',signature:'Signature',illegible:'illisible',handwriting:'Mention manuscrite',illegibleInOriginal:'illisible dans l’original',illegibleLine:'Illisible dans l’original',coatOfArms:'Armoiries de la Syrie (aigle)',arabicLetter:'Lettre arabe, translittération',stampExample:'Cachet ovale bleu',photo:'Photo'},
 Spanisch:{stamp:'Sello',signature:'Firma',illegible:'ilegible',handwriting:'Manuscrito',illegibleInOriginal:'ilegible en el original',illegibleLine:'Ilegible en el original',coatOfArms:'Escudo de Siria (águila)',arabicLetter:'Letra árabe, transliteración',stampExample:'Sello ovalado azul',photo:'Fotografía'},
 Italienisch:{stamp:'Timbro',signature:'Firma',illegible:'illeggibile',handwriting:'Annotazione manoscritta',illegibleInOriginal:'illeggibile nell’originale',illegibleLine:'Illeggibile nell’originale',coatOfArms:'Stemma della Siria (aquila)',arabicLetter:'Lettera araba, traslitterazione',stampExample:'Timbro ovale blu',photo:'Fotografia'},
 Türkisch:{stamp:'Mühür',signature:'İmza',illegible:'okunaksız',handwriting:'El yazısı',illegibleInOriginal:'asılda okunaksız',illegibleLine:'Asılda okunaksız',coatOfArms:'Suriye arması (kartal)',arabicLetter:'Arap harfi, transliterasyon',stampExample:'Mavi oval mühür',photo:'Fotoğraf'},
});

export function notationsFor(target){return TARGET_NOTATIONS[target]||TARGET_NOTATIONS.Deutsch;}

const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const unique=values=>[...new Set(values)];
const all=key=>unique(Object.values(TARGET_NOTATIONS).map(entry=>entry[key]));

// Words accepted when reading existing text, including legacy and model variants.
const STAMP_WORDS=unique([...all('stamp'),'Stamp','الختم']);
const SIGNATURE_WORDS=unique([...all('signature'),'Signatur','signature']);
const ILLEGIBLE_WORDS=unique([...all('illegible'),'unreadable','nicht lesbar','not legible','vorhanden','present']);
const HANDWRITING_WORDS=unique([...all('handwriting'),'Handschriftlicher Zusatz','Handschriftliche Ergänzung','Handwritten note','Handwriting']);
const alternatives=words=>words.sort((a,b)=>b.length-a.length).map(escape).join('|');

export const STAMP_MARKER=new RegExp(`^\\s*(?:${alternatives([...STAMP_WORDS])})\\s*:\\s*$`,'iu');
export const STAMP_WORD=new RegExp(`(?:${alternatives([...STAMP_WORDS])})`,'iu');
export const SIGNATURE_LABEL=new RegExp(`^(?:${alternatives([...SIGNATURE_WORDS])})$`,'iu');
export const SIGNATURE_UNREADABLE=new RegExp(`\\[?(?:${alternatives([...SIGNATURE_WORDS])})\\s*(?::\\s*)?(?:${alternatives([...ILLEGIBLE_WORDS])})\\]?`,'giu');
export const SIGNATURE_PREFIX=new RegExp(`^\\[?(?:${alternatives([...SIGNATURE_WORDS])})\\s*:\\s*`,'iu');
export const ILLEGIBLE_CANDIDATE=new RegExp(`^(?:${alternatives([...ILLEGIBLE_WORDS,...SIGNATURE_WORDS.map(word=>`${word} vorhanden`),'signature present'])}|${alternatives([...SIGNATURE_WORDS])})$`,'iu');
export const HANDWRITING_BRACKET=new RegExp(`\\[(?:${alternatives([...HANDWRITING_WORDS])})\\s*:\\s*([^\\]]+)\\]`,'giu');
// Only the legacy German labels are rewritten from plain lines; other languages use them as ordinary labels.
export const HANDWRITING_LINE=/^(?:Handschriftlicher Zusatz|Handschriftliche Ergänzung)\s*:\s*(.+)$/gimu;
export const HANDWRITING_PREFIX=new RegExp(`^\\[?(?:${alternatives([...HANDWRITING_WORDS])})\\s*:\\s*`,'iu');
export const HANDWRITING_UNREADABLE=new RegExp(`^\\[(?:${alternatives([...HANDWRITING_WORDS])})\\s*:\\s*(?:${alternatives([...ILLEGIBLE_WORDS])})\\]$`,'iu');
export const ILLEGIBLE_BRACKET=new RegExp(`\\[(?:${alternatives(all('illegible'))})\\]`,'iu');
export const PRESERVED_NOTE=new RegExp(`^\\[(?:Staatswappen|Wappen|Logo|Coat of arms|${alternatives([...all('photo'),...SIGNATURE_WORDS,...HANDWRITING_WORDS])})(?:\\s*:|\\s|\\])`,'iu');

export const stampMarker=target=>`${notationsFor(target).stamp}:`;
export const unreadableSignature=target=>{const n=notationsFor(target);return `[${n.signature}: ${n.illegible}]`;};
export const namedSignature=(target,name)=>`[${notationsFor(target).signature}: ${name}]`;
export const handwritingNote=(target,value)=>`[${notationsFor(target).handwriting}: ${value}]`;
export const unreadableHandwriting=target=>{const n=notationsFor(target);return `[${n.handwriting}: ${n.illegible}]`;};
export const photoNote=target=>`[${notationsFor(target).photo}]`;
