let jobsPanelOpen=false,jobsPanelPreferenceSaved=false;let featuredJobId='';try{featuredJobId=sessionStorage.getItem('translateocr-featured-job')||'';}catch{}
try{const savedJobsPanelState=sessionStorage.getItem('translateocr-jobs-open-v2');if(savedJobsPanelState!==null){jobsPanelPreferenceSaved=true;jobsPanelOpen=savedJobsPanelState==='true';}}catch{}
function setJobsPanel(open,restoreFocus=false,{persist=true}={}){
 jobsPanelOpen=Boolean(open);
 const rail=$('#queue-rail'),button=$('#jobs-open');
 document.querySelector('.workspace-layout').classList.toggle('jobs-open',jobsPanelOpen);
 rail.inert=!jobsPanelOpen;rail.setAttribute('aria-hidden',String(!jobsPanelOpen));
 button.setAttribute('aria-expanded',String(jobsPanelOpen));
 if(persist)try{sessionStorage.setItem('translateocr-jobs-open-v2',String(jobsPanelOpen));jobsPanelPreferenceSaved=true;}catch{}
 if(!jobsPanelOpen&&restoreFocus)button.focus({preventScroll:true});
}
$('#jobs-open').onclick=()=>setJobsPanel(!jobsPanelOpen);
$('#jobs-close').onclick=()=>setJobsPanel(false,true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&jobsPanelOpen&&!document.querySelector('dialog[open],#onboarding:not([hidden])')){setJobsPanel(false,true);event.preventDefault();}});
setJobsPanel(jobsPanelOpen,false,{persist:jobsPanelPreferenceSaved});
function renderJobsHeader(){
 const state=queueHeaderStatus(queueState.jobs,queueState.paused),button=$('#jobs-open'),progress=$('#jobs-header-progress');
 button.dataset.tone=state.tone;button.classList.toggle('is-processing',state.working);
 progress.hidden=!state.working;progress.textContent=state.working?'…':'';
 const status=$('#jobs-header-status');if(status.dataset.status!==state.label){status.dataset.status=state.label;status.textContent=state.label;}
}
let queueMutationVersion=0;
let queueState={jobs:[],paused:false},queueSubmitting=false,queuePollTimer=null,queuePolling=false,queueLoaded=false,queueLastAnnouncement='',questionNoticeKeys=new Set();
let clarificationJobId=null,clarificationFocusJobId=null,clarificationSignature='',clarificationSubmitting=false,questionOriginalReady=Promise.resolve();
const queueSnapshots=new Map(),queueResultCache=new Map(),queueAutoFetching=new Set();
let queueRowNodes=new Map();
function savedSession(key,fallback){try{const value=sessionStorage.getItem(key);if(value)return JSON.parse(value);const result=fallback();sessionStorage.setItem(key,JSON.stringify(result));return result;}catch{return fallback();}}
const queueClientId=savedSession('translateocr-queue-client',()=>crypto.randomUUID());
const queueDownloaded=new Set(savedSession('translateocr-queue-downloads',()=>[])),queueAnnounced=new Set(savedSession('translateocr-queue-announced',()=>[]));
function markDownloaded(id){queueDownloaded.add(id);try{sessionStorage.setItem('translateocr-queue-downloads',JSON.stringify([...queueDownloaded].slice(-100)));}catch{}}
function markCompletionAnnounced(id){queueAnnounced.add(id);try{sessionStorage.setItem('translateocr-queue-announced',JSON.stringify([...queueAnnounced].slice(-100)));}catch{}}
function queueText(key,values={}){let text=window.TOCRI18n?.t(key)||key;for(const [name,value]of Object.entries(values))text=text.replaceAll(`{${name}}`,String(value));return text;}
function duration(seconds){const n=Math.max(0,Math.round(seconds));return n<60?`${n} Sek.`:`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')} Min.`;}
const providerLabels={chatgpt:'ChatGPT',openai:'OpenAI API',anthropic:'Claude API',deepseek:'DeepSeek API'};
const phaseLabels={preparing:'Dokumente werden vorbereitet',translating:'Modell prüft und übersetzt',pdf:'Deine PDF wird erstellt',word:'Deine Word-Datei wird erstellt',queued:'Wartet',done:'Fertig'};
function queueButton(text,action,job){const b=document.createElement('button');b.type='button';b.className='text-button';b.dataset.queueAction=action;b.dataset.jobId=job.id;if(action==='cancel'||action==='remove'){b.classList.add('job-management');const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');icon.innerHTML=action==='remove'?'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7"/>':'<circle cx="12" cy="12" r="9"/><path d="m8 8 8 8m0-8-8 8"/>';b.append(icon);}const label=document.createElement('span');label.textContent=text;b.append(label);b.onclick=async event=>{b.disabled=true;b.setAttribute('aria-busy','true');try{await queueAction(action,job,event.currentTarget);}finally{if(b.isConnected){b.disabled=false;b.removeAttribute('aria-busy');}}};return b;}

function updateQueueButton(){
 const button=$('#translate');if(!button)return;const batchMode=$('#batch-mode')?.checked===true,groups=batchMode?window.selectedImportGroups?.(files)||[]:[];
 button.disabled=Boolean(window.fileIntakePending)||queueSubmitting||!files.length||batchMode&&groups.length<2||!providerReady||!$('#model').value||window.isLanguagePairValid?.()===false;
 button.textContent=queueSubmitting?'Wird hinzugefügt …':batchMode?queueText('Stapel vorbereiten · {count}',{count:groups.length}):queueState.jobs.some(j=>['queued','running','cancelling'].includes(j.status))?'Zur Warteschlange +':'Übersetzen';
 const note=$('#composer-note');if(note)note.dataset.empty=String(!files.length&&!window.fileIntakePending);const provider=window.translateProviderContextState?.providerName||'';if(note)note.textContent=window.fileIntakePending?(window.TOCRI18n?.t('Dateien werden geprüft …')||'Dateien werden geprüft …'):!files.length?'Dateien hinzufügen, um zu starten.':batchMode?(window.TOCRI18n?.t('Ordne die Dateien den Aufträgen zu. Gleiche Auftragsnummern werden gemeinsam vorbereitet; die ersten acht starten in einer Welle.')||'Ordne die Dateien den Aufträgen zu. Gleiche Auftragsnummern werden gemeinsam vorbereitet; die ersten acht starten in einer Welle.') :window.isLanguagePairValid?.()===false?(window.TOCRI18n?.t('Ausgangs- und Zielsprache müssen unterschiedlich sein.')||'Ausgangs- und Zielsprache müssen unterschiedlich sein.'):!providerReady||!$('#model').value?(window.TOCRI18n?.t('KI einrichten, um zu übersetzen.')||'KI einrichten, um zu übersetzen.'):(window.TOCRI18n?.t('Die ausgewählten Dateien werden an {provider} gesendet. Das PDF enthält die Originalseiten; Word die bearbeitbare Übersetzung.')||'Die ausgewählten Dateien werden an {provider} gesendet. Das PDF enthält die Originalseiten; Word die bearbeitbare Übersetzung.').replace('{provider}',provider);
}
function updateQueueLiveAnnouncement(force=false){
  const jobs=queueState.jobs,active=jobs.find(j=>['running','cancelling'].includes(j.status)),pending=jobs.filter(j=>['queued','running','cancelling'].includes(j.status));
 for(const job of jobs.filter(j=>j.status==='awaiting_answers'&&j.questions?.length)){const key=job.id+':'+job.questions.map(q=>q.id).join(',');if(!questionNoticeKeys.has(key)){questionNoticeKeys.add(key);if(clarificationJobId!==job.id)toast('Antworten werden benötigt.',{label:'Rückfragen beantworten',onClick:()=>showClarifications(job,true)});}}
 const announcement=`${active?.id||''}:${active?.stage||''}:${pending.length}:${jobs.filter(j=>j.status==='succeeded').length}:${jobs.filter(j=>j.status==='awaiting_answers').length}`;
 if(!force&&announcement===queueLastAnnouncement)return;
 queueLastAnnouncement=announcement;
 const locale=window.TOCRI18n?.getLocale?.()||'de',needsAnswers=jobs.filter(j=>j.status==='awaiting_answers').length;
 const labels={en:{open:'open jobs',pending:'in progress or queued',needs:'need answers'},de:{open:'offene Aufträge',pending:'in Bearbeitung oder wartend',needs:'benötigen Antworten'},ar:{open:'مهام مفتوحة',pending:'قيد التنفيذ أو الانتظار',needs:'تحتاج إلى إجابات'}}[locale]||{open:'open jobs',pending:'in progress or queued',needs:'need answers'};
 const stage=window.TOCRI18n?.t?.(phaseLabels[active?.stage]||'In Bearbeitung')||phaseLabels[active?.stage]||'In Bearbeitung';
 $('#queue-live').textContent=active?`${stage}. ${pending.length} ${labels.open}.`:`${pending.length} ${labels.pending}. ${needsAnswers} ${labels.needs}.`;
}

function actualProgress(job){return typeof job.progress==='number'&&Number.isFinite(job.progress)?Math.max(0,Math.min(100,Math.round(job.progress))):null;}
function renderFeaturedJob(){
 const card=$('#featured-job'),studio=$('#studio-view');if(!card)return;
 const job=queueState.jobs.find(item=>item.id===featuredJobId&&item.status!=='expired');
 if(!job){card.hidden=true;studio.classList.remove('is-featured');return;}
 card.hidden=false;studio.classList.add('is-featured');
 const state=queueStatus(job,queueState.paused),status=$('#featured-job-status'),title=$('#featured-job-title'),names=$('#featured-job-files'),detail=$('#featured-job-detail'),actions=$('#featured-job-actions');
 const signature=JSON.stringify([job.id,job.status,job.stage,job.targetLanguage,job.provider,job.error,job.progress,queueState.paused,job.names]);if(card.dataset.renderSignature===signature)return;card.dataset.renderSignature=signature;
 const focusedAction=actions.contains(document.activeElement)?document.activeElement.dataset.queueAction:null;
 status.textContent=window.TOCRI18n?.t(state.label)||state.label;
 const titles={running:'Deine Übersetzung läuft',queued:'Übersetzung wartet',awaiting_answers:'Deine Antwort wird gebraucht',succeeded:'Deine Übersetzung ist bereit',failed:'Übersetzung fehlgeschlagen',cancelling:'Abbruch läuft',cancelled:'Auftrag abgebrochen'};
 title.textContent=window.TOCRI18n?.t(titles[job.status]||'Übersetzung wird vorbereitet')||titles[job.status]||'Übersetzung wird vorbereitet';
 names.textContent=job.names.join(' · ');names.dataset.noTranslate='';
 const progressTrack=$('#featured-job-progress'),progressFill=progressTrack.querySelector('span'),progress=actualProgress(job);progressTrack.hidden=!['queued','running','cancelling'].includes(job.status);if(progressTrack.hidden){progressTrack.classList.remove('is-indeterminate');progressTrack.removeAttribute('aria-valuenow');progressTrack.removeAttribute('aria-valuetext');progressFill.style.width='';}else if(progress===null){progressTrack.classList.add('is-indeterminate');progressTrack.removeAttribute('aria-valuenow');progressTrack.removeAttribute('aria-valuetext');progressFill.style.width='';}else{progressTrack.classList.remove('is-indeterminate');progressTrack.setAttribute('aria-valuemin','0');progressTrack.setAttribute('aria-valuemax','100');progressTrack.setAttribute('aria-valuenow',String(progress));progressTrack.setAttribute('aria-valuetext',`${progress}%`);progressFill.style.width=`${progress}%`;}
 const stage=phaseLabels[job.stage]||state.label;detail.textContent=job.status==='succeeded'?`${job.targetLanguage} · ${providerLabels[job.provider]||job.provider||'ChatGPT'}`:job.status==='failed'?(job.error||'Bitte öffne die Aufträge für Details und einen erneuten Versuch.'):`${window.TOCRI18n?.t(stage)||stage} · ${job.targetLanguage}`;
 actions.replaceChildren();
 if(job.status==='awaiting_answers')actions.append(queueButton('Rückfragen beantworten','answer',job));
 if(job.status==='succeeded'){actions.append(queueButton('Übersetzung prüfen','review',job),queueButton('PDF herunterladen','download',job),queueButton('Word herunterladen','word',job));}
 if(job.status==='failed')actions.append(queueButton('Erneut versuchen','retry',job));
 if(['queued','running','cancelling'].includes(job.status)){const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Aufträge ansehen';button.onclick=()=>setJobsPanel(true);actions.append(button);}
 const fresh=document.createElement('button');fresh.type='button';fresh.className='text-button featured-job-new';fresh.textContent='Weitere Dokumente übersetzen';fresh.onclick=()=>{try{sessionStorage.removeItem('translateocr-featured-job');}catch{}featuredJobId='';renderFeaturedJob();document.querySelector('#pick')?.focus({preventScroll:true});};actions.append(fresh);if(focusedAction){const restored=[...actions.querySelectorAll('[data-queue-action]')].find(button=>button.dataset.queueAction===focusedAction);restored?.focus({preventScroll:true});}
}
async function importBatchAction(batchId,action){
 try{const batch=await localRequest(`/api/import-batches/${batchId}/${action}`,{}).then(response=>response.json());await pollQueue();if(batch.added===0&&batch.remainingGroups>0&&!batch.stopped)toast(queueText('Für weitere Aufträge ist die Warteschlange voll. Schließe Aufträge ab und starte dann die nächste Welle.'));else toast(batch.remainingGroups?queueText('{files} Dateien · {remaining} noch vorbereitet',{files:batch.totalGroups,remaining:batch.remainingGroups}):queueText('Der Stapel ist vollständig in die Warteschlange übernommen.'));}
 catch(error){toast(error.message);}
}
function renderImportBatches(){
 const host=$('#batch-list');if(!host)return;const batches=queueState.batches||[];host.hidden=!batches.length;if(!batches.length){host.replaceChildren();host.dataset.signature='';return;}
 const signature=JSON.stringify([window.TOCRI18n?.getLocale?.(),batches]);if(host.dataset.signature===signature)return;host.dataset.signature=signature;
 host.replaceChildren(...batches.slice(-5).reverse().map(batch=>{const card=document.createElement('article');card.className='import-batch-card';const heading=document.createElement('div');heading.className='import-batch-heading';const title=document.createElement('strong');title.textContent=queueText('Stapel mit {groups} Aufträgen',{groups:batch.totalGroups});const provider=document.createElement('small');provider.textContent=`${providerLabels[batch.provider]||batch.provider} · ${batch.model}`;heading.append(title,provider);const rows=document.createElement('ol');rows.className='import-batch-groups';for(const group of batch.groups){const item=document.createElement('li'),name=document.createElement('span'),state=document.createElement('small');name.textContent=queueText('Auftrag {name} · {status}',{name:group.name,status:queueText(({prepared:'Bereit',queued:'Warteschlange',running:'In Bearbeitung',succeeded:'Abgeschlossen',failed:'Fehlgeschlagen',awaiting_answers:'Rückfrage nötig',cancelled:'Abgebrochen',cancelling:'In Bearbeitung'})[group.status]||'Bereit')});name.dataset.noTranslate='';state.textContent=group.names.join(' · ');state.dataset.noTranslate='';item.append(name,state);rows.append(item);}
  const summary=document.createElement('p');summary.className='muted';summary.textContent=queueText('{files} Dateien · {remaining} noch vorbereitet',{files:batch.groups.reduce((count,group)=>count+group.fileCount,0),remaining:batch.remainingGroups});const actions=document.createElement('div');actions.className='import-batch-actions';if(batch.remainingGroups){const button=document.createElement('button');button.type='button';button.className=batch.stopped?'primary':'secondary';button.textContent=batch.stopped?queueText('Stapel fortsetzen'):queueText('Nächste Welle starten');button.onclick=()=>void importBatchAction(batch.id,batch.stopped?'resume':'continue');actions.append(button);if(!batch.stopped){const pause=document.createElement('button');pause.type='button';pause.className='text-button';pause.textContent=queueText('Stapel pausieren');pause.onclick=()=>void importBatchAction(batch.id,'pause');actions.append(pause);}}card.append(heading,summary,rows,actions);return card;}));
}
function renderQueue(){
 renderImportBatches();
 renderJobsHeader();renderFeaturedJob();$('#doc-count').textContent=String(queueState.jobs.length);
 const jobs=queueState.jobs,active=jobs.find(j=>['running','cancelling'].includes(j.status)),pending=jobs.filter(j=>['queued','running','cancelling'].includes(j.status));
 const queueList=$('#queue-list'),queueScrollTop=queueList.scrollTop;
 $('#queue-card').classList.toggle('is-processing',Boolean(active));$('#queue-card').hidden=false;$('#queue-card').setAttribute('aria-busy',String(!queueLoaded));$('#queue-loading').hidden=queueLoaded;$('#queue-empty').hidden=!queueLoaded||Boolean(jobs.length);$('#queue-toggle').hidden=!pending.length;$('#queue-count').textContent=jobs.length?String(jobs.length):'';$('#queue-toggle').textContent=queueState.paused?'Fortsetzen':'Pausieren';$('#queue-toggle').disabled=!pending.length;
 if(!queueLoaded)$('#queue-loading').textContent=window.TOCRI18n?.t('Aufträge werden geladen …')||'Aufträge werden geladen …';
 const queueMessage=queueStatusMessage(queueState);$('#queue-message').hidden=!queueMessage;$('#queue-message').textContent=queueMessage?(window.TOCRI18n?.t(queueMessage)||queueMessage):'';
 $('#job-progress').hidden=true;
 if(active){
  $('#progress-title').textContent=active.status==='cancelling'?'Auftrag wird abgebrochen …':phaseLabels[active.stage]||'In Bearbeitung';$('#progress-files').textContent=active.names.join(' · ');$('#progress-files').dataset.noTranslate='';
  const progress=actualProgress(active),track=$('#progress-track'),fill=$('#progress-fill');if(progress===null){track.removeAttribute('aria-valuenow');track.removeAttribute('aria-valuetext');track.classList.add('is-indeterminate');fill.style.width='';}else{track.classList.remove('is-indeterminate');track.setAttribute('aria-valuenow',String(progress));track.setAttribute('aria-valuetext',`${progress}%`);fill.style.width=`${progress}%`;}
  $('#progress-elapsed').textContent=`Vergangen: ${duration(active.elapsedSeconds)}`;
  $('#progress-remaining').textContent=active.status==='cancelling'?'Abbruch läuft':active.remainingSeconds===null?'Dauert länger als geschätzt':`Noch ca. ${duration(active.remainingSeconds)}`;
  document.querySelectorAll('[data-phase]').forEach(el=>el.classList.toggle('current',el.dataset.phase===active.stage));
 }
 const openDebug=new Set([...document.querySelectorAll('.job-debug[open]')].map(el=>el.dataset.jobId));
 const focusedNode=document.activeElement,focus=focusedNode?.dataset,focusedRow=focusedNode?.closest?.('.queue-row'),focusedId=focus?.jobId||focusedRow?.dataset.jobId,focusedAction=focus?.queueAction,focusedKey=focus?.queueFocus;
 const rows=jobs.map(job=>{
  const state=queueStatus(job,queueState.paused),row=document.createElement('article');row.className=`queue-row status-${job.status} tone-${state.tone}`;row.dataset.jobId=job.id;
  const icon=document.createElement('span');icon.className='queue-status-icon';icon.textContent=state.icon;icon.setAttribute('aria-hidden','true');
  const copy=document.createElement('div');copy.className='queue-row-copy';const title=document.createElement('strong');title.dataset.noTranslate='';title.textContent=job.names.join(' · ');title.title=title.textContent;
  const badge=document.createElement('span');badge.className='job-status-badge';const statusLabel=document.createElement('span');statusLabel.textContent=state.label;badge.append(statusLabel);
  const sub=document.createElement('small');sub.className='job-model';sub.textContent=`${job.targetLanguage} · ${providerLabels[job.provider]||job.provider||'ChatGPT'}`;
  copy.append(title,badge,sub);
  if(job.status==='running'||job.status==='cancelling'){
   const progress=actualProgress(job),track=document.createElement('div');track.className='job-mini-progress';track.setAttribute('role','progressbar');track.setAttribute('aria-label','In Bearbeitung');const fill=document.createElement('span');if(progress===null)track.classList.add('is-indeterminate');else{track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(progress));track.setAttribute('aria-valuetext',`${progress}%`);fill.style.width=`${progress}%`;}track.append(fill);
   const timing=document.createElement('small');timing.className='job-timing';timing.textContent=phaseLabels[job.stage]||'In Bearbeitung';copy.append(track,timing);
  }else if(job.status==='queued'&&job.position){const position=document.createElement('small');position.className='job-timing';position.textContent=`Platz ${job.position}`;copy.append(position);}
  if(job.error){const error=document.createElement('p');error.className='queue-row-error';error.textContent=job.error;copy.append(error);}
  const actions=document.createElement('div');actions.className='queue-row-actions';
  if(job.status==='awaiting_answers'){const answer=queueButton('Rückfragen öffnen','answer',job);answer.classList.add('job-answer-button');actions.append(answer);}
  if(['queued','running','awaiting_answers'].includes(job.status))actions.append(queueButton('Abbrechen','cancel',job));
  if(job.status==='failed'){const retry=queueButton('Erneut versuchen','retry',job);if(job.retryAfterAt>Date.now()){retry.disabled=true;retry.title=`Der Anbieter bittet bis ${new Date(job.retryAfterAt).toLocaleTimeString()} zu warten.`;}actions.append(retry);}
  if(job.hasResult){actions.append(queueButton('PDF ↓','download',job),queueButton('Word ↓','word',job),queueButton('Beide ↓','bundle',job),queueButton('Bearbeiten','review',job));}
  if(['failed','cancelled','succeeded','expired'].includes(job.status))actions.append(queueButton('Löschen','remove',job));
  if(actions.lastChild?.dataset.queueAction==='remove')actions.lastChild.setAttribute('aria-label',`${job.names.join(', ')} aus Liste entfernen`);
  const debug=document.createElement('details');debug.className='job-debug';debug.dataset.jobId=job.id;debug.open=openDebug.has(job.id);const summary=document.createElement('summary');summary.dataset.jobId=job.id;summary.dataset.queueFocus='details';summary.textContent=job.diagnostic?'Fehlerdetails & Diagnose':'Details';const pre=document.createElement('pre');const report=JSON.stringify({jobId:job.id,status:job.status,provider:job.provider,model:job.model,fileCount:job.names.length,diagnostic:job.diagnostic,events:job.events},null,2);pre.textContent=report;const save=document.createElement('button');save.type='button';save.className='text-button';save.dataset.jobId=job.id;save.dataset.queueAction='diagnostic-download';save.textContent='Diagnose herunterladen';save.onclick=()=>downloadBlob(new Blob([report],{type:'application/json'}),`foliquo-diagnose-${job.id.slice(0,8)}.json`);debug.append(summary,pre,save);copy.append(debug);row.append(icon,copy,actions);return row;
 });const nextRows=new Map();for(let i=0;i<rows.length;i++){const fresh=rows[i],job=jobs[i],stable=queueRowNodes.get(job.id);if(stable){stable.className=fresh.className;stable.replaceChildren(...fresh.childNodes);nextRows.set(job.id,stable);rows[i]=stable}else nextRows.set(job.id,fresh)}queueRowNodes=nextRows;queueList.replaceChildren(...rows);queueList.scrollTop=queueScrollTop;
 if(focusedId){const id=CSS.escape(focusedId),selector=focusedAction?`[data-job-id="${id}"][data-queue-action="${CSS.escape(focusedAction)}"]`:focusedKey?`[data-job-id="${id}"][data-queue-focus="${CSS.escape(focusedKey)}"]`:null,restored=selector?document.querySelector(selector):null;if(restored&&!restored.disabled)restored.focus({preventScroll:true});else{const row=queueList.querySelector(`.queue-row[data-job-id="${id}"]`),fallback=row?.querySelector('button:not(:disabled), summary')||$('#jobs-open');fallback.focus({preventScroll:true});}}
 updateQueueLiveAnnouncement();
 const waiting=jobs.filter(j=>j.status==='awaiting_answers');if(clarificationJobId){const current=waiting.find(j=>j.id===clarificationJobId);if(current)showClarifications(current,false);else if(!clarificationSubmitting)closeClarifications();}
 updateQueueButton();if(typeof renderDocuments==='function'&&document.querySelector('#documents-view')&&!document.querySelector('#documents-view').hidden)renderDocuments();
}
window.addEventListener('translateocr-locale',()=>updateQueueLiveAnnouncement(true));
async function jobResult(job){if(queueResultCache.has(job.id))return queueResultCache.get(job.id);const result=await localRequest(`/api/jobs/${job.id}/result`).then(r=>r.json());queueResultCache.set(job.id,result);while(queueResultCache.size>4)queueResultCache.delete(queueResultCache.keys().next().value);return result;}
async function queueAction(action,job,launcher=document.activeElement){
 try{
  if(action==='remove'&&!confirm('Diesen Auftrag mit Dokumenten, Chat und Fassungen dauerhaft löschen?'))return;
  if(action==='retry'&&job.interrupted){const warning='Dieser Auftrag wurde unterbrochen. Ein Anbieteraufruf kann bereits Verbrauch ausgelöst haben. Gesicherte Antworten werden wiederverwendet; ein unklarer Request kann beim Wiederholen erneut Kosten oder Kontingent verbrauchen. Jetzt bewusst fortsetzen?';if(!confirm(window.TOCRI18n?.t(warning)||warning))return;}
  if(action==='retry'&&job.retryAfterAt>Date.now())throw new Error(`Der Anbieter bittet bis ${new Date(job.retryAfterAt).toLocaleTimeString()} zu warten.`);
  if(action==='retry'&&job.budgetConsentRequired){const warning='Foliquo kann den Betrag dieses API-Aufrufs nicht zuverlässig schätzen. Die lokale Monatsgrenze kann dadurch überschritten werden. Diesen einen Aufruf trotzdem erlauben?';if(!confirm(window.TOCRI18n?.t(warning)||warning))return;await localRequest('/api/usage/consent-once',{provider:job.provider,model:job.model,confirm:true});}
  if(action==='review'){await openReviewWorkspace(job.id);return;}
  if(action==='answer'){showClarifications(job,true);return;}
  if(action==='word'){const result=await jobResult(job);downloadWord(result.word,queueFilename(job).replace(/\.pdf$/,'.docx'));return;}
  if(action==='bundle'){await downloadBundle(job);markDownloaded(job.id);return;}
  if(action==='download'){const result=await jobResult(job);downloadPDF(result.pdf,queueFilename(job));markDownloaded(job.id);return;}
  if(action==='open'){
   if((files.length||$('#translation').value.trim())&&!confirm('Die aktuelle Auswahl und der bearbeitbare Entwurf werden durch dieses Ergebnis ersetzt. Fortfahren?'))return;
   const result=await jobResult(job);example=false;$('#target-language').value=job.targetLanguage;window.syncLanguageSelectors?.();draftTargetLanguage=job.targetLanguage;detectedDocument=result.detected||null;window.syncTranslateContext?.();convertedPreviews.clear();
   const snapshot=queueSnapshots.get(job.id);
   files=snapshot?[...snapshot]:result.previews.map(f=>{const raw=atob(f.data),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));return new File([bytes],f.type==='application/pdf'?f.name.replace(/\.[^.]+$/,'')+'.pdf':f.name,{type:f.type});});
   for(const f of result.previews||[])convertedPreviews.set(f.name,f);renderFiles();view('studio');openEditor(launcher);$('#translation').value=result.text;$('#draft-tag').textContent='Übersetzung abgeschlossen';document.querySelectorAll('.review-checks input').forEach(el=>el.checked=false);cachedPDF={fingerprint:pdfFingerprint(),data:result.pdf};cachedWord={fingerprint:pdfFingerprint(),data:result.word};return;
  }
  await localRequest(`/api/jobs/${job.id}/${action}`,{});if(action==='remove'){queueSnapshots.delete(job.id);queueResultCache.delete(job.id);}await pollQueue();if(action==='remove')await window.refreshDocumentHistory?.({removeId:job.id});
 }catch(error){toast(error.message);}
}
function queueFilename(job){const base=job.names[0]?.replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,70)||'foliquo';return `${base}-${job.targetLanguage}-uebersetzung.pdf`;}
async function downloadBundle(job){const response=await localRequest(`/api/jobs/${job.id}/bundle`);downloadBlob(await response.blob(),queueFilename(job).replace(/\.pdf$/,'-PDF-Word.zip'));}
function announceCompletion(job){
 if(job.clientId!==queueClientId||queueAnnounced.has(job.id)||!job.hasResult)return;
 markCompletionAnnounced(job.id);toast('Übersetzung bereit. PDF und Word kannst du direkt herunterladen.');
}
async function pollQueue(){
 if(queuePolling)return;if(!localRuntime||!csrf){scheduleQueuePoll();return;}queuePolling=true;
 try{const mutationVersion=queueMutationVersion;const incoming=await localRequest('/api/jobs').then(r=>r.json());if(mutationVersion!==queueMutationVersion||clarificationSubmitting)return;queueState=incoming;queueLoaded=true;const visible=new Set(queueState.jobs.filter(j=>j.status!=='expired').map(j=>j.id));for(const id of queueSnapshots.keys())if(!visible.has(id))queueSnapshots.delete(id);for(const id of queueResultCache.keys())if(!visible.has(id))queueResultCache.delete(id);renderQueue();if(typeof resumeReviewWorkspace==='function')resumeReviewWorkspace(queueState.jobs);for(const job of queueState.jobs)if(job.status==='succeeded')announceCompletion(job);}
 catch(error){queueState.connectionError='Verbindung unterbrochen. Der Status wird erneut abgefragt.';renderQueue();}
 finally{queuePolling=false;scheduleQueuePoll();}
}
function scheduleQueuePoll(){clearTimeout(queuePollTimer);if(location.hostname==='127.0.0.1')queuePollTimer=setTimeout(pollQueue,queueState.jobs.some(j=>['queued','running','cancelling'].includes(j.status))?1000:2500);}
window.addEventListener('translateocr-ready',()=>void pollQueue());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void pollQueue();});
window.addEventListener('focus',()=>void pollQueue());
async function submitImportBatch(){
 if(queueSubmitting)return;const selected=[...files],groups=window.selectedImportGroups?.(selected)||[],provider=$('#provider-choice').value,model=$('#model').value,meta={...documentMetadata(),example:false};
 if(groups.length<2){$('#error').textContent=window.TOCRI18n?.t('Lege mindestens zwei getrennte Aufträge fest.')||'Lege mindestens zwei getrennte Aufträge fest.';return;}
 queueSubmitting=true;updateQueueButton();$('#error').textContent='';
 try{const pageSummary=await window.importBatchPageSummary(selected,groups),currentGroups=window.selectedImportGroups?.(files)||[];if(files.length!==selected.length||!files.every((file,index)=>file===selected[index])||JSON.stringify(currentGroups)!==JSON.stringify(groups)||$('#provider-choice').value!==provider||$('#model').value!==model||JSON.stringify(documentMetadata())!==JSON.stringify(meta))throw new Error(window.TOCRI18n?.t('Dateien oder Auftragsoptionen wurden geändert. Bitte Stapel erneut vorbereiten.')||'Dateien oder Auftragsoptionen wurden geändert. Bitte Stapel erneut vorbereiten.');const costNote=['openai','anthropic','deepseek'].includes(provider)?(window.TOCRI18n?.t('API-Anbieter rechnen nach tatsächlichem Verbrauch ab. Rückfragen können zusätzliche Modellaufrufe auslösen.')||'API-Anbieter rechnen nach tatsächlichem Verbrauch ab. Rückfragen können zusätzliche Modellaufrufe auslösen.'):(window.TOCRI18n?.t('Foliquo kann das verbleibende ChatGPT-Kontingent nicht abfragen. Die Zahl der Anfragen hängt von Rückfragen ab.')||'Foliquo kann das verbleibende ChatGPT-Kontingent nicht abfragen. Die Zahl der Anfragen hängt von Rückfragen ab.'),waveNote=groups.length>8?(window.TOCRI18n?.t('Es starten höchstens acht Aufträge. Weitere Gruppen bleiben verschlüsselt gespeichert und brauchen deine bewusste Fortsetzung.')||'Es starten höchstens acht Aufträge. Weitere Gruppen bleiben verschlüsselt gespeichert und brauchen deine bewusste Fortsetzung.'):'',pageNote=pageSummary.unknownFiles?(window.TOCRI18n?.t('Die Seitenzahl von {count} Word-/Textdateien wird nach lokaler Vorbereitung ermittelt.')||'Die Seitenzahl von {count} Word-/Textdateien wird nach lokaler Vorbereitung ermittelt.').replace('{count}',String(pageSummary.unknownFiles)):'',prompt=(window.TOCRI18n?.t('Dieser Stapel erstellt {groups} Aufträge aus {files} Dateien mit {provider} und {model}. {pages} Seiten aus PDFs und Bildern werden vorab gezählt. {pageNote} {cost} {wave}')||'Dieser Stapel erstellt {groups} Aufträge aus {files} Dateien mit {provider} und {model}. {pages} Seiten aus PDFs und Bildern werden vorab gezählt. {pageNote} {cost} {wave}').replace('{groups}',String(groups.length)).replace('{files}',String(selected.length)).replace('{provider}',window.translateProviderContextState?.providerName||provider).replace('{model}',model).replace('{pages}',String(pageSummary.knownPages)).replace('{pageNote}',pageNote).replace('{cost}',costNote).replace('{wave}',waveNote);
 if(!window.confirm(prompt))return;const upload=await documentsForRequest(selected),result=await localRequest('/api/import-batches',{files:upload,groups,metadata:meta,model,provider,clientId:queueClientId,requestId:crypto.randomUUID()}).then(r=>r.json());await window.clearStudioDraft?.();if(files.length===selected.length&&files.every((file,index)=>file===selected[index])){files=[];invalidateDraft({discardTranslation:true});resetPreview();renderFiles();$('#file').value='';$('#batch-mode').checked=false;}await pollQueue();setJobsPanel(true);toast((window.TOCRI18n?.t('Stapel vorbereitet: {added} Aufträge gestartet.')||'Stapel vorbereitet: {added} Aufträge gestartet.').replace('{added}',String(result.added||0)));}
 catch(error){$('#error').textContent=error.message;}finally{queueSubmitting=false;updateQueueButton();}
}
$('#translate').onclick=async()=>{
 if(window.isLanguagePairValid?.()===false){window.showLanguagePairError?.();return;}
 if(!files.length){$('#error').textContent='Bitte zuerst Dateien für diesen Auftrag hinzufügen.';$('#dropzone').focus();return;}
 if(!localRuntime||!providerReady){connectionError('Bitte zuerst lokal anmelden oder einen API-Anbieter einrichten.');return;}
 if($('#batch-mode')?.checked){await submitImportBatch();return;}
 if(queueSubmitting)return;const selected=[...files],meta={...documentMetadata(),example:false},model=$('#model').value;queueSubmitting=true;updateQueueButton();$('#error').textContent='';
 try{
  const upload=await documentsForRequest(selected),result=await localRequest('/api/jobs',{files:upload,metadata:meta,model,provider:$('#provider-choice').value,clientId:queueClientId,requestId:crypto.randomUUID()}).then(r=>r.json());queueSnapshots.set(result.id,selected);await window.clearStudioDraft?.();
  if($('#additional-info').value.trim()===meta.additionalInfo)$('#additional-info').value='';
  if(files.length===selected.length&&files.every((f,i)=>f===selected[i])){files=[];invalidateDraft({discardTranslation:true});resetPreview();renderFiles();$('#file').value='';}
  featuredJobId=result.id;try{sessionStorage.setItem('translateocr-featured-job',featuredJobId);}catch{}await pollQueue();renderFeaturedJob();document.querySelector('#featured-job')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});toast('Auftrag hinzugefügt.');
 }catch(error){$('#error').textContent=error.message;}finally{queueSubmitting=false;updateQueueButton();}
};
$('#queue-toggle').onclick=async()=>{try{await localRequest(`/api/queue/${queueState.paused?'resume':'pause'}`,{});await pollQueue();}catch(error){toast(error.message);}};
scheduleQueuePoll();

