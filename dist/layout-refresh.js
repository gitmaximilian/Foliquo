// 0.20 layout refresh: small structural moves that keep every element and id, so existing behaviour stays.
(()=>{
 const $=selector=>document.querySelector(selector),root=document.documentElement;
 const t=value=>window.TOCRI18n?.t(value)||value;

 // The current view is exposed for styling (for example: the footer only on the start page).
 window.addEventListener('translateocr-view-change',event=>{root.dataset.view=event.detail?.view||'studio';});
 root.dataset.view||='studio';

 // Mein Stil: the provider note sits inside the drop area; "KI einrichten" reads as a link.
 function arrangeStyle(){
  const drop=$('#workspace-view .learning-drop .learning-upload-copy'),note=$('#learning-provider-note'),ai=$('#learning-ai-open');
  if(drop&&note&&note.parentElement!==drop){note.classList.add('learning-drop-note');drop.append(note);}
  if(ai){ai.classList.remove('secondary');ai.classList.add('text-button','learning-ai-link');}
 }

 // Foli: the conversation picker appears once there is more than one chat; the examples sit above the message field.
 function arrangeFoli(){
  const view=$('#foli-view');if(!view)return;
  const select=$('#foli-conversations'),toolbar=select?.closest('.foli-toolbar'),form=view.querySelector('form.foli-form'),examples=view.querySelector('.foli-examples');
  if(examples&&form&&examples.nextElementSibling!==form)form.before(examples);
  if(toolbar&&select){const single=select.options.length<=1;toolbar.classList.toggle('is-single-chat',single);}
  const rules=[...view.querySelectorAll('.card-heading > button')].find(button=>button.closest('.card-heading')?.parentElement===view);if(rules)rules.dataset.proOnly='';
 }
 // Prüfen: documents first, then the check list with a side column (Beglaubigung, download) that stays in view.
 const certificationCopy={de:{change:'Ändern',done:'Fertig',off:'Ohne Beglaubigungsklausel',excerpt:'Auszug'},en:{change:'Change',done:'Done',off:'Without certification clause',excerpt:'Excerpt'},ar:{change:'تغيير',done:'تم',off:'بدون صيغة التصديق',excerpt:'مقتطف'}};
 const cc=key=>(certificationCopy[root.lang]||certificationCopy.en)[key];
 function certificationSummary(){
  const panel=$('#certification-panel');if(!panel)return;
  let line=panel.querySelector('.certification-summary');
  if(!line){
   line=document.createElement('div');line.className='certification-summary';line.dataset.noTranslate='';
   const text=document.createElement('p');text.className='certification-summary-text';
   const toggle=document.createElement('button');toggle.type='button';toggle.className='text-button certification-summary-toggle';toggle.setAttribute('aria-controls','certification-options');
   toggle.onclick=()=>{panel.classList.toggle('is-expanded');certificationSummary();};
   line.append(text,toggle);panel.querySelector('.certification-head')?.after(line);
   panel.addEventListener('change',()=>certificationSummary());
  }
  const confirm=$('#certification-confirm'),source=$('#certification-source-form'),route=panel.querySelector('.certification-route input:checked')?.closest('label'),excerpt=$('#certification-excerpt');
  const parts=confirm&&!confirm.checked?[cc('off')]:[route?.textContent.trim(),source?.selectedOptions[0]?.textContent.trim(),excerpt?.checked?cc('excerpt'):''].filter(Boolean);
  line.querySelector('.certification-summary-text').textContent=parts.join(' · ');
  const expanded=panel.classList.contains('is-expanded'),missing=Boolean(confirm?.checked&&panel.querySelector('.certification-missing:not([hidden])'));
  panel.classList.toggle('needs-setup',missing);
  const toggle=line.querySelector('.certification-summary-toggle');toggle.textContent=cc(expanded?'done':'change');toggle.setAttribute('aria-expanded',String(expanded||missing));
 }
 function arrangeReview(){
  const view=$('#review-view');if(!view)return;
  const layout=view.querySelector('.review-layout'),guide=$('#review-guide'),final=$('#review-final'),cert=$('#certification-panel'),steps=$('#review-steps');
  if(steps&&view.firstElementChild!==steps)view.prepend(steps);
  let finish=view.querySelector('.review-finish');
  if(!finish&&layout){finish=document.createElement('div');finish.className='review-finish';const aside=document.createElement('aside');aside.className='review-finish-aside';finish.append(aside);layout.after(finish);}
  if(finish){const aside=finish.querySelector('.review-finish-aside');
   if(guide&&guide.parentElement!==finish)finish.prepend(guide);
   if(cert&&cert.parentElement!==aside)aside.append(cert);
   if(final&&final.parentElement!==aside)aside.append(final);
   if(cert&&final&&cert.nextElementSibling!==final)cert.after(final);}
  const edit=$('#review-edit-open'),actions=document.querySelector('.review-heading-actions');
  if(edit&&actions&&edit.parentElement!==actions){edit.classList.add('secondary');actions.prepend(edit);}
  const rules=$('#review-rule-options');if(rules)rules.dataset.proOnly='';
  if(guide){
   for(const item of guide.querySelectorAll(':scope>details')){const summary=item.querySelector(':scope>summary')?.textContent||'';item.toggleAttribute('data-empty',!item.querySelector('.review-guide-check')&&/(?:·|:)\s*0\s*$/.test(summary.trim()));}
   const trace=guide.querySelector('.review-rule-trace');if(trace)trace.dataset.proOnly='';
   const tools=guide.querySelector(':scope>.rule-actions');if(tools)tools.dataset.proOnly='';
   const copy=guide.querySelector(':scope>.review-progress-copy');if(copy){copy.dataset.full??=copy.textContent;if(copy.dataset.full!==copy.textContent&&!copy.textContent.startsWith(copy.dataset.short||'\u0000'))copy.dataset.full=copy.textContent;const short=copy.dataset.full.split(' · ')[0];copy.dataset.short=short;copy.textContent=root.dataset.uiMode==='simple'?short:copy.dataset.full;}
  }
  certificationSummary();
 }
 function start(){
  arrangeStyle();arrangeFoli();arrangeReview();
  const review=$('#review-view');if(review)new MutationObserver(()=>arrangeReview()).observe(review,{childList:true});
  const guideHost=()=>$('#review-guide');let guideObserved=null;
  setInterval(()=>{const guide=guideHost();if(guide&&guide!==guideObserved){guideObserved=guide;new MutationObserver(()=>arrangeReview()).observe(guide,{childList:true});arrangeReview();}},1000);
  const conversations=$('#foli-conversations');if(conversations)new MutationObserver(arrangeFoli).observe(conversations,{childList:true});
  const foli=$('#foli-view');if(foli)new MutationObserver(()=>arrangeFoli()).observe(foli,{childList:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 window.addEventListener('translateocr-view-change',()=>setTimeout(()=>{arrangeStyle();arrangeFoli();arrangeReview();},0));window.addEventListener('translateocr-locale',()=>certificationSummary());
 window.TOCRLayout={arrangeStyle,arrangeFoli,arrangeReview};
})();
