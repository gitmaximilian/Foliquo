// "Mein Stil": what Foliquo learned from an example, applied with one button, and the habits it already
// follows, grouped by document type. Detailed rule review stays on the professional rules page.
(()=>{
 const t=value=>window.TOCRI18n?.t(value)||value,fill=(text,values)=>Object.entries(values).reduce((out,[key,value])=>out.replaceAll(`{${key}}`,String(value)),t(text));
 const $=selector=>document.querySelector(selector),node=(tag,text='',className='')=>{const element=document.createElement(tag);if(text)element.textContent=text;if(className)element.className=className;return element;};
 const api=async(path,data)=>(await localRequest(path,data)).json();
 const state={proposals:[],rules:[],profiles:[],glossary:[],excluded:new Map(),expanded:new Set(),busy:new Set(),ticket:0,error:''};
 let learnedHost,habitsHost,examplesHeading,timer;

 function mount(){
  const collection=$('#workspace-view .learning-collection');if(!collection||learnedHost)return Boolean(learnedHost);
  learnedHost=node('section','','my-style-learned');learnedHost.id='my-style-learned';learnedHost.dataset.noTranslate='';learnedHost.setAttribute('aria-live','polite');
  habitsHost=node('section','','my-style-habits');habitsHost.id='my-style-habits';habitsHost.dataset.noTranslate='';
  examplesHeading=node('h2','','my-style-examples-title');examplesHeading.id='my-style-examples-title';examplesHeading.dataset.noTranslate='';
  const anchor=$('#learning-upload-preflight')||$('#learning-status');anchor.after(learnedHost,habitsHost);
  const filters=collection.querySelector('.learning-filters');(filters||$('#learning-list')).before(examplesHeading);
  return true;
 }
 const entryFor=id=>(typeof learningEntries!=='undefined'?learningEntries:[]).find(entry=>entry.id===id);
 const capital=value=>{const text=String(value||'');return text?text[0].toLocaleUpperCase()+text.slice(1):text;};
 const language=value=>capital(window.TOCRRules?.languageName(value)||value);
 function documentType(value){
  if(!value)return t('Alle Dokumente');const named=window.TOCRRules?.documentTypeName(value);if(named&&named!==value)return named;
  const key=String(value).toLocaleLowerCase(),entry=(typeof learningEntries!=='undefined'?learningEntries:[]).find(item=>String(item.documentType||'').toLocaleLowerCase()===key);
  return entry?.documentType||capital(value);
 }
 function sampleId(proposal){const origins=proposal.definition?.origins||[];return origins.find(origin=>origin.kind==='sample')?.id||'';}
 function habitText(proposal){
  if(proposal.glossaryDraft)return `${proposal.glossaryDraft.source} → ${proposal.glossaryDraft.target}`;
  const effect=proposal.definition?.effect||proposal.target?.effect;
  if(effect?.kind==='terminology'){const term=state.glossary.find(item=>item.id===effect.glossaryId);if(term)return `${term.source} → ${term.target}`;}
  return effect?window.TOCRRules?.describeEffect(effect)||proposal.definition?.title||'':proposal.definition?.title||'';
 }
 function ruleText(rule){return window.TOCRRules?.describeEffect(rule.effect)||rule.title;}
 function scopeLine(scope={}){
  const pair=[scope.sourceLanguage,scope.targetLanguage].filter(Boolean).map(language).join(' → ');
  return [documentType(scope.documentType),pair].filter(Boolean).join(', ');
 }

 async function load(){
  if(typeof csrf==='undefined'||!csrf||!mount())return;const ticket=++state.ticket;
  try{
   const pending=[],rules=[];let profiles=[],glossary=[];
   for(let offset=0,more=true;more&&offset<500;offset+=100){const page=await api(`/api/personal-rules/proposals?status=pending&limit=100&offset=${offset}`);pending.push(...page.items);more=page.hasMore;}
   for(let offset=0,more=true;more&&offset<500;offset+=100){const page=await api(`/api/personal-rules?status=all&limit=100&offset=${offset}`);rules.push(...page.items);profiles=page.profiles||profiles;glossary.push(...(page.glossary||[]));more=page.hasMore;}
   if(ticket!==state.ticket)return;
   Object.assign(state,{proposals:pending.filter(proposal=>proposal.operation==='create'&&sampleId(proposal)),rules,profiles,glossary,error:''});
  }catch(error){if(ticket===state.ticket)state.error=error.message||t('Foliquo konnte deinen Stil nicht laden.');}
  render();
 }
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>void load(),120);};

 function render(){
  if(!mount())return;
  examplesHeading.textContent=t('Deine Beispiele');
  renderLearned();renderHabits();
 }
 function renderLearned(){
  learnedHost.replaceChildren();
  if(state.error){learnedHost.append(node('p',state.error,'error'));return;}
  const groups=new Map();for(const proposal of state.proposals){const id=sampleId(proposal);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(proposal);}
  for(const [id,items] of groups){
   const entry=entryFor(id),excluded=state.excluded.get(id)||new Set();state.excluded.set(id,excluded);
   const card=node('article','','my-style-learned-card');card.dataset.learnedSampleId=id;
   const head=node('div','','my-style-learned-head');head.append(node('h3',fill('Gelernt aus „{name}“',{name:entry?.name||t('deinem Beispiel')})));
   const scope=items[0]?.definition?.scope||{};const where=scopeLine({documentType:scope.documentType||entry?.documentType,sourceLanguage:scope.sourceLanguage||entry?.analysis?.sourceLanguage,targetLanguage:scope.targetLanguage||entry?.targetLanguage});
   if(where)head.append(node('p',fill('Gilt für {scope}',{scope:where}),'muted'));
   card.append(head);
   const list=node('ul','','my-style-habit-list');
   for(const proposal of items){
    const off=excluded.has(proposal.id),row=node('li','',off?'is-excluded':'');row.dataset.proposalId=proposal.id;
    const mark=node('span',off?'':'✓','my-style-check');mark.setAttribute('aria-hidden','true');
    const text=node('span',habitText(proposal),'my-style-habit-text');
    const strike=node('button',off?'↺':'✕','my-style-strike');strike.type='button';strike.setAttribute('aria-pressed',String(off));
    strike.setAttribute('aria-label',fill(off?'Wieder übernehmen: {habit}':'Nicht übernehmen: {habit}',{habit:habitText(proposal)}));
    strike.onclick=()=>{off?excluded.delete(proposal.id):excluded.add(proposal.id);renderLearned();learnedHost.querySelector(`[data-proposal-id="${CSS.escape(proposal.id)}"] .my-style-strike`)?.focus();};
    row.append(mark,text,strike);list.append(row);
   }
   card.append(list);
   const kept=items.length-excluded.size,actions=node('div','','my-style-learned-actions');
   const accept=node('button',kept===items.length?t('Übernehmen'):kept?fill('{count} von {total} übernehmen',{count:kept,total:items.length}):t('Nichts übernehmen'),'primary');accept.type='button';
   const discard=node('button',t('Verwerfen'),'text-button');discard.type='button';
   const busy=state.busy.has(id);accept.disabled=busy;discard.disabled=busy;
   const errorHost=node('p','','error');errorHost.setAttribute('role','alert');
   accept.onclick=()=>void decide(id,items,proposal=>!excluded.has(proposal.id),errorHost);
   discard.onclick=()=>void decide(id,items,()=>false,errorHost);
   actions.append(accept,discard,node('small',t('Persönliche Angaben aus dem Beispiel werden nicht übernommen.'),'muted'));
   card.append(actions,errorHost);learnedHost.append(card);
  }
 }
 async function decide(id,items,keep,errorHost){
  state.busy.add(id);renderLearned();
  try{
   const accepted=items.filter(keep);
   for(let index=0;index<items.length;index+=100)await localRequest('/api/personal-rules/review',{items:items.slice(index,index+100).map(proposal=>({id:proposal.id,version:proposal.version,accept:keep(proposal)}))});
   const entry=entryFor(id);if(accepted.length&&entry&&!entry.active)await localRequest('/api/learning/update',{id,active:true});
   state.excluded.delete(id);
   if(typeof toast==='function')toast(accepted.length?fill('{count} Gewohnheiten übernommen.',{count:accepted.length}):t('Vorschläge verworfen.'));
   window.TOCRRules?.refresh?.();if(typeof loadLibrary==='function')await loadLibrary();
  }catch(error){errorHost.textContent=error.message||t('Das hat nicht geklappt. Versuch es noch einmal.');}
  finally{state.busy.delete(id);await load();}
 }

 function groupsOfRules(){
  const groups=new Map();
  for(const rule of state.rules){if(rule.status==='deleted')continue;const key=rule.scope?.documentType||'';if(!groups.has(key))groups.set(key,{key,rules:[]});groups.get(key).rules.push(rule);}
  return [...groups.values()].sort((a,b)=>a.key?b.key?documentType(a.key).localeCompare(documentType(b.key)):-1:1);
 }
 const sourceActive=rule=>rule.independent||!rule.profileIds?.length||rule.profileIds.some(id=>state.profiles.some(profile=>profile.id===id&&profile.active));
 const ruleOn=rule=>rule.status==='active'&&sourceActive(rule);
 function renderHabits(){
  habitsHost.replaceChildren();const groups=groupsOfRules();
  if(!groups.length){if(!state.proposals.length){const empty=node('p',t('Noch nichts gelernt. Leg eine fertige Übersetzung ab, und Foliquo zeigt dir, was es daraus übernimmt.'),'muted my-style-empty');habitsHost.append(empty);}return;}
  habitsHost.append(node('h2',t('Was Foliquo schon beachtet'),'my-style-habits-title'));
  const grid=node('div','','my-style-habit-grid');
  for(const group of groups){
   const on=group.rules.filter(ruleOn).length,card=node('article','','my-style-habit-card'),id=`my-style-group-${group.key||'all'}`.replace(/[^a-z0-9-]/gi,'-');
   const pairs=[...new Set(group.rules.map(rule=>[rule.scope?.sourceLanguage,rule.scope?.targetLanguage].filter(Boolean).map(language).join(' → ')).filter(Boolean))];
   const head=node('div','','my-style-habit-head');
   const expand=node('button','','my-style-habit-expand');expand.type='button';expand.setAttribute('aria-expanded',String(state.expanded.has(group.key)));expand.setAttribute('aria-controls',id);
   expand.append(node('strong',documentType(group.key)),node('small',[pairs.slice(0,2).join(', '),fill(group.rules.length===1?'{count} Gewohnheit':'{count} Gewohnheiten',{count:group.rules.length})].filter(Boolean).join(' · ')));
   expand.onclick=()=>{state.expanded.has(group.key)?state.expanded.delete(group.key):state.expanded.add(group.key);renderHabits();habitsHost.querySelector(`[aria-controls="${id}"]`)?.focus();};
   const toggle=node('label','','switch-control'),input=document.createElement('input');input.type='checkbox';input.setAttribute('role','switch');input.checked=on>0;input.disabled=state.busy.has('group:'+group.key);
   input.setAttribute('aria-label',fill('{group} verwenden',{group:documentType(group.key)}));input.onchange=()=>void switchGroup(group,input.checked);
   toggle.append(input,node('span','','switch-track'));head.append(expand,toggle);card.append(head);
   const list=node('ul','','my-style-habit-rules');list.id=id;list.hidden=!state.expanded.has(group.key);
   for(const rule of group.rules){const item=node('li',ruleText(rule),ruleOn(rule)?'':'is-off');list.append(item);}
   card.append(list);grid.append(card);
  }
  habitsHost.append(grid);
  if(document.documentElement.dataset.uiMode!=='pro')habitsHost.append(node('p',t('Einzelne Regeln, Begriffe und Dossiers findest du in den Profi-Werkzeugen unter Einstellungen.'),'muted my-style-pro-hint'));
 }
 async function switchGroup(group,enable){
  const key='group:'+group.key;state.busy.add(key);renderHabits();
  try{
   for(const rule of group.rules){
    if(rule.status==='deleted'||(rule.status==='active')===enable)continue;
    const {proposal}=await api('/api/personal-rules/proposals',{requestId:crypto.randomUUID(),operation:enable?'enable':'disable',targetId:rule.id,targetVersion:rule.version});
    await localRequest('/api/personal-rules/review',{id:proposal.id,version:proposal.version,accept:true});
   }
   if(enable)for(const id of new Set(group.rules.filter(rule=>!sourceActive(rule)).flatMap(rule=>rule.profileIds||[])))if(state.profiles.some(profile=>profile.id===id&&profile.ready&&!profile.active))await localRequest('/api/learning/update',{id,active:true});
   window.TOCRRules?.refresh?.();if(enable&&typeof loadLibrary==='function')await loadLibrary();
  }catch(error){state.error=error.message;}
  finally{state.busy.delete(key);await load();}
 }

 window.addEventListener('foliquo-rules-changed',schedule);window.addEventListener('translateocr-locale',render);window.addEventListener('foliquo-ui-mode',render);
 window.addEventListener('translateocr-view-change',event=>{if(event.detail?.view==='workspace')schedule();});
 if(typeof window.renderLearning==='function'){const original=window.renderLearning;window.renderLearning=function(...args){const result=original.apply(this,args);schedule();return result;};}
 window.TOCRMyStyle={refresh:load};
})();
