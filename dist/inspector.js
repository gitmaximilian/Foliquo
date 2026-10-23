let inspectResult=null,inspectSignature='',sourceGeneration=0,sourcePage=1,sourceIndex=0,sourceLocation=null;
function textElement(tag,text,className=''){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
async function sourceCanvas(file,pageNumber=1){const bytes=Uint8Array.from(atob(file.data),c=>c.charCodeAt(0));if(file.type==='application/pdf'){const renderer=await import('/vendor/pdfjs/pdf.mjs');renderer.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.mjs';const loading=renderer.getDocument({data:bytes,standardFontDataUrl:'/vendor/pdfjs/standard_fonts/',cMapUrl:'/vendor/pdfjs/cmaps/',cMapPacked:true,wasmUrl:'/vendor/pdfjs/wasm/',isEvalSupported:false});const doc=await loading.promise;try{const page=await doc.getPage(Math.min(pageNumber,doc.numPages)),v=page.getViewport({scale:1.3}),canvas=document.createElement('canvas');canvas.width=v.width;canvas.height=v.height;await page.render({canvas,viewport:v}).promise;return {canvas,pages:doc.numPages};}finally{await loading.destroy();}}
 const url=URL.createObjectURL(new Blob([bytes],{type:file.type}));try{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas'),scale=Math.min(1,1600/img.width);canvas.width=img.width*scale;canvas.height=img.height*scale;canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return {canvas,pages:1};}finally{URL.revokeObjectURL(url);}}
async function drawInspection(){
 const gen=++sourceGeneration,file=inspectResult?.previews[sourceIndex];if(!file)return;
 $('#inspect-original').replaceChildren(textElement('p','Original wird geladen …'));$('#inspect-crop').replaceChildren();
 try{
  const {canvas,pages}=await sourceCanvas(file,sourcePage);if(gen!==sourceGeneration)return;
  canvas.setAttribute('aria-label',`Originalseite ${sourcePage}: ${file.name}`);
  const stage=document.createElement('div');stage.className='question-source-page';stage.style.width=`${canvas.width}px`;stage.append(canvas);$('#inspect-original').replaceChildren(stage);
  $('#inspect-page-label').textContent=`Seite ${sourcePage} von ${pages}`;$('#inspect-prev').disabled=sourcePage<=1;$('#inspect-next').disabled=sourcePage>=pages;
  if(sourceLocation?.box){
   const [x,y,w,h]=sourceLocation.box,box=document.createElement('div');box.className='source-highlight';box.setAttribute('role','img');box.setAttribute('aria-label','Markierte Originalstelle');box.style.cssText=`left:${x*100}%;top:${y*100}%;width:${w*100}%;height:${h*100}%`;stage.append(box);
   const crop=document.createElement('canvas');crop.width=Math.max(1,canvas.width*w);crop.height=Math.max(1,canvas.height*h);crop.getContext('2d').drawImage(canvas,canvas.width*x,canvas.height*y,canvas.width*w,canvas.height*h,0,0,crop.width,crop.height);crop.setAttribute('aria-label','Zugeordneter Originalausschnitt');$('#inspect-crop').append(textElement('small','Farbig markierte Stelle · Position am Original mitprüfen.'),crop);box.scrollIntoView({block:'center',behavior:'smooth'});
  }else if(sourceLocation)$('#inspect-crop').append(textElement('p','Für diese Stelle wurde keine Position erkannt. Bitte auf der Originalseite nachsehen.'));
 }catch{if(gen===sourceGeneration)$('#inspect-original').replaceChildren(textElement('p','Originalvorschau nicht verfügbar. Bitte Originaldatei extern prüfen.'));}
}
async function focusField(field){
 const jobId=reviewJobId;sourceIndex=field.fileIndex||0;sourcePage=field.page||1;sourceLocation=field;$('#inspect-file').value=String(sourceIndex);$('#inspect-translation').textContent=inspectResult?.text.split('\n').filter(l=>field.translated&&l.includes(field.translated)).join('\n')||field.translated;
 if(typeof setReviewPane==='function')setReviewPane('source');
 if(!field.box){
  $('#inspect-crop').replaceChildren(textElement('p','Originalstelle wird gesucht …'));
  try{const location=await localRequest(`/api/jobs/${jobId}/locate`,{fieldId:field.id}).then(r=>r.json());if(reviewJobId!==jobId||sourceLocation!==field)return;Object.assign(field,location);}catch(error){$('#inspect-crop').replaceChildren(textElement('p',error.message));return;}
 }
 await drawInspection();
}
function renderInspector(snapshot){if(snapshot.result){inspectResult=snapshot.result;sourceIndex=0;sourcePage=1;sourceLocation=null;$('#inspect-file').replaceChildren(...inspectResult.previews.map((f,i)=>new Option(f.name,i)));void drawInspection();}
 const signature=JSON.stringify([snapshot.jobId,snapshot.version,snapshot.checks,snapshot.proposal,snapshot.versions,snapshot.busy]);if(signature===inspectSignature)return;inspectSignature=signature;
 const rows=(snapshot.checks||[]).map(c=>{const row=document.createElement('div');row.className='field-check'+(!c.present||c.consistent===false?' missing':'');const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.checkId=c.id;input.checked=c.confirmed;input.disabled=snapshot.busy||Boolean(snapshot.proposal);label.append(input,textElement('strong',c.label));row.append(label,textElement('small',`${c.source} → ${c.translated}`));if(c.issue)row.append(textElement('small',c.issue));if(c.kind!=='manual'){const b=textElement('button','Originalstelle ansehen','text-button');b.onclick=()=>focusField(c);row.append(b);}return row;});$('#inspect-checks').replaceChildren(...rows);$('#check-count').textContent=`${(snapshot.checks||[]).filter(c=>c.confirmed).length} / ${(snapshot.checks||[]).length} geprüft`;$('#save-checks').disabled=snapshot.busy||Boolean(snapshot.proposal);
 const changes=snapshot.proposal?.changes.filter(c=>c.id)||[];$('#revision-changes').replaceChildren(...changes.map(c=>{const row=document.createElement('div');row.className='change-block';const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=true;input.dataset.changeId=c.id;label.append(input,document.createTextNode(' Diese Änderung übernehmen'));row.append(label,textElement('div',c.before||'(kein bisheriger Text)','change-before'),textElement('div',c.after||'(Text entfernt)','change-after'));return row;}));if(!snapshot.proposal)$('#revision-changes').append(textElement('p','Neue Änderungswünsche erscheinen hier vor der Übernahme.','muted'));$('#revision-actions').hidden=!snapshot.proposal;$('#revision-history').replaceChildren(...(snapshot.versions||[]).filter(v=>v.version!==snapshot.version).map(v=>new Option(`Version ${v.version} · ${new Date(v.createdAt).toLocaleString('de-AT')}`,v.version)));$('#revision-restore').disabled=!$('#revision-history').value||snapshot.busy||Boolean(snapshot.proposal);}
$('#inspect-file').onchange=()=>{sourceIndex=Number($('#inspect-file').value);sourcePage=1;sourceLocation=null;void drawInspection();};$('#inspect-prev').onclick=()=>{sourcePage=Math.max(1,sourcePage-1);sourceLocation=null;void drawInspection();};$('#inspect-next').onclick=()=>{sourcePage++;sourceLocation=null;void drawInspection();};
async function inspectorTask(task){try{await task();await loadReview(true);}catch(e){$('#review-error').textContent=e.message;}}
$('#save-checks').onclick=()=>void inspectorTask(()=>localRequest(`/api/jobs/${reviewJobId}/verify`,{version:reviewData.version,ids:[...document.querySelectorAll('[data-check-id]:checked')].map(el=>el.dataset.checkId)}));
$('#revision-accept').onclick=()=>void inspectorTask(()=>localRequest(`/api/jobs/${reviewJobId}/revision`,{...protectionApproval(),action:'accept',version:reviewData.version,accepted:[...document.querySelectorAll('[data-change-id]:checked')].map(el=>el.dataset.changeId)}));
$('#revision-reject').onclick=()=>void inspectorTask(()=>localRequest(`/api/jobs/${reviewJobId}/revision`,{action:'reject',version:reviewData.version}));
$('#revision-restore').onclick=()=>{if(confirm('Diese frühere Fassung als neue Version wiederherstellen?'))void inspectorTask(()=>localRequest(`/api/jobs/${reviewJobId}/revision`,{...protectionApproval(),action:'restore',version:reviewData.version,restoreVersion:Number($('#revision-history').value)}));};
let focusQuestionOriginal=null;
async function renderQuestionOriginal(job){
 const id=job.id;focusQuestionOriginal=null;
 const root=$('#clarification-original');root.replaceChildren(textElement('p','Original zur Rückfrage wird geladen …'));
 try{
  const result=await localRequest(`/api/jobs/${id}/source`).then(r=>r.json());if(clarificationJobId!==id)return;
  const select=document.createElement('select');select.setAttribute('aria-label','Original zur Rückfrage auswählen');select.replaceChildren(...result.files.map((f,i)=>new Option(f.name,i)));
  const pageInput=document.createElement('input');pageInput.type='number';pageInput.min=1;pageInput.value=1;pageInput.setAttribute('aria-label','Originalseite zur Rückfrage');
  const host=document.createElement('div');host.className='question-source-view';
  const stage=document.createElement('div');stage.className='question-source-page';
  const note=textElement('p','','source-location-note');note.setAttribute('role','status');
  const cropHost=document.createElement('div');cropHost.className='inspect-crop';
  host.append(stage,note,cropHost);let generation=0;
  async function show(location=null){
   const current=++generation;note.textContent='';cropHost.replaceChildren();stage.replaceChildren(textElement('p','Original wird geladen …'));
   try{
    const file=result.files[Number(select.value)];if(!file)throw new Error('Missing source');
    const {canvas,pages}=await sourceCanvas(file,Math.max(1,Number(pageInput.value)||1));
    if(current!==generation||clarificationJobId!==id)return;
    pageInput.max=pages;pageInput.value=Math.min(Math.max(1,Number(pageInput.value)||1),pages);
    canvas.setAttribute('aria-label',`Originalseite ${pageInput.value}: ${file.name}`);
    stage.style.width=`${canvas.width}px`;stage.replaceChildren(canvas);
    if(location?.box){
     const [x,y,w,h]=location.box,highlight=document.createElement('div');highlight.className='source-highlight';highlight.setAttribute('role','img');highlight.setAttribute('aria-label','Markierte Originalstelle');
     highlight.style.cssText=`left:${x*100}%;top:${y*100}%;width:${w*100}%;height:${h*100}%`;stage.append(highlight);
     const crop=document.createElement('canvas');crop.width=Math.max(1,Math.round(canvas.width*w));crop.height=Math.max(1,Math.round(canvas.height*h));
     crop.getContext('2d').drawImage(canvas,canvas.width*x,canvas.height*y,canvas.width*w,canvas.height*h,0,0,crop.width,crop.height);crop.setAttribute('aria-label','Zugeordneter Originalausschnitt');
     note.textContent='Farbig markierte Stelle · Position am Original mitprüfen.';cropHost.append(crop);highlight.scrollIntoView({block:'center',behavior:'smooth'});
    }else if(location){note.textContent='Für diese Stelle wurde keine Position erkannt. Bitte auf der Originalseite nachsehen.';stage.scrollIntoView({block:'center',behavior:'smooth'});}
   }catch{if(current===generation&&clarificationJobId===id)stage.replaceChildren(textElement('p','Bitte Originaldatei extern öffnen.'));}
  }
  focusQuestionOriginal=async question=>{select.value=String(question.fileIndex||0);pageInput.value=question.page||1;await show(question);};
  select.onchange=()=>{pageInput.value=1;void show();};pageInput.onchange=()=>void show();root.replaceChildren(select,pageInput,host);await show();
 }catch(error){if(clarificationJobId===id)root.textContent=error.message;}
}
