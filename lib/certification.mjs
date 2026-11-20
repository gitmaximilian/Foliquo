// Certification wording after the ÖVGD guideline (12.2024, sections B and D). Foliquo only places
// fixed wording chosen by the translator; it never sets a seal or signature and never certifies.
import {notationsFor} from './target-notations.mjs';

export const CERTIFIABLE_LANGUAGES=Object.freeze(['Arabisch','Deutsch','Englisch','Französisch','Italienisch','Kurdisch','Persisch','Russisch','Spanisch','Türkisch','Ukrainisch']);
export const SOURCE_FORMS=Object.freeze(['attached-original','presented-original','attached-copy','attached-certified-copy']);
export const ROUTES=Object.freeze(['paper','electronic']);

const GERMAN_ADJECTIVE={Arabisch:'arabischen',Deutsch:'deutschen',Englisch:'englischen',Französisch:'französischen',Italienisch:'italienischen',Kurdisch:'kurdischen',Persisch:'persischen',Russisch:'russischen',Spanisch:'spanischen',Türkisch:'türkischen',Ukrainisch:'ukrainischen'};
const ENGLISH_NAME={Arabisch:'Arabic',Deutsch:'German',Englisch:'English',Französisch:'French',Italienisch:'Italian',Kurdisch:'Kurdish',Persisch:'Persian',Russisch:'Russian',Spanisch:'Spanish',Türkisch:'Turkish',Ukrainisch:'Ukrainian'};
const ARABIC_NAME={Arabisch:'العربية',Deutsch:'الألمانية',Englisch:'الإنجليزية',Französisch:'الفرنسية',Italienisch:'الإيطالية',Kurdisch:'الكردية',Persisch:'الفارسية',Russisch:'الروسية',Spanisch:'الإسبانية',Türkisch:'التركية',Ukrainisch:'الأوكرانية'};
// Header lines in the other language of the pair. `from` names the source language in that language.
const FOREIGN_HEADERS={
 Englisch:{language:'en',line:(from,to,excerpt)=>`Certified ${excerpt?'partial ':''}translation from ${ENGLISH_NAME[from]||'the source language'} into ${ENGLISH_NAME[to]||'the target language'}`},
 Arabisch:{language:'ar',line:(from,to,excerpt)=>`ترجمة ${excerpt?'جزئية ':''}مصدّقة من اللغة ${ARABIC_NAME[from]||'الأصلية'} إلى اللغة ${ARABIC_NAME[to]||'الهدف'}`},
 Französisch:{language:'fr',from:{Arabisch:'de l’arabe',Deutsch:'de l’allemand',Englisch:'de l’anglais',Französisch:'du français',Italienisch:'de l’italien',Kurdisch:'du kurde',Persisch:'du persan',Russisch:'du russe',Spanisch:'de l’espagnol',Türkisch:'du turc',Ukrainisch:'de l’ukrainien'},into:{Arabisch:'vers l’arabe',Deutsch:'vers l’allemand',Englisch:'vers l’anglais',Französisch:'vers le français',Italienisch:'vers l’italien',Kurdisch:'vers le kurde',Persisch:'vers le persan',Russisch:'vers le russe',Spanisch:'vers l’espagnol',Türkisch:'vers le turc',Ukrainisch:'vers l’ukrainien'},line(from,to,excerpt){return `Traduction certifiée${excerpt?' partielle':''} ${this.from[from]||'de la langue source'} ${this.into[to]||'vers la langue cible'}`;}},
 Spanisch:{language:'es',names:{Arabisch:'árabe',Deutsch:'alemán',Englisch:'inglés',Französisch:'francés',Italienisch:'italiano',Kurdisch:'kurdo',Persisch:'persa',Russisch:'ruso',Spanisch:'español',Türkisch:'turco',Ukrainisch:'ucraniano'},line(from,to,excerpt){return `Traducción certificada${excerpt?' parcial':''} del ${this.names[from]||'idioma de origen'} al ${this.names[to]||'idioma de destino'}`;}},
 Italienisch:{language:'it',from:{Arabisch:'dall’arabo',Deutsch:'dal tedesco',Englisch:'dall’inglese',Französisch:'dal francese',Italienisch:'dall’italiano',Kurdisch:'dal curdo',Persisch:'dal persiano',Russisch:'dal russo',Spanisch:'dallo spagnolo',Türkisch:'dal turco',Ukrainisch:'dall’ucraino'},into:{Arabisch:'in arabo',Deutsch:'in tedesco',Englisch:'in inglese',Französisch:'in francese',Italienisch:'in italiano',Kurdisch:'in curdo',Persisch:'in persiano',Russisch:'in russo',Spanisch:'in spagnolo',Türkisch:'in turco',Ukrainisch:'in ucraino'},line(from,to,excerpt){return `Traduzione certificata${excerpt?' parziale':''} ${this.from[from]||'dalla lingua di partenza'} ${this.into[to]||'nella lingua di arrivo'}`;}},
 Türkisch:{language:'tr',names:{Arabisch:'Arapçadan',Deutsch:'Almancadan',Englisch:'İngilizceden',Französisch:'Fransızcadan',Italienisch:'İtalyancadan',Kurdisch:'Kürtçeden',Persisch:'Farsçadan',Russisch:'Rusçadan',Spanisch:'İspanyolcadan',Türkisch:'Türkçeden',Ukrainisch:'Ukraynacadan'},into:{Arabisch:'Arapçaya',Deutsch:'Almancaya',Englisch:'İngilizceye',Französisch:'Fransızcaya',Italienisch:'İtalyancaya',Kurdisch:'Kürtçeye',Persisch:'Farsçaya',Russisch:'Rusçaya',Spanisch:'İspanyolcaya',Türkisch:'Türkçeye',Ukrainisch:'Ukraynacaya'},line(from,to,excerpt){return `${this.names[from]||'Kaynak dilden'} ${this.into[to]||'hedef dile'} ${excerpt?'kısmi ':''}onaylı çeviri`;}},
};
const OBJECT_DE={'attached-original':'dem angehefteten Original','presented-original':'dem vorliegenden Original','attached-copy':'der angehefteten Kopie','attached-certified-copy':'der angehefteten beglaubigten Kopie'};
const OBJECT_EN={'attached-original':'the attached original','presented-original':'the original presented to me','attached-copy':'the attached copy','attached-certified-copy':'the attached certified copy'};
const OBJECT_AR={'attached-original':'الأصل المرفق','presented-original':'الأصل المقدَّم إليّ','attached-copy':'النسخة المرفقة','attached-certified-copy':'النسخة المصدّقة المرفقة'};
const FOREIGN_CLAUSE={
 Englisch:{language:'en',label:'[Translation of the certification clause]',text:form=>`I confirm, invoking my oath, that the foregoing translation corresponds exactly to ${OBJECT_EN[form]}.`},
 Arabisch:{language:'ar',label:'[ترجمة صيغة التصديق]',text:form=>`أؤكد، استنادًا إلى اليمين التي أديتها، التطابق التام بين الترجمة الواردة أعلاه و${OBJECT_AR[form]}.`},
};

