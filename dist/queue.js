let queueState={jobs:[],paused:false},queueSubmitting=false,queuePollTimer=null,queuePolling=false,queueLastAnnouncement='';
let clarificationJobId=null,clarificationSignature='',clarificationSubmitting=false,questionOriginalReady=Promise.resolve();
const queueSnapshots=new Map(),queueResultCache=new Map(),queueAutoFetching=new Set();
function savedSession(key,fallback){try{const value=sessionStorage.getItem(key);if(value)return JSON.parse(value);const result=fallback();sessionStorage.setItem(key,JSON.stringify(result));return result;}catch{return fallback();}}
const queueClientId=savedSession('translateocr-queue-client',()=>crypto.randomUUID());
const queueDownloaded=new Set(savedSession('translateocr-queue-downloads',()=>[]));
function markDownloaded(id){queueDownloaded.add(id);try{sessionStorage.setItem('translateocr-queue-downloads',JSON.stringify([...queueDownloaded].slice(-100)));}catch{}}
function duration(seconds){const n=Math.max(0,Math.round(seconds));return n<60?`${n} Sek.`:`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')} Min.`;}
const providerLabels={chatgpt:'ChatGPT',openai:'OpenAI API',anthropic:'Claude API',deepseek:'DeepSeek API'};
const phaseLabels={preparing:'Dokumente werden vorbereitet',translating:'Modell prüft und übersetzt',pdf:'Deine PDF wird erstellt',word:'Deine Word-Datei wird erstellt',queued:'Wartet',done:'Fertig'};
function queueButton(text,action,job){const b=document.createElement('button');b.className='text-button';b.textContent=text;b.dataset.queueAction=action;b.dataset.jobId=job.id;b.onclick=()=>queueAction(action,job);return b;}
function updateQueueButton(){if(!$('#translate'))return;$('#translate').disabled=queueSubmitting||!providerReady||!$('#model').value;$('#translate').textContent=queueSubmitting?'Wird hinzugefügt …':queueState.jobs.some(j=>['queued','running','cancelling'].includes(j.status))?'Zur Warteschlange +':'Übersetzen & PDF + Word →';}
function renderQueue(){
 const jobs=queueState.jobs,active=jobs.find(j=>['running','cancelling'].includes(j.status)),pending=jobs.filter(j=>['queued','running','cancelling'].includes(j.status));
 $('#queue-card').hidden=!jobs.length;$('#queue-count').textContent=jobs.length?String(jobs.length):'';$('#queue-toggle').textContent=queueState.paused?'Fortsetzen':'Pausieren';$('#queue-toggle').disabled=!pending.length;
 $('#queue-message').hidden=!queueState.paused&&!queueState.connectionError&&!queueState.storageError;$('#queue-message').textContent=queueState.storageError||queueState.connectionError||(queueState.paused?(queueState.pauseReason||'Warteschlange pausiert. Der laufende Auftrag wird noch abgeschlossen.'):'');
 $('#job-progress').hidden=!active;
 if(active){
  $('#progress-title').textContent=active.status==='cancelling'?'Auftrag wird abgebrochen …':phaseLabels[active.stage]||'In Bearbeitung';$('#progress-files').textContent=active.names.join(' · ');
  $('#progress-track').setAttribute('aria-valuenow',String(active.progress));$('#progress-fill').style.width=`${active.progress}%`;
  $('#progress-elapsed').textContent=`Vergangen: ${duration(active.elapsedSeconds)}`;
  $('#progress-remaining').textContent=active.status==='cancelling'?'Abbruch läuft':active.remainingSeconds===null?'Dauert länger als geschätzt':`Noch ca. ${duration(active.remainingSeconds)}`;
  document.querySelectorAll('[data-phase]').forEach(el=>el.classList.toggle('current',el.dataset.phase===active.stage));
 }
 const openDebug=new Set([...document.querySelectorAll('.job-debug[open]')].map(el=>el.dataset.jobId));
 const focus=document.activeElement?.dataset,focusedId=focus?.jobId,focusedAction=focus?.queueAction;
 const rows=jobs.map(job=>{
  const row=document.createElement('div');row.className=`queue-row status-${job.status}`;
  const icon=document.createElement('span');icon.className='queue-status-icon';icon.textContent=job.status==='succeeded'?'✓':job.status==='running'?'↻':job.status==='awaiting_answers'?'?':job.status==='failed'?'!':job.status==='queued'?String(job.position):'−';
  const copy=document.createElement('div');copy.className='queue-row-copy';const title=document.createElement('strong');title.textContent=job.names.join(' · ');title.title=title.textContent;
  const sub=document.createElement('small');const status=job.status==='queued'?(queueState.paused?'Warteschlange pausiert':job.waitSeconds?`Platz ${job.position} · Start in ca. ${duration(job.waitSeconds)}`:'Startet gleich'):job.status==='running'?'In Bearbeitung':job.status==='cancelling'?'Wird abgebrochen':job.status==='succeeded'?`Fertig · ${duration(job.elapsedSeconds)}`:job.status==='awaiting_answers'?'Deine Antworten werden benötigt':job.status==='failed'?'Fehlgeschlagen':job.status==='expired'?'Ergebnis nicht mehr gespeichert':'Abgebrochen';sub.textContent=`${job.targetLanguage} · ${providerLabels[job.provider]||job.provider||'ChatGPT'} · ${status}`;
  copy.append(title,sub);if(job.error){const error=document.createElement('p');error.className='queue-row-error';error.textContent=job.error;copy.append(error);}
  const actions=document.createElement('div');actions.className='queue-row-actions';
  if(job.status==='awaiting_answers')actions.append(queueButton('Fragen beantworten','answer',job));
  if(['queued','running','awaiting_answers'].includes(job.status))actions.append(queueButton('Abbrechen','cancel',job));
  if(job.status==='failed')actions.append(queueButton('Erneut versuchen','retry',job));
  if(job.hasResult){actions.append(queueButton('PDF ↓','download',job),queueButton('Word ↓','word',job),queueButton('Beide ↓','bundle',job),queueButton('Bearbeiten','review',job));}
  if(['failed','cancelled','succeeded','expired'].includes(job.status))actions.append(queueButton('×','remove',job));
  if(actions.lastChild?.textContent==='×')actions.lastChild.setAttribute('aria-label',`${job.names.join(', ')} aus Liste entfernen`);
  const debug=document.createElement('details');debug.className='job-debug';debug.dataset.jobId=job.id;debug.open=openDebug.has(job.id);const summary=document.createElement('summary');summary.textContent=job.diagnostic?'Fehlerdetails & Diagnose':'Debug-Verlauf';const pre=document.createElement('pre');const report=JSON.stringify({jobId:job.id,status:job.status,provider:job.provider,model:job.model,fileCount:job.names.length,diagnostic:job.diagnostic,events:job.events},null,2);pre.textContent=report;const save=document.createElement('button');save.className='text-button';save.textContent='Diagnose herunterladen';save.onclick=()=>downloadBlob(new Blob([report],{type:'application/json'}),`translateocr-diagnose-${job.id.slice(0,8)}.json`);debug.append(summary,pre,save);copy.append(debug);row.append(icon,copy,actions);return row;
 });$('#queue-list').replaceChildren(...rows);
 if(focusedId&&focusedAction)document.querySelector(`[data-job-id="${focusedId}"][data-queue-action="${focusedAction}"]`)?.focus({preventScroll:true});
 const announcement=`${active?.id||''}:${active?.stage||''}:${pending.length}:${jobs.filter(j=>j.status==='succeeded').length}:${jobs.filter(j=>j.status==='awaiting_answers').length}`;
 if(announcement!==queueLastAnnouncement){queueLastAnnouncement=announcement;$('#queue-live').textContent=active?`${phaseLabels[active.stage]}. ${pending.length} offene Aufträge.`:`${pending.length} in Bearbeitung oder wartend. ${jobs.filter(j=>j.status==='awaiting_answers').length} benötigen Antworten.`;}
 const waiting=jobs.filter(j=>j.status==='awaiting_answers');if(clarificationJobId){const current=waiting.find(j=>j.id===clarificationJobId);if(current)showClarifications(current,false);else if(!clarificationSubmitting)closeClarifications();}else if(waiting.length&&waiting.some(j=>j.clientId===queueClientId)&&!window.dismissedClarifications?.has(waiting.find(j=>j.clientId===queueClientId).id)){showClarifications(waiting.find(j=>j.clientId===queueClientId),false);}
 updateQueueButton();if(typeof renderDocuments==='function'&&document.querySelector('#documents-view')&&!document.querySelector('#documents-view').hidden)renderDocuments();
}
async function jobResult(job){if(queueResultCache.has(job.id))return queueResultCache.get(job.id);const result=await localRequest(`/api/jobs/${job.id}/result`).then(r=>r.json());queueResultCache.set(job.id,result);while(queueResultCache.size>4)queueResultCache.delete(queueResultCache.keys().next().value);return result;}
async function queueAction(action,job){
 try{
  if(action==='remove'&&!confirm('Diesen Auftrag mit Dokumenten, Chat und Fassungen dauerhaft löschen?'))return;
  if(action==='review'){await openReviewWorkspace(job.id);return;}
  if(action==='answer'){showClarifications(job,true);return;}
  if(action==='word'){const result=await jobResult(job);downloadWord(result.word,queueFilename(job).replace(/\.pdf$/,'.docx'));return;}
  if(action==='bundle'){await downloadBundle(job);markDownloaded(job.id);return;}
  if(action==='download'){const result=await jobResult(job);downloadPDF(result.pdf,queueFilename(job));markDownloaded(job.id);return;}
  if(action==='open'){
   if((files.length||$('#translation').value.trim())&&!confirm('Die aktuelle Auswahl und der bearbeitbare Entwurf werden durch dieses Ergebnis ersetzt. Fortfahren?'))return;
   const result=await jobResult(job);example=false;$('#target-language').value=job.targetLanguage;draftTargetLanguage=job.targetLanguage;detectedDocument=result.detected||null;convertedPreviews.clear();
   const snapshot=queueSnapshots.get(job.id);
   files=snapshot?[...snapshot]:result.previews.map(f=>{const raw=atob(f.data),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));return new File([bytes],f.type==='application/pdf'?f.name.replace(/\.[^.]+$/,'')+'.pdf':f.name,{type:f.type});});
   for(const f of result.previews||[])convertedPreviews.set(f.name,f);renderFiles();view('studio');openEditor();$('#translation').value=result.text;$('#draft-tag').textContent='Übersetzung abgeschlossen';document.querySelectorAll('.review-checks input').forEach(el=>el.checked=false);cachedPDF={fingerprint:pdfFingerprint(),data:result.pdf};cachedWord={fingerprint:pdfFingerprint(),data:result.word};return;
  }
  await localRequest(`/api/jobs/${job.id}/${action}`,{});if(action==='remove'){queueSnapshots.delete(job.id);queueResultCache.delete(job.id);}await pollQueue();
 }catch(error){toast(error.message);}
}
function queueFilename(job){const base=job.names[0]?.replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,70)||'translateocr';return `${base}-${job.targetLanguage}-uebersetzung.pdf`;}
async function downloadBundle(job){const response=await localRequest(`/api/jobs/${job.id}/bundle`);downloadBlob(await response.blob(),queueFilename(job).replace(/\.pdf$/,'-PDF-Word.zip'));}
async function autoDownload(job){
 if(job.clientId!==queueClientId||queueDownloaded.has(job.id)||!job.hasResult)return;
 markDownloaded(job.id);toast('Übersetzung bereit. PDF und Word kannst du direkt herunterladen.');if(!files.length&&!$('#additional-info').value.trim())await openReviewWorkspace(job.id);
}
async function pollQueue(){
 if(queuePolling)return;if(!localRuntime||!csrf){scheduleQueuePoll();return;}queuePolling=true;
 try{queueState=await localRequest('/api/jobs').then(r=>r.json());const visible=new Set(queueState.jobs.filter(j=>j.status!=='expired').map(j=>j.id));for(const id of queueSnapshots.keys())if(!visible.has(id))queueSnapshots.delete(id);for(const id of queueResultCache.keys())if(!visible.has(id))queueResultCache.delete(id);renderQueue();if(typeof resumeReviewWorkspace==='function')resumeReviewWorkspace(queueState.jobs);for(const job of queueState.jobs)if(job.status==='succeeded')void autoDownload(job);}
 catch(error){queueState.connectionError='Verbindung unterbrochen. Der Status wird erneut abgefragt.';renderQueue();}
 finally{queuePolling=false;scheduleQueuePoll();}
}
function scheduleQueuePoll(){clearTimeout(queuePollTimer);if(location.hostname==='127.0.0.1')queuePollTimer=setTimeout(pollQueue,queueState.jobs.some(j=>['queued','running','cancelling'].includes(j.status))?1000:2500);}
$('#translate').onclick=async()=>{
 if(!files.length){$('#error').textContent='Bitte zuerst Dateien für diesen Auftrag hinzufügen.';$('#dropzone').focus();return;}
 if(!localRuntime||!providerReady){connectionError('Bitte zuerst lokal anmelden oder einen API-Anbieter einrichten.');return;}
 if(queueSubmitting)return;const selected=[...files],meta={...documentMetadata(),example:false},model=$('#model').value;queueSubmitting=true;updateQueueButton();$('#error').textContent='';
 try{
  const upload=await documentsForRequest(selected),result=await localRequest('/api/jobs',{files:upload,metadata:meta,model,provider:$('#provider-choice').value,clientId:queueClientId,requestId:crypto.randomUUID()}).then(r=>r.json());queueSnapshots.set(result.id,selected);
  if($('#additional-info').value.trim()===meta.additionalInfo)$('#additional-info').value='';
  if(files.length===selected.length&&files.every((f,i)=>f===selected[i])){files=[];invalidateDraft();resetPreview();renderFiles();$('#file').value='';}
  await pollQueue();$('#queue-card').scrollIntoView({behavior:'smooth',block:'nearest'});toast('Auftrag hinzugefügt. Du kannst jetzt weitere Dateien auswählen.');
 }catch(error){$('#error').textContent=error.message;}finally{queueSubmitting=false;updateQueueButton();}
};
$('#queue-toggle').onclick=async()=>{try{await localRequest(`/api/queue/${queueState.paused?'resume':'pause'}`,{});await pollQueue();}catch(error){toast(error.message);}};
scheduleQueuePoll();

