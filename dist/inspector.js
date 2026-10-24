let inspectionViewer=null,questionSourceViewer=null;
let inspectResult=null,inspectSignature='',sourceGeneration=0,sourcePage=1,sourceIndex=0,sourceLocation=null;
function textElement(tag,text,className=''){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
async function sourceCanvas(file,pageNumber=1){const bytes=Uint8Array.from(atob(file.data),c=>c.charCodeAt(0));if(file.type==='application/pdf'){const renderer=await import('/vendor/pdfjs/pdf.mjs');renderer.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.mjs';const loading=renderer.getDocument({data:bytes,standardFontDataUrl:'/vendor/pdfjs/standard_fonts/',cMapUrl:'/vendor/pdfjs/cmaps/',cMapPacked:true,wasmUrl:'/vendor/pdfjs/wasm/',isEvalSupported:false});const doc=await loading.promise;try{const page=await doc.getPage(Math.min(pageNumber,doc.numPages)),base=page.getViewport({scale:1}),v=page.getViewport({scale:Math.min(2.2,2600/base.width,Math.sqrt(8000000/(base.width*base.height)))}),canvas=document.createElement('canvas');canvas.width=v.width;canvas.height=v.height;await page.render({canvas,viewport:v}).promise;return {canvas,pages:doc.numPages};}finally{await loading.destroy();}}
 const url=URL.createObjectURL(new Blob([bytes],{type:file.type}));try{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas'),scale=Math.min(1,3200/img.width,Math.sqrt(8000000/(img.width*img.height)));canvas.width=img.width*scale;canvas.height=img.height*scale;canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return {canvas,pages:1};}finally{URL.revokeObjectURL(url);}}
async function drawInspection(){
 const gen=++sourceGeneration,file=inspectResult?.previews[sourceIndex];if(!file)return;
 $('#inspect-original').replaceChildren(textElement('p','Original wird geladen …'));$('#inspect-crop').replaceChildren();
 try{
  const {canvas,pages}=await sourceCanvas(file,sourcePage);if(gen!==sourceGeneration)return;
  canvas.setAttribute('aria-label',`Originalseite ${sourcePage}: ${file.name}`);
  inspectionViewer?.destroy();inspectionViewer=createSourceViewer($('#inspect-original'),{allowMarking:true});inspectionViewer.setCanvas(canvas,sourceLocation?.box||null);if(sourceLocation?.id)inspectionViewer.enableRegionSelection(async box=>{const target=sourceLocation,location=await localRequest(`/api/jobs/${reviewJobId}/locate`,{fieldId:target.id,fileIndex:sourceIndex,page:sourcePage,box}).then(r=>r.json());Object.assign(target,location);await drawInspection();});
  $('#inspect-page-label').textContent=`Seite ${sourcePage} von ${pages}`;$('#inspect-prev').disabled=sourcePage<=1;$('#inspect-next').disabled=sourcePage>=pages;
  if(sourceLocation?.box)inspectionViewer.focusRegion();
  else if(sourceLocation)$('#inspect-crop').append(textElement('p','Für diese Stelle wurde keine Position erkannt. Bitte auf der Originalseite nachsehen.'));

 }catch{if(gen===sourceGeneration)$('#inspect-original').replaceChildren(textElement('p','Originalvorschau nicht verfügbar. Bitte Originaldatei extern prüfen.'));}
}
async function focusField(field){window.closeReviewTools?.();
 const jobId=reviewJobId;sourceIndex=field.fileIndex||0;sourcePage=field.page||1;sourceLocation=field;$('#inspect-file').value=String(sourceIndex);$('#inspect-translation').textContent=inspectResult?.text.split('\n').filter(l=>field.translated&&l.includes(field.translated)).join('\n')||field.translated;
 if(typeof setReviewPane==='function')setReviewPane('source');
 if(!field.box){
  $('#inspect-crop').replaceChildren(textElement('p','Originalstelle wird gesucht …'));
  try{const location=await localRequest(`/api/jobs/${jobId}/locate`,{fieldId:field.id}).then(r=>r.json());if(reviewJobId!==jobId||sourceLocation!==field)return;Object.assign(field,location);}catch(error){$('#inspect-crop').replaceChildren(textElement('p',error.message));return;}
 }
 await drawInspection();
}
let inspectedSourceJob=null;
function renderInspector(snapshot){if(snapshot.result)inspectResult=snapshot.result;if(snapshot.result&&inspectedSourceJob!==snapshot.jobId){inspectedSourceJob=snapshot.jobId;sourceIndex=0;sourcePage=1;sourceLocation=null;$('#inspect-file').replaceChildren(...inspectResult.previews.map((f,i)=>new Option(f.name,i)));void drawInspection();}
 const signature=JSON.stringify([snapshot.jobId,snapshot.version,snapshot.checks,snapshot.proposal,snapshot.versions,snapshot.busy]);if(signature===inspectSignature)return;inspectSignature=signature;
 const rows=(snapshot.checks||[]).map(c=>{const row=document.createElement('div');row.className='field-check'+(!c.present||c.consistent===false?' missing':'');const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.checkId=c.id;input.checked=c.confirmed;input.disabled=snapshot.busy||Boolean(snapshot.proposal);label.append(input,textElement('strong',c.label));row.append(label,textElement('small',`${c.source} → ${c.translated}`));if(c.issue)row.append(textElement('small',c.issue));if(c.kind!=='manual'){const b=textElement('button','Originalstelle ansehen','text-button question-action question-source');b.onclick=()=>focusField(c);row.append(b);}return row;});$('#inspect-checks').replaceChildren(...rows);$('#check-count').textContent=`${(snapshot.checks||[]).filter(c=>c.confirmed).length} / ${(snapshot.checks||[]).length} geprüft`;$('#save-checks').disabled=snapshot.busy||Boolean(snapshot.proposal);
 const changes=snapshot.proposal?.changes.filter(c=>c.id)||[];$('#revision-changes').replaceChildren(...changes.map(c=>{const row=document.createElement('div');row.className='change-block';const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=true;input.dataset.changeId=c.id;label.append(input,document.createTextNode(' Diese Änderung übernehmen'));row.append(label,textElement('div',c.before||'(kein bisheriger Text)','change-before'),textElement('div',c.after||'(Text entfernt)','change-after'));return row;}));if(!snapshot.proposal)$('#revision-changes').append(textElement('p','Neue Änderungswünsche erscheinen hier vor der Übernahme.','muted'));$('#revision-actions').hidden=!snapshot.proposal;$('#revision-history').replaceChildren(...(snapshot.versions||[]).filter(v=>v.version!==snapshot.version).map(v=>new Option(`Version ${v.version} · ${new Date(v.createdAt).toLocaleString('de-AT')}`,v.version)));$('#revision-restore').disabled=!$('#revision-history').value||snapshot.busy||Boolean(snapshot.proposal);}
$('#inspect-file').onchange=()=>{sourceIndex=Number($('#inspect-file').value);sourcePage=1;sourceLocation=null;void drawInspection();};$('#inspect-prev').onclick=()=>{sourcePage=Math.max(1,sourcePage-1);sourceLocation=null;void drawInspection();};$('#inspect-next').onclick=()=>{sourcePage++;sourceLocation=null;void drawInspection();};
async function inspectorTask(task){try{await task();await loadReview(true);}catch(e){$('#review-error').textContent=e.message;}}
$('#save-checks').onclick=()=>void inspectorTask(()=>localRequest(`/api/jobs/${reviewJobId}/verify`,{version:reviewData.version,ids:[...document.querySelectorAll('[data-check-id]:checked')].map(el=>el.dataset.checkId)}));
$('#revision-accept').onclick=()=>void inspectorTask(()=>localRequest(`/api/jobs/${reviewJobId}/revision`,{...protectionApproval(),action:'accept',version:reviewData.version,accepted:[...document.querySelectorAll('[data-change-id]:checked')].map(el=>el.dataset.changeId)}));
$('#revision-reject').onclick=()=>void inspectorTask(()=>localRequest(`/api/jobs/${reviewJobId}/revision`,{action:'reject',version:reviewData.version}));
$('#revision-restore').onclick=()=>{if(confirm('Diese frühere Fassung als neue Version wiederherstellen?'))void inspectorTask(()=>localRequest(`/api/jobs/${reviewJobId}/revision`,{...protectionApproval(),action:'restore',version:reviewData.version,restoreVersion:Number($('#revision-history').value)}));};
let focusQuestionOriginal=null;
async function renderQuestionOriginal(job){
 const id=job.id;focusQuestionOriginal=null;questionSourceViewer?.destroy();questionSourceViewer=null;
 const root=$('#clarification-original');root.replaceChildren(textElement('p','Original zur Rückfrage wird geladen …'));
 try{
  const result=await localRequest(`/api/jobs/${id}/source`).then(r=>r.json());if(clarificationJobId!==id)return;
  const controls=document.createElement('div');controls.className='question-source-controls';
  const select=document.createElement('select');select.setAttribute('aria-label','Original zur Rückfrage auswählen');select.replaceChildren(...result.files.map((f,i)=>new Option(f.name,i)));
  const pageInput=document.createElement('input');pageInput.type='number';pageInput.min=1;pageInput.value=1;pageInput.setAttribute('aria-label','Originalseite zur Rückfrage');
  const host=document.createElement('div');const note=textElement('p','','source-location-note');note.setAttribute('role','status');controls.append(select,pageInput);root.replaceChildren(controls,host,note);let generation=0,activeQuestion=null;
  async function show(location=null){
   const current=++generation;note.textContent='';questionSourceViewer?.destroy();questionSourceViewer=null;host.replaceChildren(textElement('p','Original wird geladen …'));
   try{
    const file=result.files[Number(select.value)];if(!file)throw new Error('Missing source');
    const {canvas,pages}=await sourceCanvas(file,Math.max(1,Number(pageInput.value)||1));
    if(current!==generation||clarificationJobId!==id)return;
    pageInput.max=pages;pageInput.value=Math.min(Math.max(1,Number(pageInput.value)||1),pages);canvas.setAttribute('aria-label',`Originalseite ${pageInput.value}: ${file.name}`);
    questionSourceViewer=createSourceViewer(host,{allowMarking:true});questionSourceViewer.setCanvas(canvas,location?.box||null);questionSourceViewer.enableRegionSelection(async box=>{if(!activeQuestion)return;const saved=await localRequest(`/api/jobs/${id}/locate`,{questionId:activeQuestion.id,fileIndex:Number(select.value),page:Number(pageInput.value),box}).then(r=>r.json());Object.assign(activeQuestion,saved);await show(saved);});
    if(location?.box){note.textContent='Markierte Stelle im Original';questionSourceViewer.focusRegion();}
    else if(location)note.textContent='Für diese Stelle wurde keine Position erkannt. Bitte auf der Originalseite nachsehen.';
   }catch{if(current===generation&&clarificationJobId===id)host.replaceChildren(textElement('p','Bitte Originaldatei extern öffnen.'));}
  }
  focusQuestionOriginal=async question=>{activeQuestion=question;select.value=String(question.fileIndex||0);pageInput.value=question.page||1;await show(question);};
  select.onchange=()=>{pageInput.value=1;void show();};pageInput.onchange=()=>void show();await show();
 }catch(error){if(clarificationJobId===id)root.textContent=error.message;}
}