const clean=value=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim():'';
const pairOf=(metadata={})=>{const source=metadata.language&&metadata.language!=='Automatisch'?metadata.language:metadata.sourceLanguage,target=metadata.targetLanguage==='English'?'Englisch':metadata.targetLanguage||'Deutsch';return {source,target};};
const otherLanguage=({source,target})=>target!=='Deutsch'?target:source;

export function normalizeCertificationProfile(input={}){
 const value=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
 const place=clean(value.place).slice(0,80);
 const languages=[...new Set(Array.isArray(value.languages)?value.languages.filter(language=>CERTIFIABLE_LANGUAGES.includes(language)&&language!=='Deutsch'):[])];
 return {place,languages,bilingual:value.bilingual!==false,sourceForm:SOURCE_FORMS.includes(value.sourceForm)?value.sourceForm:'attached-original',route:ROUTES.includes(value.route)?value.route:'paper'};
}
export function validateCertificationProfile(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Ungültiges Beglaubigungsprofil.');
 if(input.place!==undefined&&(typeof input.place!=='string'||input.place.length>80))throw new Error('Der Ort ist zu lang.');
 if(input.languages!==undefined&&(!Array.isArray(input.languages)||input.languages.length>CERTIFIABLE_LANGUAGES.length||input.languages.some(language=>!CERTIFIABLE_LANGUAGES.includes(language))))throw new Error('Ungültige Sprachauswahl.');
 if(input.sourceForm!==undefined&&!SOURCE_FORMS.includes(input.sourceForm))throw new Error('Ungültige Vorlageart.');
 if(input.route!==undefined&&!ROUTES.includes(input.route))throw new Error('Ungültiger Weg.');
 if(input.bilingual!==undefined&&typeof input.bilingual!=='boolean')throw new Error('Ungültige Option.');
 return normalizeCertificationProfile(input);
}
// Per-export choices; anything missing falls back to the profile.
export function certificationChoices(input,profile={}){
 const base=normalizeCertificationProfile(profile);
 if(input===true)input={enabled:true};
 if(!input||typeof input!=='object'||Array.isArray(input))return {enabled:false,sourceForm:base.sourceForm,route:base.route,excerpt:false,bilingual:base.bilingual};
 if(input.sourceForm!==undefined&&!SOURCE_FORMS.includes(input.sourceForm))throw new Error('Ungültige Vorlageart.');
 if(input.route!==undefined&&!ROUTES.includes(input.route))throw new Error('Ungültiger Weg.');
 return {enabled:input.enabled===true,sourceForm:input.sourceForm||base.sourceForm,route:input.route||base.route,excerpt:input.excerpt===true,bilingual:base.bilingual};
}

