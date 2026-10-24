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
