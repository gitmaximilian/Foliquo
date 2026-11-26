// "Immer so schreiben": after a direct text correction, offer once to remember short replacements
// (names, terms) as a personal wording rule for the same target language. Nothing is saved without a click.
(()=>{
 const t=value=>window.TOCRI18n?.t(value)||value,fill=(text,values)=>Object.entries(values).reduce((out,[key,value])=>out.replaceAll(`{${key}}`,String(value)),t(text));
 const $=selector=>document.querySelector(selector),node=(tag,text='',className='')=>{const element=document.createElement(tag);if(text)element.textContent=text;if(className)element.className=className;return element;};
 const MAX_TOKENS=6,MAX_CHARS=80,MAX_OFFERS=3;
 let baseline=null,panel=null;

 // Word-level change per line: strip the common start and end, keep what differs in between.
 function changes(before,after){
  const a=before.split('\n'),b=after.split('\n');if(a.length!==b.length)return [];
  const found=[];
  for(let index=0;index<a.length;index++){
   if(a[index]===b[index])continue;
   const x=a[index].split(/(\s+)/),y=b[index].split(/(\s+)/);let start=0;
   while(start<x.length&&start<y.length&&x[start]===y[start])start++;
   let endX=x.length-1,endY=y.length-1;while(endX>=start&&endY>=start&&x[endX]===y[endY]){endX--;endY--;}
   const from=x.slice(start,endX+1).join('').trim(),to=y.slice(start,endY+1).join('').trim();
   const words=value=>value.split(/\s+/).filter(Boolean).length;
   if(!from||!to||from===to||words(from)>MAX_TOKENS||words(to)>MAX_TOKENS||from.length>MAX_CHARS||to.length>MAX_CHARS)return [];
   if(!/\p{L}/u.test(from+to)||/^\p{N}[\p{N}\s.,:/-]*$/u.test(to))continue;
   if(!found.some(item=>item.from===from&&item.to===to))found.push({from,to});
   if(found.length>MAX_OFFERS)return [];
  }
  return found;
 }
 function close(){panel?.remove();panel=null;}
 async function remember(item,targetLanguage){
  const text=fill('Schreibe „{to}“ statt „{from}“.',item),title=fill('„{to}“ statt „{from}“',item).slice(0,120);
  const response=await localRequest('/api/personal-rules/proposals',{requestId:crypto.randomUUID(),definition:{title,titleMode:'custom',effect:{kind:'style',text},scope:targetLanguage?{targetLanguage}:{}}});
  const {proposal}=await response.json();
  await localRequest('/api/personal-rules/review',{id:proposal.id,version:proposal.version,accept:true});
  window.dispatchEvent(new CustomEvent('foliquo-rules-changed'));window.TOCRRules?.refresh?.();
 }
 function offer(items,targetLanguage){
  close();if(!items.length)return;
  panel=node('aside','','remember-spelling');panel.id='remember-spelling';panel.dataset.noTranslate='';panel.setAttribute('aria-labelledby','remember-spelling-title');
  const head=node('div','','remember-spelling-head'),title=node('h2',t('Immer so schreiben?'));title.id='remember-spelling-title';
  const dismiss=node('button','✕','remember-spelling-close');dismiss.type='button';dismiss.setAttribute('aria-label',t('Schließen'));dismiss.onclick=close;
  head.append(title,dismiss);panel.append(head,node('p',targetLanguage?fill('Foliquo merkt sich deine Schreibweise für künftige Übersetzungen ins {language}.',{language:window.TOCRRules?.languageName(targetLanguage)||targetLanguage}):t('Foliquo merkt sich deine Schreibweise für künftige Übersetzungen.'),'muted'));
  const list=node('ul','','remember-spelling-list');
  for(const item of items){
   const row=node('li'),change=node('p','','remember-spelling-change');change.append(node('del',item.from),document.createTextNode(' → '),node('strong',item.to));
   const actions=node('div','','remember-spelling-actions'),keep=node('button',t('Immer so schreiben'),'primary'),once=node('button',t('Nur hier'),'secondary');keep.type=once.type='button';
   const status=node('p','','muted remember-spelling-status');status.setAttribute('role','status');
   const done=message=>{actions.remove();status.textContent=message;if(![...list.querySelectorAll('.remember-spelling-actions')].length)setTimeout(()=>{if(panel&&!panel.contains(document.activeElement))close();},2400);};
   keep.onclick=async()=>{keep.disabled=once.disabled=true;try{await remember(item,targetLanguage);done(t('Gemerkt. Du findest es unter Mein Stil.'));}catch(error){keep.disabled=once.disabled=false;status.textContent=error.message||t('Das hat nicht geklappt. Versuch es noch einmal.');}};
   once.onclick=()=>done(t('Nur in diesem Dokument geändert.'));
   actions.append(keep,once);row.append(change,actions,status);list.append(row);
  }
  panel.append(list);document.body.append(panel);panel.querySelector('.primary')?.focus({preventScroll:true});
 }

 const dialog=$('#direct-edit-dialog'),text=$('#direct-text');
 if(!dialog||!text)return;
 new MutationObserver(()=>{if(dialog.open)baseline={value:text.value,jobId:typeof reviewJobId!=='undefined'?reviewJobId:null};}).observe(dialog,{attributes:true,attributeFilter:['open']});
 $('#direct-save')?.addEventListener('click',()=>{
  if(!baseline||text.closest('label')?.hidden)return;
  const before=baseline.value,after=text.value,id=typeof reviewJobId!=='undefined'?reviewJobId:null,version=typeof reviewData!=='undefined'?reviewData?.version:null;
  const items=changes(before,after);if(!items.length||!id)return;
  const started=Date.now(),timer=setInterval(()=>{
   if(typeof reviewJobId==='undefined'||reviewJobId!==id||Date.now()-started>30000){clearInterval(timer);return;}
   if(reviewData?.version>version){clearInterval(timer);baseline={value:after,jobId:id};offer(items,reviewData.targetLanguage||'');}
  },300);
 },true);
 window.addEventListener('translateocr-view-change',event=>{if(event.detail?.view!=='review')close();});
 window.TOCRRememberSpelling={changes,offer};
})();
