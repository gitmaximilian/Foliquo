// Simple and professional modes. Simple shows translate, archive and "Mein Stil"; the professional tools
// (rules, terms, dossiers, jobs, guide) are only hidden, never removed. The style area is one view with
// sections that the navigation selects.
(()=>{
 const root=document.documentElement,KEY='foliquo-ui-mode',SECTIONS=['style','rules','terms','dossiers'];
 const t=value=>window.TOCRI18n?.t(value)||value;
 const headings={
  style:['Mein Stil','Leg eine fertige Übersetzung von dir ab. Foliquo übernimmt Aufbau und Schreibweisen für ähnliche Dokumente.'],
  rules:['Regeln','Regeln wirken erst, wenn du sie freigibst. Du kannst sie jederzeit ausschalten.'],
  terms:['Begriffe','Feste Übersetzungen für Fachbegriffe und Namen. Foliquo verwendet sie nur im passenden Sprachpaar.'],
  dossiers:['Dossiers','Bestätigte Angaben zu Personen. Sie gelten nur, wenn du ein Dossier beim Auftrag auswählst.']
 };
 let mode='simple',section='style',currentView='studio';
 const store=value=>{try{localStorage.setItem(KEY,value);}catch{}};
 const stored=()=>{try{return localStorage.getItem(KEY);}catch{return null;}};

 function apply(next,{announce=true}={}){
  mode=next==='pro'?'pro':'simple';root.dataset.uiMode=mode;store(mode);
  const toggle=document.getElementById('ui-mode-pro');if(toggle)toggle.checked=mode==='pro';
  if(mode==='simple'&&section!=='style'&&currentView==='workspace')setSection('style');
  updateNav();
  if(announce)window.dispatchEvent(new CustomEvent('foliquo-ui-mode',{detail:{mode}}));
 }
 function updateHeading(){
  const [title,subtitle]=headings[section]||headings.style,heading=document.getElementById('workspace-title'),copy=document.getElementById('workspace-subtitle');
  if(heading){heading.dataset.noTranslate='';heading.textContent=t(title);}
  if(copy){copy.dataset.noTranslate='';copy.textContent=t(subtitle);}
 }
 function updateNav(){
  for(const button of document.querySelectorAll('.app-header [data-view]')){
   const active=button.dataset.view===currentView&&(!button.dataset.section||button.dataset.section===section);
   button.classList.toggle('active',active);
   if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  }
 }
 function setSection(name){
  section=SECTIONS.includes(name)?name:'style';
  const workspace=document.getElementById('workspace-view');
  window.TOCRRules?.showTab?.(section==='rules'?'rules':'samples');
  if(workspace)workspace.dataset.section=section;
  updateHeading();updateNav();
  window.dispatchEvent(new CustomEvent('foliquo-style-section',{detail:{section}}));
 }
 // Navigation buttons that open a section choose it before app.js switches the view.
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('button[data-view="workspace"]');
  if(button)setSection(button.dataset.section||'style');
 },true);
 window.addEventListener('translateocr-view-change',event=>{currentView=event.detail?.view||'studio';setTimeout(updateNav,0);});
 window.addEventListener('translateocr-locale',updateHeading);

 async function save(next){
  const error=document.getElementById('ui-mode-error');if(error)error.textContent='';
  const previous=mode;apply(next);
  if(typeof window.saveUserPreferences!=='function')return;
  try{await window.saveUserPreferences({...(typeof userPreferences==='object'&&userPreferences?userPreferences:{}),uiMode:mode});}
  catch(failure){apply(previous);if(error)error.textContent=failure?.message||t('Die Ansicht konnte nicht gespeichert werden.');}
 }
 function init(preferences={}){apply(preferences.uiMode||stored()||'simple');}

 apply(stored()||'simple',{announce:false});
 const ready=()=>{
  document.getElementById('ui-mode-pro')?.addEventListener('change',event=>void save(event.target.checked?'pro':'simple'));
  const workspace=document.getElementById('workspace-view');if(workspace&&!workspace.dataset.section)workspace.dataset.section=section;
  // The rules page heading is the page title; Foli's draft button joins the rule actions.
  const ruleHeading=document.querySelector('#personal-rules-panel>.card-heading'),ask=document.getElementById('style-ask-foli');
  if(ruleHeading&&ask){ruleHeading.classList.add('rule-panel-actions');ruleHeading.prepend(ask);}
  updateHeading();apply(mode,{announce:false});
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
 window.TOCRMode={init,apply,save,setSection,get mode(){return mode;},get section(){return section;}};
})();