window.dismissedClarifications=new Set();
const clarificationDrafts=new Map(),clarificationDraftRequests=new Map();let clarificationDraftTimer=null;
function captureClarificationDraft(){if(!clarificationJobId)return;const draft=clarificationDrafts.get(clarificationJobId)||{};draft.answers=[...document.querySelectorAll('#clarification-fields textarea')].map(el=>({id:el.dataset.questionId,answer:el.value}));clarificationDrafts.set(clarificationJobId,draft);return draft;}
async function saveClarificationDraft(){
 clearTimeout(clarificationDraftTimer);const id=clarificationJobId,draft=captureClarificationDraft();if(!id||!draft)return;
 const answers=draft.answers.map(a=>({...a})),upload=draft.filesToUpload;draft.filesToUpload=undefined;
 $('#clarification-save-status').textContent='Wird lokal gespeichert …';
 const task=(clarificationDraftRequests.get(id)||Promise.resolve()).catch(()=>{}).then(async()=>{
  const response=await localRequest(`/api/jobs/${id}/clarification-draft`,{answers,...(upload?{files:await documentsForRequest(upload)}:{})}).then(r=>r.json());
  draft.savedFiles=response.files;if(clarificationJobId===id){$('#clarification-save-status').textContent='Lokal gespeichert.';renderSavedClarificationFiles(draft);}
 }).catch(error=>{if(upload&&!draft.filesToUpload)draft.filesToUpload=upload;if(clarificationJobId===id){$('#clarification-save-status').textContent='Speichern fehlgeschlagen. Bitte erneut versuchen.';$('#clarification-error').textContent=error.message;}throw error;});
 clarificationDraftRequests.set(id,task);await task;
}
function renderSavedClarificationFiles(draft){$('#clarification-saved-files').textContent=draft.savedFiles?.length?window.TOCRI18n.t('Zusätzliche Aufnahmen gespeichert:')+' '+draft.savedFiles.map(f=>f.name).join(' · '):'';}
function scheduleClarificationDraft(){captureClarificationDraft();clearTimeout(clarificationDraftTimer);clarificationDraftTimer=setTimeout(()=>void saveClarificationDraft().catch(()=>{}),500);}
async function dismissClarificationDialog(){try{await saveClarificationDraft();if(clarificationJobId)window.dismissedClarifications.add(clarificationJobId);closeClarifications();setJobsPanel(true);}catch{}}
$('#clarification-fields').addEventListener('input',scheduleClarificationDraft);
$('#clarification-extra').addEventListener('change',()=>{const draft=captureClarificationDraft();if(draft){draft.filesToUpload=[...$('#clarification-extra').files];void saveClarificationDraft().catch(()=>{});}});
$('#clarification-dialog').addEventListener('cancel',event=>{event.preventDefault();void dismissClarificationDialog();});
$('#clarification-dialog').addEventListener('close',()=>{const id=clarificationFocusJobId;clarificationFocusJobId=null;if(!id)return;const answer=document.querySelector(`[data-job-id="${CSS.escape(id)}"][data-queue-action="answer"]`);(answer&&!answer.closest('[inert]')?answer:$('#jobs-open')).focus({preventScroll:true});});

