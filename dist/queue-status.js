// A status always has a readable label as well as a color and a symbol.
function queueStatus(job,paused=false){
 const progress=Math.max(0,Math.min(100,Math.round(Number(job.progress)||0)));
 const statuses={
  running:{label:'In Bearbeitung',icon:'↻',tone:'working',progress},
  awaiting_answers:{label:'Antwort benötigt',icon:'?',tone:'attention'},
  succeeded:{label:'Fertig',icon:'✓',tone:'success',progress:100},
  failed:{label:'Fehlgeschlagen',icon:'!',tone:'error'},
  cancelling:{label:'Wird abgebrochen',icon:'…',tone:'muted',progress},
  cancelled:{label:'Abgebrochen',icon:'−',tone:'muted'},
  expired:{label:'Abgelaufen',icon:'−',tone:'muted'},
  queued:{label:paused?'Pausiert':'Wartet',icon:paused?'Ⅱ':'◷',tone:paused?'attention':'muted'}
 };
 return statuses[job.status]||{label:'Wartet',icon:'◷',tone:'muted'};
}

// Header summary preserves action-required signals even while other jobs run.
function queueHeaderStatus(jobs=[],paused=false){
 const active=jobs.find(job=>['running','cancelling'].includes(job.status));
 const failed=jobs.some(job=>job.status==='failed');
 const questions=jobs.some(job=>job.status==='awaiting_answers');
 const pending=jobs.some(job=>job.status==='queued');
 const tone=failed?'error':questions||active||pending?'attention':jobs.some(job=>job.status==='succeeded')?'success':'muted';
 const label=failed?'Fehlgeschlagen':questions?'Antwort benötigt':active?'In Bearbeitung':pending?(paused?'Pausiert':'Wartet'):tone==='success'?'Fertig':'Noch keine Aufträge';
 return {tone,label,working:Boolean(active),progress:active?queueStatus(active).progress:null};
}

function queueContentMode(loaded,jobCount){return !loaded?'loading':jobCount?'jobs':'empty';}

function queueStatusMessage(state={}){
 const jobs=state.jobs||[],active=jobs.some(job=>['running','cancelling'].includes(job.status)),pending=jobs.some(job=>['queued','running','cancelling'].includes(job.status));
 if(state.storageError)return state.storageError;
 if(state.connectionError)return state.connectionError;
 const legacyPause='Warteschlange pausiert. Der laufende Auftrag wird noch abgeschlossen.';
 if(state.pauseReason&&state.pauseReason!==legacyPause)return state.pauseReason;
 if(!state.paused||!pending)return '';
 return active?'Warteschlange pausiert. Der laufende Auftrag wird abgeschlossen. Neue Aufträge warten bis zum Fortsetzen.':'Warteschlange pausiert. Wartende Aufträge starten nach dem Fortsetzen.';
}
