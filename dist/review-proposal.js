// Shows a requested change directly below the change form: before/after per changed passage, protected values it
// touches, and one decision (apply or discard). Applying confirms exactly the protected values listed here.
(()=>{
 const $=selector=>document.querySelector(selector);
 const index=()=>{const locale=window.TOCRI18n?.getLocale?.()||document.documentElement.lang||'de';return locale==='en'?0:locale==='ar'?2:1;};
 const COPY={
  title:['Suggested change','Vorgeschlagene Änderung','التغيير المقترح'],
  intro:['Check each passage. Only ticked passages are applied.','Prüfe jede Stelle. Nur angehakte Stellen werden übernommen.','راجع كل موضع. لا يُطبَّق إلا ما تم تحديده.'],
  before:['Before','Vorher','قبل'],
  after:['After','Nachher','بعد'],
  removed:['(removed)','(entfernt)','(محذوف)'],
  added:['(new)','(neu)','(جديد)'],
  include:['Apply this passage','Diese Stelle übernehmen','تطبيق هذا الموضع'],
  protected:['This changes confirmed values: {list}. Applying confirms the new values.','Dabei ändern sich bestätigte Angaben: {list}. Mit „Übernehmen“ bestätigst du die neuen Werte.','يتغيّر بذلك بيانات مؤكدة: {list}. بالتطبيق تؤكد القيم الجديدة.'],
  apply:['Apply','Übernehmen','تطبيق'],
  applySome:['Apply {count} of {total}','{count} von {total} übernehmen','تطبيق {count} من {total}'],
  discard:['Discard','Verwerfen','تجاهل'],
  none:['Select at least one passage or discard the suggestion.','Wähle mindestens eine Stelle oder verwirf den Vorschlag.','اختر موضعًا واحدًا على الأقل أو تجاهل الاقتراح.'],
  applied:['Applied as version {version}.','Als Version {version} übernommen.','طُبّق كنسخة {version}.'],
  discarded:['Suggestion discarded. The current version stays unchanged.','Vorschlag verworfen. Die aktuelle Fassung bleibt unverändert.','تم تجاهل الاقتراح. تبقى النسخة الحالية دون تغيير.'],
  noChange:['This suggestion changes layout or formatting only; the text stays the same.','Dieser Vorschlag ändert nur Layout oder Formatierung; der Text bleibt gleich.','يغيّر هذا الاقتراح التخطيط أو التنسيق فقط؛ يبقى النص كما هو.'],
 };
 const t=(key,values={})=>COPY[key][index()].replace(/\{(\w+)\}/g,(_,name)=>values[name]??'');
 const node=(tag,text,className)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(className)element.className=className;return element;};
 let current=null,working=false,lastSnapshot=null;

 function selected(){return [...document.querySelectorAll('#review-proposal-inline [data-proposal-change]:checked')].map(input=>input.dataset.proposalChange);}
 function updateButton(){const host=$('#review-proposal-inline'),apply=host?.querySelector('[data-proposal-apply]');if(!apply||!current)return;const total=current.changes.length,count=selected().length;apply.textContent=count===total?t('apply'):t('applySome',{count,total});apply.disabled=working||Boolean(total&&!count);host.querySelector('.review-proposal-hint').hidden=Boolean(count||!total);}

 function render(snapshot){
  const host=$('#review-proposal-inline');if(!host)return;lastSnapshot=snapshot;
  const proposal=snapshot?.proposal,changes=(proposal?.changes||[]).filter(change=>change.id);
  const banner=$('#review-proposal');if(banner)banner.hidden=!proposal;
  if(!proposal){current=null;host.hidden=true;host.replaceChildren();return;}
  const signature=JSON.stringify([snapshot.jobId,snapshot.version,changes.map(change=>change.id),index()]);
  if(current?.signature===signature&&!host.hidden)return updateButton();
  current={signature,changes,jobId:snapshot.jobId,version:snapshot.version};
  const heading=node('h3',t('title'));heading.id='review-proposal-inline-title';
  const list=node('ol','','review-proposal-list');
  for(const change of changes){
   const item=node('li','','review-proposal-change'),label=node('label','','check-label'),input=document.createElement('input');
   input.type='checkbox';input.checked=true;input.dataset.proposalChange=change.id;input.addEventListener('change',updateButton);label.append(input,' ',t('include'));
   const before=node('div','','review-proposal-before'),after=node('div','','review-proposal-after');
   before.append(node('span',t('before'),'eyebrow'),node('p',change.before||t('added')));
   after.append(node('span',t('after'),'eyebrow'),node('p',change.after||t('removed')));
   for(const box of [before,after])box.querySelector('p').dir='auto';
   item.append(label,node('div','','review-proposal-compare'));item.lastChild.append(before,after);list.append(item);
  }
  const parts=[heading,node('p',changes.length?t('intro'):t('noChange'),'muted'),list];
  if(proposal.protectedConflicts?.length)parts.push(node('p',t('protected',{list:proposal.protectedConflicts.map(field=>`${field.label}`).join(', ')}),'review-proposal-protected'));
  const hint=node('p',t('none'),'review-proposal-hint');hint.hidden=true;
  const actions=node('div','','review-proposal-actions'),apply=node('button',t('apply'),'primary'),discard=node('button',t('discard'),'secondary');
  apply.type=discard.type='button';apply.dataset.proposalApply='';discard.dataset.proposalDiscard='';
  apply.onclick=()=>void decide('accept');discard.onclick=()=>void decide('reject');
  actions.append(apply,discard);parts.push(hint,actions);
  host.replaceChildren(...parts);host.hidden=false;updateButton();
 }

 async function decide(action){
  if(working||!current)return;const accepted=selected();if(action==='accept'&&current.changes.length&&!accepted.length)return updateButton();
  working=true;updateButton();const error=$('#review-error');if(error)error.textContent='';
  try{
   const response=await localRequest(`/api/jobs/${current.jobId}/revision`,action==='accept'?{action,version:current.version,accepted,confirmProposalFields:true}:{action,version:current.version});
   const snapshot=await response.json();
   if(typeof toast==='function')toast(action==='accept'?t('applied',{version:snapshot.version}):t('discarded'));
   if(typeof loadReview==='function')await loadReview(true);
  }catch(failure){if(error)error.textContent=failure.message;}
  finally{working=false;updateButton();}
 }

 function focus(){const host=$('#review-proposal-inline');if(!host||host.hidden)return;host.scrollIntoView({block:'center',behavior:'smooth'});host.focus({preventScroll:true});}
 document.addEventListener('DOMContentLoaded',()=>{$('#review-proposal-open')?.addEventListener('click',focus);});
 window.addEventListener('translateocr-locale',()=>{if(current){const host=$('#review-proposal-inline');current.signature='';if(host&&!host.hidden&&lastSnapshot)render(lastSnapshot);}});
 window.TOCRReviewProposal={render,focus};
})();