function closeClarifications(){clearTimeout(clarificationDraftTimer);clarificationJobId=null;clarificationSignature='';$('#clarification-card').hidden=true;window.hideClarificationDialog();}
async function animateResolvedQuestion(questionId){
 const field=[...document.querySelectorAll('#clarification-fields .clarification-field')].find(el=>el.dataset.questionId===questionId);
 if(!field||matchMedia('(prefers-reduced-motion: reduce)').matches||typeof field.animate!=='function')return;
 const height=field.getBoundingClientRect().height;
 try{await field.animate([{opacity:1,height:`${height}px`,transform:'translateY(0)',overflow:'hidden'},{opacity:0,height:'0px',marginBottom:'0px',paddingTop:'0px',paddingBottom:'0px',transform:'translateY(-6px)',overflow:'hidden'}],{duration:220,easing:'ease-in-out',fill:'forwards'}).finished;}catch{}
}
async function acceptClarification(job,q,answer){
 if(clarificationSubmitting)return;clarificationSubmitting=true;queueMutationVersion++;$('#clarification-error').textContent='';
 document.querySelectorAll('#clarification-fields button,#clarification-submit').forEach(b=>b.disabled=true);
 try{await saveClarificationDraft();const updated=await localRequest(`/api/jobs/${job.id}/${answer===null?'unreadable':'answer-question'}`,{questionId:q.id,...(answer===null?{}:{answer})}).then(r=>r.json());queueMutationVersion++;await animateResolvedQuestion(q.id);queueState={...queueState,...updated};const remaining=updated.jobs.find(item=>item.id===job.id);if(remaining?.questions?.length)showClarifications(remaining,false);else{clarificationDrafts.delete(job.id);closeClarifications();}toast(answer===null?'Als unleserlich übernommen.':'Antwort übernommen.');renderQueue();}
 catch(error){$('#clarification-error').textContent=error.message;}
 finally{queueMutationVersion++;clarificationSubmitting=false;document.querySelectorAll('#clarification-fields button,#clarification-submit').forEach(b=>b.disabled=false);}
}
function showClarifications(job,scroll){
 clarificationFocusJobId=job.id;
 if(clarificationJobId&&clarificationJobId!==job.id){void saveClarificationDraft().catch(()=>{});}
 if(!clarificationDrafts.has(job.id))clarificationDrafts.set(job.id,{answers:job.clarificationDraft?.answers||[],savedFiles:job.clarificationDraft?.files||[]});
 const storedDraft=clarificationDrafts.get(job.id);
 const signature=JSON.stringify([job.id,job.questions.map(({box,...question})=>question)]);if(signature!==clarificationSignature){
  const sameJob=clarificationJobId===job.id,drafts=new Map(sameJob?[...document.querySelectorAll('#clarification-fields textarea')].map(el=>[el.dataset.questionId,el.value]):(storedDraft.answers||[]).map(a=>[a.id,a.answer]));
  clarificationJobId=job.id;clarificationSignature=signature;if(!sameJob)$('#clarification-extra').value='';if(!sameJob)questionOriginalReady=renderQuestionOriginal(job);$('#clarification-files').dataset.noTranslate='';$('#clarification-files').textContent=job.names.join(' · ');$('#clarification-error').textContent='';
  const fields=job.questions.map((q,i)=>{
   const field=document.createElement('div');field.className='clarification-field';field.dataset.questionId=q.id;field.addEventListener('focusin',()=>{document.querySelectorAll('.clarification-field').forEach(el=>el.classList.toggle('is-current',el===field));});
   const label=document.createElement('label');label.htmlFor=`answer-${q.id}`;label.textContent=`${i+1}. ${window.TOCRI18n?.localizeQuestion(q)||q.question}`;
   const context=document.createElement('details');context.className='question-context';const contextTitle=document.createElement('summary');contextTitle.textContent='Kontext';const contextText=document.createElement('p');contextText.textContent=q.context;context.append(contextTitle,contextText);
   const answer=document.createElement('textarea');answer.id=label.htmlFor;answer.dataset.questionId=q.id;answer.maxLength=4000;answer.required=true;answer.rows=2;answer.placeholder=window.TOCRI18n?.t('Deine Antwort …')||'Deine Antwort …';answer.value=drafts.get(q.id)||'';
   const suggestion=document.createElement('div');suggestion.className='question-suggestion';suggestion.hidden=!q.suggestion;
   const actions=document.createElement('div');actions.className='clarification-actions';
   if(q.suggestion){
    const heading=document.createElement('strong');heading.textContent='Vorschlag';
    const candidate=document.createElement('p');candidate.dataset.noTranslate='';candidate.dir='auto';candidate.textContent=q.suggestion;
    const use=document.createElement('button');use.type='button';use.className='text-button question-action question-use';use.textContent='Vorschlag übernehmen';use.onclick=()=>void acceptClarification(job,q,q.suggestion);
    suggestion.append(heading,candidate);actions.append(use);
   }
   const locate=document.createElement('button');locate.type='button';locate.className='text-button question-action question-source';locate.setAttribute('aria-pressed','false');locate.textContent='Originalstelle ansehen';locate.onclick=async()=>{document.querySelectorAll('.clarification-field').forEach(el=>el.classList.toggle('is-current',el===field));locate.disabled=true;locate.textContent='Originalstelle wird gesucht …';try{await questionOriginalReady;if(!q.box){const location=await localRequest(`/api/jobs/${job.id}/locate`,{questionId:q.id}).then(r=>r.json());Object.assign(q,location);}if(clarificationJobId===job.id&&typeof focusQuestionOriginal==='function'){await focusQuestionOriginal(q);document.querySelectorAll('#clarification-fields .question-source').forEach(button=>button.setAttribute('aria-pressed',String(button===locate)));}}catch(error){$('#clarification-error').textContent=error.message;}finally{locate.disabled=false;locate.textContent='Originalstelle ansehen';}};actions.append(locate);
   {
    const unreadable=document.createElement('button');unreadable.type='button';unreadable.className='text-button question-action question-unreadable';unreadable.textContent='Unleserlich';
    unreadable.onclick=()=>void acceptClarification(job,q,null);
    actions.append(unreadable);
   }
   const hint=document.createElement('small');hint.className='question-action-hint';hint.textContent=window.TOCRI18n?.t('Oder eigene Antwort eingeben. Eine unleserliche Stelle kannst du abschließend als unleserlich markieren.')||'Oder eigene Antwort eingeben. Eine unleserliche Stelle kannst du abschließend als unleserlich markieren.';
   const send=document.createElement('button');send.type='button';send.className='primary question-answer-submit';send.textContent=window.TOCRI18n?.t('Antwort senden')||'Antwort senden';send.disabled=!answer.value.trim();answer.addEventListener('input',()=>{send.disabled=!answer.value.trim();});send.onclick=()=>void acceptClarification(job,q,answer.value.trim());
   field.append(label,context,suggestion,actions,hint,answer,send);return field;
  });$('#clarification-fields').replaceChildren(...fields);
 }$('#clarification-card').hidden=false;renderSavedClarificationFiles(storedDraft);const answerLauncher=document.querySelector(`[data-job-id="${CSS.escape(job.id)}"][data-queue-action="answer"]`),focusReturn=answerLauncher&&!answerLauncher.closest('[inert]')?answerLauncher:$('#jobs-open');window.showClarificationDialog(focusReturn);if(scroll){$('#clarification-fields textarea')?.focus({preventScroll:true});}
}
$('#clarification-close').onclick=()=>void dismissClarificationDialog();
window.addEventListener('translateocr-locale',()=>{if(!clarificationJobId)return;const job=queueState.jobs.find(item=>item.id===clarificationJobId);if(!job)return;const focused=document.activeElement?.dataset.questionId,openContexts=new Set([...document.querySelectorAll('#clarification-fields .question-context[open]')].map(item=>item.closest('.clarification-field')?.dataset.questionId).filter(Boolean));captureClarificationDraft();clarificationSignature='';showClarifications(job,false);for(const field of document.querySelectorAll('#clarification-fields .clarification-field'))if(openContexts.has(field.dataset.questionId))field.querySelector('.question-context').open=true;if(focused)document.querySelector(`#clarification-fields textarea[data-question-id="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});});
$('#clarification-form').onsubmit=async event=>{
 event.preventDefault();if(clarificationSubmitting||!clarificationJobId)return;const id=clarificationJobId,answers=[...document.querySelectorAll('#clarification-fields textarea')].map(el=>({id:el.dataset.questionId,answer:el.value.trim(),unreadable:el.dataset.unreadable==='true'}));
 if(answers.some(a=>!a.answer)){$('#clarification-error').textContent='Bitte jede Rückfrage beantworten.';return;}clarificationSubmitting=true;$('#clarification-submit').disabled=true;$('#clarification-error').textContent='';
 try{await saveClarificationDraft();await localRequest(`/api/jobs/${id}/answer`,{answers,files:[]});await Promise.all(answers.map(answer=>animateResolvedQuestion(answer.id)));clarificationDrafts.delete(id);closeClarifications();window.dismissedClarifications.delete(id);toast('Antworten übernommen. Der Auftrag wird fortgesetzt.');await pollQueue();}catch(error){$('#clarification-error').textContent=error.message;}finally{clarificationSubmitting=false;$('#clarification-submit').disabled=false;}
};