export function certifiedHeaderLines(metadata={}){
 const pair=pairOf(metadata),excerpt=metadata.certification?.excerpt===true;
 const german=`Beglaubigte ${excerpt?'auszugsweise ':''}Übersetzung aus der ${GERMAN_ADJECTIVE[pair.source]||'…'} Sprache in die ${GERMAN_ADJECTIVE[pair.target]?.slice(0,-1)||'…'} Sprache`;
 const lines=[{text:german,language:'de'}],foreign=FOREIGN_HEADERS[otherLanguage(pair)];
 if(foreign&&otherLanguage(pair)!=='Deutsch')lines.push({text:foreign.line(pair.source,pair.target,excerpt),language:foreign.language});
 // An Arabic or other right-to-left target keeps its own language first, as before.
 return pair.target!=='Deutsch'&&lines.length>1?[lines[1],lines[0]]:lines;
}

export function formatCertificationDate(date=new Date()){return `${String(date.getDate()).padStart(2,'0')}.${String(date.getMonth()+1).padStart(2,'0')}.${date.getFullYear()}`;}

// Clause paragraphs in reading order. The German wording follows § 190 AußStrG as quoted in guide B (2).
export function certificationClause(metadata={},profile={},date=new Date()){
 const choices=metadata.certification||{},form=SOURCE_FORMS.includes(choices.sourceForm)?choices.sourceForm:'attached-original',settings=normalizeCertificationProfile(profile);
 const placeDate=`${settings.place||'…'}, ${formatCertificationDate(date)}`;
 const paragraphs=[{text:`Die genaue Übereinstimmung der vorstehenden Übersetzung mit ${OBJECT_DE[form]} bestätige ich unter Berufung auf meinen Eid.`,language:'de'}];
 const foreign=FOREIGN_CLAUSE[otherLanguage(pairOf(metadata))];
 if(foreign&&choices.bilingual!==false&&settings.bilingual)paragraphs.push({text:`${foreign.label} ${foreign.text(form)}`,language:foreign.language});
 paragraphs.push({text:placeDate,language:'de'});
 return paragraphs;
}

// Checks shown before the final export (guide B, D). They warn; the translator decides.
export function certificationChecks({text='',regions=[],metadata={},profile={}}={}){
 const pair=pairOf(metadata),settings=normalizeCertificationProfile(profile),checks=[];
 if(!settings.place)checks.push({id:'place',severity:'warning'});
 const other=otherLanguage(pair);
 if(pair.source&&pair.target&&pair.source!=='Deutsch'&&pair.target!=='Deutsch')checks.push({id:'relay',severity:'warning',languages:[pair.source,pair.target]});
 else if(other&&other!=='Deutsch'&&settings.languages.length&&!settings.languages.includes(other))checks.push({id:'language',severity:'warning',language:other});
 const lines=String(text).split('\n');let run=0,start=0;
 for(let index=0;index<=lines.length;index++){if(index<lines.length&&!lines[index].trim()){if(!run)start=index;run++;continue;}if(run>=3)checks.push({id:'blank',severity:'warning',line:start+1,length:run});run=0;}
 const n=notationsFor(pair.target);
 const signatures=(Array.isArray(regions)?regions:[]).filter(region=>region?.kind==='signature');
 const signatureNotes=(String(text).match(new RegExp(`\\[${n.signature.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}[^\\]]*\\]`,'giu'))||[]).length;
 if(signatures.length>signatureNotes)checks.push({id:'signature',severity:'warning',expected:signatures.length,found:signatureNotes});
 if(metadata.certification?.sourceForm==='attached-copy')checks.push({id:'copy',severity:'info'});
 return checks;
}

// Clause for an export, or null when the translator did not choose to insert it.
export function certificationClauseFor(metadata={}){
 if(metadata.certification?.enabled!==true)return null;
 const date=typeof metadata.certification.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(metadata.certification.date)?new Date(`${metadata.certification.date}T12:00:00`):new Date();
 return certificationClause(metadata,metadata.certificationProfile||{},date);
}
