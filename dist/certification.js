// Certification panel, profile dialog and after-download checklist (ÖVGD guideline 12/2024).
// Foliquo only places wording the translator chose; seal, signature and certification stay human.
(()=>{
 const $=selector=>document.querySelector(selector);
 const locale=()=>{const value=window.TOCRI18n?.getLocale?.()||document.documentElement.lang||'de';return value==='en'?0:value==='ar'?2:1;};
 const COPY={
  enabled:['Clause at the end: {place}, {date}','Klausel am Ende: {place}, {date}','الصيغة في النهاية: {place}، {date}'],
  noPlace:['Set your place once so the clause can be inserted.','Lege einmal deinen Ort fest, damit die Klausel eingefügt werden kann.','حدّد مكانك مرة واحدة حتى يمكن إدراج الصيغة.'],
  setPlace:['Set place and languages','Ort und Sprachen festlegen','تحديد المكان واللغات'],
  header:['Header','Kopfzeile','الترويسة'],
  place:['Set a place for the clause in your certification profile.','Lege im Beglaubigungsprofil einen Ort für die Klausel fest.','حدّد في ملف التصديق مكانًا للصيغة.'],
  language:['{language} is not among the languages in your profile. Only certify languages you are listed for.','{language} ist nicht unter den Sprachen deines Profils. Beglaubige nur Sprachen, für die du eingetragen bist.','{language} ليست ضمن لغات ملفك. صدّق فقط اللغات المسجّل لها.'],
  relay:['Neither language is German. A relay translation needs a translator listed for this pair ({languages}).','Keine der beiden Sprachen ist Deutsch. Für eine Relais-Übersetzung braucht es eine für dieses Paar eingetragene Person ({languages}).','لا توجد الألمانية في الزوج. تتطلب الترجمة الوسيطة مترجمًا مسجّلًا لهذا الزوج ({languages}).'],
  blank:['Line {line}: {length} empty lines. Remove them or mark the space with a line.','Zeile {line}: {length} Leerzeilen. Entfernen oder den Leerraum mit einem Strich kennzeichnen.','السطر {line}: {length} أسطر فارغة. احذفها أو علّم الفراغ بخط.'],
  signature:['{expected} signatures were found in the original, {found} are rendered in the text. Each needs the name or “illegible”.','Im Original wurden {expected} Unterschriften erkannt, im Text stehen {found}. Jede braucht den Namen oder „unleserlich“.','عُثر في الأصل على {expected} توقيعات، وفي النص {found}. يحتاج كل توقيع إلى الاسم أو «غير مقروء».'],
  copy:['A plain copy has information value only. For official use, attach the original or a certified copy.','Eine einfache Kopie hat nur Informationswert. Für den amtlichen Gebrauch das Original oder eine beglaubigte Kopie anheften.','النسخة العادية للاطلاع فقط. للاستخدام الرسمي أرفق الأصل أو نسخة مصدّقة.'],
  ready:['Ready for the final export.','Bereit für den finalen Export.','جاهز للتصدير النهائي.'],
  saved:['Certification profile saved.','Beglaubigungsprofil gespeichert.','تم حفظ ملف التصديق.'],
  paper:[
   ['Print the translation and put the clause page last; the source pages follow in the PDF for reference.','Übersetzung ausdrucken; die Klausel steht auf der letzten Übersetzungsseite. Die Seiten des Ausgangsdokuments folgen im PDF nur zur Kontrolle.','اطبع الترجمة؛ الصيغة في آخر صفحة منها. صفحات الأصل تلي في ملف PDF للمراجعة فقط.'],
   ['Connect translation and original (or the certified copy) permanently: staple or thread, then a large, durable vignette.','Übersetzung und Original (oder beglaubigte Kopie) dauerhaft verbinden: Heftklammer oder Bindfaden, darüber eine große, dauerhaft klebende Vignette.','اربط الترجمة بالأصل (أو النسخة المصدّقة) ربطًا دائمًا: دبوس أو خيط، ثم ملصق كبير دائم.'],
   ['Set your round seal partly on the vignette and partly on the translation and the source, and sign without covering text.','Rundsiegel teils auf die Vignette, teils auf Übersetzung und Ausgangstext setzen und unterschreiben, ohne Text zu verdecken.','ضع الختم الدائري جزئيًا على الملصق وجزئيًا على الترجمة والأصل، ووقّع دون تغطية النص.'],
   ['Not durable: corner folded over a staple, a vignette alone, a pre-stamped vignette, metal corner clips.','Nicht dauerhaft: umgeschlagene Heftklammerecke, Vignette allein, vorab gestempelte Vignette, Metalleckklammer.','غير دائم: طيّ زاوية الدبوس، ملصق وحده، ملصق مختوم مسبقًا، مشبك زاوية معدني.'],
   ['Confirm any later handwritten correction with date and signature.','Spätere handschriftliche Korrekturen mit Datum und Unterschrift bestätigen.','أكّد أي تصحيح يدوي لاحق بالتاريخ والتوقيع.'],
   ['Hand over only the connected set, never the translation or stamped vignettes alone, and tell the client that nothing may be added.','Nur das verbundene Exemplar aushändigen, nie die Übersetzung oder gestempelte Vignetten allein, und darauf hinweisen, dass nichts ergänzt werden darf.','سلّم المجموعة المربوطة فقط، لا الترجمة وحدها ولا ملصقات مختومة، وأبلغ العميل بأنه لا يجوز إضافة شيء.'],
  ],
  electronic:[
   ['Use the exported PDF: it already contains the translation followed by the source pages in one file.','Das exportierte PDF verwenden: Es enthält Übersetzung und Ausgangsdokument bereits in einer Datei.','استخدم ملف PDF المصدَّر: يحتوي على الترجمة يليها الأصل في ملف واحد.'],
   ['Sign the whole PDF with your qualified electronic signature (ID Austria) outside Foliquo; it replaces seal and handwritten signature.','Das gesamte PDF außerhalb von Foliquo mit deiner qualifizierten elektronischen Signatur (ID Austria) signieren; sie ersetzt Siegel und Unterschrift.','وقّع ملف PDF كاملًا بتوقيعك الإلكتروني المؤهل (ID Austria) خارج Foliquo؛ وهو يحل محل الختم والتوقيع.'],
   ['Any change after signing invalidates the signature.','Jede Änderung nach dem Signieren macht die Signatur ungültig.','أي تغيير بعد التوقيع يبطل التوقيع.'],
   ['Tell the client: valid only in electronic exchange; a printout is not certified and it cannot receive an intermediate certification or apostille.','Auftraggeber:innen informieren: nur im elektronischen Verkehr gültig; ein Ausdruck ist nicht beglaubigt, Zwischenbeglaubigung und Apostille sind nicht möglich.','أبلغ العميل: صالح فقط في التداول الإلكتروني؛ النسخة المطبوعة غير مصدّقة ولا يمكن تصديقها وسيطًا أو بأبوستيل.'],
  ],
  abroad:[
   ['Use abroad needs the paper route with the original (or a notarised copy) attached.','Für das Ausland den Papierweg mit angeheftetem Original (oder notariell beglaubigter Kopie) wählen.','للاستخدام في الخارج اختر المسار الورقي مع إرفاق الأصل (أو نسخة موثقة).'],
   ['Intermediate certification of your signature at the regional court where you are listed.','Zwischenbeglaubigung deiner Unterschrift beim Landesgericht, bei dem du eingetragen bist.','تصديق وسيط لتوقيعك لدى المحكمة الإقليمية المسجّل لديها.'],
   ['Hague Convention states: apostille from the same regional court. Other states: BMEIA, then the foreign mission.','Haager Übereinkommen: Apostille durch dasselbe Landesgericht. Andere Staaten: Überbeglaubigung im BMEIA, danach Vertretungsbehörde des Ziellandes.','دول اتفاقية لاهاي: أبوستيل من المحكمة الإقليمية نفسها. الدول الأخرى: وزارة الخارجية النمساوية ثم بعثة البلد المقصود.'],
   ['Requirements differ by country: ask the regional court, BMEIA or the receiving authority first.','Anforderungen unterscheiden sich je Land: vorab beim Landesgericht, BMEIA oder der empfangenden Behörde nachfragen.','تختلف المتطلبات حسب البلد: اسأل مسبقًا المحكمة أو الوزارة أو الجهة المستلمة.'],
  ],
 };
 const LANGUAGE_NAMES={Arabisch:['Arabic','Arabisch','العربية'],Englisch:['English','Englisch','الإنجليزية'],Französisch:['French','Französisch','الفرنسية'],Italienisch:['Italian','Italienisch','الإيطالية'],Kurdisch:['Kurdish','Kurdisch','الكردية'],Persisch:['Persian','Persisch','الفارسية'],Russisch:['Russian','Russisch','الروسية'],Spanisch:['Spanish','Spanisch','الإسبانية'],Türkisch:['Turkish','Türkisch','التركية'],Ukrainisch:['Ukrainian','Ukrainisch','الأوكرانية'],Deutsch:['German','Deutsch','الألمانية']};
 const t=(key,values={})=>String(COPY[key][locale()]).replace(/\{(\w+)\}/g,(_,name)=>values[name]??'');
 const languageName=value=>LANGUAGE_NAMES[value]?.[locale()]||value;
 let snapshot=null,languages=[],downloaded=false;

 function element(tag,text,attributes={}){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);return node;}
 function route(){return document.querySelector('input[name="certification-route"]:checked')?.value||'paper';}
 function choices(){return {enabled:$('#certification-confirm')?.checked===true,sourceForm:$('#certification-source-form')?.value||'attached-original',excerpt:$('#certification-excerpt')?.checked===true,route:route()};}

 function renderPreview(){
  const host=$('#certification-preview');if(!host||!snapshot)return;
  const current=choices(),profile=snapshot.profile||{},clause=snapshot.previews?.[current.sourceForm]||[],header=snapshot.headers?.[current.excerpt?'excerpt':'full']||[];
  $('#certification-options').toggleAttribute('data-disabled',!current.enabled);
  const parts=[];
  const headerBox=element('div',undefined,{class:'certification-preview-header'});headerBox.append(element('span',t('header'),{class:'eyebrow'}));for(const line of header)headerBox.append(element('p',line.text,{lang:line.language,dir:line.language==='ar'?'rtl':'ltr'}));parts.push(headerBox);
  if(current.enabled&&profile.place){const box=element('div',undefined,{class:'certification-preview-clause'});for(const paragraph of clause)box.append(element('p',paragraph.text,{lang:paragraph.language,dir:paragraph.language==='ar'?'rtl':'ltr'}));box.append(element('div','',{class:'certification-seal-space','aria-hidden':'true'}));parts.push(box);}
  else if(current.enabled){const note=element('p',t('noPlace'),{class:'certification-missing'}),button=element('button',t('setPlace'),{type:'button',class:'secondary'});button.onclick=openProfile;note.append(' ',button);parts.push(note);}
  host.replaceChildren(...parts);
  renderChecks();
 }
 function renderChecks(){
  const host=$('#certification-checks');if(!host||!snapshot)return;
  const current=choices(),checks=(snapshot.checks||[]).filter(check=>check.id!=='copy');
  if(current.sourceForm==='attached-copy')checks.push({id:'copy',severity:'info'});
  if(!current.enabled)return host.replaceChildren(...checks.filter(check=>check.id==='blank'||check.id==='signature').map(item));
  host.replaceChildren(...(checks.length?checks.map(item):[element('li',t('ready'),{class:'is-ready'})]));
  function item(check){return element('li',t(check.id,{...check,language:languageName(check.language),languages:(check.languages||[]).map(languageName).join(' – ')}),{class:check.severity==='info'?'is-info':'is-warning','data-check':check.id});}
 }
 function render(next){
  if(!next?.certification)return;
  const firstForJob=snapshot?.jobId!==next.jobId||snapshot?.version!==next.version;
  snapshot={...next.certification,jobId:next.jobId,version:next.version};
  if(firstForJob){
   const profile=snapshot.profile||{};
   $('#certification-confirm').checked=Boolean(profile.place);
   $('#certification-source-form').value=profile.sourceForm||'attached-original';
   $('#certification-excerpt').checked=false;
   for(const input of document.querySelectorAll('input[name="certification-route"]'))input.checked=input.value===(profile.route||'paper');
   downloaded=false;$('#certification-checklist').hidden=true;
  }
  renderPreview();
 }
 function afterDownload(){
  downloaded=true;const current=choices(),steps=$('#certification-steps'),abroad=$('#certification-abroad');
  steps.replaceChildren(...COPY[current.route==='electronic'?'electronic':'paper'].map(row=>element('li',row[locale()])));
  abroad.replaceChildren(...COPY.abroad.map(row=>element('li',row[locale()])));
  $('#certification-abroad-details').hidden=current.route==='electronic';
  $('#certification-checklist').hidden=false;
 }

 async function loadProfile(){const response=await localRequest('/api/settings');const data=await response.json();languages=data.settings?.certifiableLanguages||[];return data.settings?.certification||{};}
 async function openProfile(){
  const dialog=$('#certification-settings-dialog');if(!dialog)return;
  $('#ai-settings-dialog')?.open&&$('#ai-settings-dialog').close();
  $('#certification-settings-error').textContent='';
  try{
   const profile=await loadProfile();
   $('#certification-place').value=profile.place||'';
   $('#certification-bilingual').checked=profile.bilingual!==false;
   $('#certification-default-form').value=profile.sourceForm||'attached-original';
   for(const input of document.querySelectorAll('input[name="certification-default-route"]'))input.checked=input.value===(profile.route||'paper');
   $('#certification-languages').replaceChildren(...languages.map(language=>{const label=element('label',undefined,{class:'check-label'}),input=element('input',undefined,{type:'checkbox',value:language});input.checked=(profile.languages||[]).includes(language);label.append(input,' ',languageName(language));return label;}));
  }catch(error){$('#certification-settings-error').textContent=error.message;}
  dialog.showModal();$('#certification-place').focus();
 }
 async function saveProfile(event){
  event.preventDefault();
  const certification={place:$('#certification-place').value,languages:[...document.querySelectorAll('#certification-languages input:checked')].map(input=>input.value),bilingual:$('#certification-bilingual').checked,sourceForm:$('#certification-default-form').value,route:document.querySelector('input[name="certification-default-route"]:checked')?.value||'paper'};
  try{
   const response=await localRequest('/api/settings',{certification});const data=await response.json();
   $('#certification-settings-dialog').close();if(typeof toast==='function')toast(t('saved'));
   if(snapshot){snapshot.profile=data.settings.certification;$('#certification-confirm').checked=Boolean(snapshot.profile.place);}
   if(typeof loadReview==='function'&&!$('#review-view')?.hidden)await loadReview(true);else renderPreview();
  }catch(error){$('#certification-settings-error').textContent=error.message;}
 }

 document.addEventListener('DOMContentLoaded',()=>{
  for(const selector of ['#certification-confirm','#certification-source-form','#certification-excerpt'])$(selector)?.addEventListener('change',()=>{renderPreview();if(downloaded)afterDownload();});
  for(const input of document.querySelectorAll('input[name="certification-route"]'))input.addEventListener('change',()=>{renderPreview();if(downloaded)afterDownload();});
  $('#certification-profile-open')?.addEventListener('click',()=>void openProfile());
  $('#certification-settings-open')?.addEventListener('click',()=>void openProfile());
  $('#certification-settings-form')?.addEventListener('submit',event=>void saveProfile(event));
  window.addEventListener('translateocr-locale',()=>{renderPreview();if(downloaded)afterDownload();});
  $('#certification-settings-dialog')?.querySelector('.guide-dialog-close')?.addEventListener('click',()=>$('#certification-settings-dialog').close());
 });
 window.TOCRCertification={render,choices,afterDownload,openProfile};
})();