window.dismissedClarifications=new Set();
function closeClarifications(){clarificationJobId=null;clarificationSignature='';$('#clarification-card').hidden=true;}
function showClarifications(job,scroll){
 const signature=JSON.stringify([job.id,job.questions.map(({box,...question})=>question)]);if(signature!==clarificationSignature){
  const sameJob=clarificationJobId===job.id,drafts=new Map(sameJob?[...document.querySelectorAll('#clarification-fields textarea')].map(el=>[el.dataset.questionId,el.value]):[]);
  clarificationJobId=job.id;clarificationSignature=signature;if(!sameJob)$('#clarification-extra').value='';questionOriginalReady=renderQuestionOriginal(job);$('#clarification-files').textContent=job.names.join(' · ');$('#clarification-error').textContent='';
  const fields=job.questions.map((q,i)=>{
   const field=document.createElement('div');field.className='clarification-field';
   const label=document.createElement('label');label.htmlFor=`answer-${q.id}`;label.textContent=`${i+1}. ${q.question}`;
   const context=document.createElement('p');context.className='question-context';context.textContent=q.context;
   const answer=document.createElement('textarea');answer.id=label.htmlFor;answer.dataset.questionId=q.id;answer.maxLength=4000;answer.required=true;answer.rows=2;answer.placeholder='Deine Antwort …';answer.value=drafts.get(q.id)||'';
   const suggestion=document.createElement('div');suggestion.className='question-suggestion';suggestion.hidden=!q.suggestion;
   if(q.suggestion){
    const heading=document.createElement('strong');heading.textContent='Mögliche Lesung · bitte bestätigen';
    const candidate=document.createElement('p');candidate.dataset.noTranslate='';candidate.dir='auto';candidate.textContent=q.suggestion;
    const use=document.createElement('button');use.type='button';use.className='text-button';use.textContent='Vorschlag übernehmen';use.onclick=()=>{answer.value=q.suggestion;answer.dispatchEvent(new Event('input'));answer.focus();};
    suggestion.append(heading,candidate,use);
   }
   const actions=document.createElement('div');actions.className='clarification-actions';
   const locate=document.createElement('button');locate.type='button';locate.className='text-button';locate.textContent='Originalstelle ansehen';locate.onclick=async()=>{locate.disabled=true;locate.textContent='Originalstelle wird gesucht …';try{await questionOriginalReady;if(!q.box){const location=await localRequest(`/api/jobs/${job.id}/locate`,{questionId:q.id}).then(r=>r.json());Object.assign(q,location);}if(clarificationJobId===job.id&&typeof focusQuestionOriginal==='function')await focusQuestionOriginal(q);}catch(error){$('#clarification-error').textContent=error.message;}finally{locate.disabled=false;locate.textContent='Originalstelle ansehen';}};actions.append(locate);
   if(q.kind==='unreadable'||/unleserlich|entziffer|nicht lesbar|illegible|unreadable/i.test(q.question+' '+q.context)){
    const unreadable=document.createElement('button');unreadable.type='button';unreadable.className='text-button';unreadable.textContent='Unleserlich';
    unreadable.onclick=async()=>{unreadable.disabled=true;try{await localRequest(`/api/jobs/${job.id}/unreadable`,{questionId:q.id});toast('Als unleserlich übernommen.');await pollQueue();}catch(error){$('#clarification-error').textContent=error.message;}finally{unreadable.disabled=false;}};
    actions.append(unreadable);
   }
   field.append(label,context,suggestion,actions,answer);return field;
  });$('#clarification-fields').replaceChildren(...fields);
 }$('#clarification-card').hidden=false;if(scroll){$('#clarification-card').scrollIntoView({behavior:'smooth',block:'start'});$('#clarification-fields textarea')?.focus({preventScroll:true});}
}
$('#clarification-close').onclick=()=>{if(clarificationJobId)window.dismissedClarifications.add(clarificationJobId);closeClarifications();};
$('#clarification-form').onsubmit=async event=>{
 event.preventDefault();if(clarificationSubmitting||!clarificationJobId)return;const id=clarificationJobId,answers=[...document.querySelectorAll('#clarification-fields textarea')].map(el=>({id:el.dataset.questionId,answer:el.value.trim(),unreadable:el.dataset.unreadable==='true'}));
 if(answers.some(a=>!a.answer)){$('#clarification-error').textContent='Bitte jede Rückfrage beantworten.';return;}clarificationSubmitting=true;$('#clarification-submit').disabled=true;$('#clarification-error').textContent='';
 try{await localRequest(`/api/jobs/${id}/answer`,{answers,files:await documentsForRequest([...$('#clarification-extra').files])});closeClarifications();window.dismissedClarifications.delete(id);toast('Antworten übernommen. Der Auftrag wird fortgesetzt.');await pollQueue();}catch(error){$('#clarification-error').textContent=error.message;}finally{clarificationSubmitting=false;$('#clarification-submit').disabled=false;}
};
