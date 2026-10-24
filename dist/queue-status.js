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
