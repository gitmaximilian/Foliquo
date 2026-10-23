let reviewHadProposal=false,reviewUnavailable=false,reviewJobId=null,reviewData=null,reviewUrl=null,reviewTimer=null,reviewLoading=false,reviewSubmitting=false,reviewMessageSignature='',reviewPreviewVersion=null,reviewResumeAttempted=false;
function rememberReview(id){try{if(id)sessionStorage.setItem('translateocr-review-job',id);else sessionStorage.removeItem('translateocr-review-job');}catch{}}
function resumeReviewWorkspace(jobs){if(reviewResumeAttempted||reviewJobId)return;reviewResumeAttempted=true;let id;try{id=sessionStorage.getItem('translateocr-review-job');}catch{}if(id&&jobs.some(j=>j.id===id&&j.hasResult)){if(!$('#studio-view').hidden)void openReviewWorkspace(id);}else if(id)rememberReview(null);}
async function openReviewWorkspace(id){
 clearTimeout(reviewTimer);reviewHadProposal=false;reviewUnavailable=false;reviewJobId=id;reviewData=null;reviewPreviewVersion=null;reviewMessageSignature='';rememberReview(id);view('review');$('#review-error').textContent='';$('#review-names').textContent='Deine Übersetzung wird geladen …';$('#review-messages').replaceChildren();$('#review-prompt').value='';
 $('#review-pdf').removeAttribute('src');$('#review-text').textContent='';if(reviewUrl){URL.revokeObjectURL(reviewUrl);reviewUrl=null;}renderReviewControls();await loadReview(true);
}
function renderReviewControls(){
 const busy=reviewUnavailable||!reviewData||reviewData.busy||reviewSubmitting||reviewData.proposal;$('#review-busy').hidden=!reviewData?.busy&&!reviewSubmitting;$('#review-send').disabled=busy;$('#review-prompt').disabled=busy;
 const blocked=reviewUnavailable||!reviewData?.result;for(const id of ['review-final-pdf','review-final-word','review-final-both'])$("#"+id).disabled=blocked;
 $('#review-version').textContent=reviewData?`Version ${reviewData.version}`:'Wird geladen';
 $('#review-final-status').textContent=reviewUnavailable?'Dieser Auftrag ist abgelaufen. Bitte zurückgehen und die Dateien erneut hochladen.':!reviewData?.result?'Die Übersetzung wird geladen …':`Fassung ${reviewData.version} · Detailprüfung und Chatbearbeitung sind optional.`;
}
function renderReview(snapshot){
 reviewData=snapshot;if(snapshot.proposal&&!reviewHadProposal){$('#review-tools').open=true;$('#revision-card').open=true;}reviewHadProposal=Boolean(snapshot.proposal);$('#review-error').textContent=snapshot.error||'';
 const signature=JSON.stringify(snapshot.messages);if(signature!==reviewMessageSignature){reviewMessageSignature=signature;$('#review-messages').replaceChildren(...snapshot.messages.map(message=>{const item=document.createElement('article');item.className=`review-message ${message.role==='user'?'from-user':'from-assistant'}`;const label=document.createElement('strong');label.textContent=message.role==='user'?'Du':'TranslateOCR';const text=document.createElement('p');text.textContent=message.text;item.append(label,text);return item;}));$('#review-messages').scrollTop=$('#review-messages').scrollHeight;}
 if(snapshot.result){
  $('#review-preview-note').textContent=snapshot.result.context?.layout?.includeOriginals===false?'PDF ohne Originalanhang · Word mit derselben bearbeitbaren Übersetzung':'PDF mit Originalseiten · Word mit derselben bearbeitbaren Übersetzung';$('#review-names').textContent=snapshot.names.join(' · ');$('#review-text').textContent=snapshot.result.text;
  void setReviewPDF(snapshot.result.pdf);reviewPreviewVersion=snapshot.version;queueResultCache.delete(reviewJobId);
 }
 if(typeof renderInspector==='function')renderInspector(snapshot);if(typeof renderStudio==='function')renderStudio(snapshot);if(typeof renderWorkflow==='function')renderWorkflow(snapshot);
 renderReviewControls();
}
async function loadReview(preview=false){
 if(!reviewJobId||reviewUnavailable)return;const id=reviewJobId;if(reviewLoading){reviewTimer=setTimeout(()=>loadReview(preview),500);return;}reviewLoading=true;
 try{let snapshot=await localRequest(`/api/jobs/${id}/review${preview?'?preview=1':''}`).then(r=>r.json());if(id!==reviewJobId)return;if(!snapshot.result&&reviewPreviewVersion!==snapshot.version)snapshot=await localRequest(`/api/jobs/${id}/review?preview=1`).then(r=>r.json());if(id!==reviewJobId)return;renderReview(snapshot);}
 catch(error){if(id===reviewJobId){$('#review-error').textContent=error.message;if(error.status===401||/Auftrag nicht gefunden|nicht mehr verfügbar/.test(error.message)){reviewUnavailable=true;rememberReview(null);renderReviewControls();}for(const button of document.querySelectorAll('.review-final button'))button.disabled=true;}}
 finally{reviewLoading=false;if(id===reviewJobId&&!reviewUnavailable){clearTimeout(reviewTimer);reviewTimer=setTimeout(()=>loadReview(),reviewData?.busy?1500:3500);}}
}
$('#review-back').onclick=()=>{rememberReview(null);clearReviewPDF();reviewJobId=null;clearTimeout(reviewTimer);if(reviewUrl){URL.revokeObjectURL(reviewUrl);reviewUrl=null;}$('#review-pdf').removeAttribute('src');view('studio');};
$('#review-form').onsubmit=async event=>{
 event.preventDefault();if(reviewUnavailable||!reviewJobId||!reviewData||reviewData.busy||reviewSubmitting)return;const prompt=$('#review-prompt').value.trim();if(!prompt)return;
 const id=reviewJobId,version=reviewData.version;reviewSubmitting=true;$('#review-error').textContent='';renderReviewControls();
 try{const snapshot=await localRequest(`/api/jobs/${id}/review/edit`,{prompt,version,requestId:crypto.randomUUID()}).then(r=>r.json());if(id!==reviewJobId)return;$('#review-prompt').value='';renderReview(snapshot);await loadReview(true);}
 catch(error){if(id===reviewJobId){$('#review-error').textContent=error.message;await loadReview();}}
 finally{reviewSubmitting=false;if(id===reviewJobId)renderReviewControls();}
};
$('#review-prompt').onkeydown=event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();$('#review-form').requestSubmit();}};
function reviewPreviewMode(mode){$('#review-pdf').hidden=mode!=='pdf';$('#review-text').hidden=mode!=='text';$('#review-show-pdf').classList.toggle('active',mode==='pdf');$('#review-show-text').classList.toggle('active',mode==='text');}
$('#review-show-pdf').onclick=()=>reviewPreviewMode('pdf');$('#review-show-text').onclick=()=>reviewPreviewMode('text');
async function downloadFinal(format){
 if(reviewUnavailable||!reviewData?.result)return;const id=reviewJobId,version=reviewData.version;
 try{const response=await localRequest(`/api/jobs/${id}/review/finalize`,{version,format,certification:$('#certification-confirm').checked});downloadBlob(await response.blob(),`translateocr-v${version}.${format==='bundle'?'zip':format==='pdf'?'pdf':'docx'}`);toast(`Finale Version ${version} wird heruntergeladen.`);await loadReview();}catch(error){$('#review-error').textContent=error.message;}
}
$('#review-final-pdf').onclick=()=>downloadFinal('pdf');$('#review-final-word').onclick=()=>downloadFinal('word');$('#review-final-both').onclick=()=>downloadFinal('bundle');

let pdfRenderer=null,pdfLoading=null,pdfDocument=null,pdfRenderTask=null,pdfPageIndex=1,pdfGeneration=0;
async function setReviewPDF(base64){
 const generation=++pdfGeneration;$('#review-preview-error').textContent='';$('#review-page-label').textContent='Vorschau wird geladen …';$('#review-page-canvas').replaceChildren();pdfRenderTask?.cancel();if(pdfLoading)void pdfLoading.destroy();pdfDocument=null;
 try{pdfRenderer=pdfRenderer||await import('/vendor/pdfjs/pdf.mjs');pdfRenderer.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.mjs';if(generation!==pdfGeneration)return;
  pdfLoading=pdfRenderer.getDocument({data:Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),standardFontDataUrl:'/vendor/pdfjs/standard_fonts/',cMapUrl:'/vendor/pdfjs/cmaps/',cMapPacked:true,wasmUrl:'/vendor/pdfjs/wasm/',isEvalSupported:false});
  const doc=await pdfLoading.promise;if(generation!==pdfGeneration)return;pdfDocument=doc;pdfPageIndex=1;await renderReviewPDFPage();
 }catch(error){if(generation===pdfGeneration){$('#review-page-label').textContent='Vorschau nicht verfügbar';$('#review-preview-error').textContent='Die PDF-Vorschau konnte nicht geladen werden. Die Textvorschau steht weiterhin zur Verfügung.';}}
}
async function renderReviewPDFPage(){
 if(!pdfDocument)return;const generation=pdfGeneration,index=pdfPageIndex;pdfRenderTask?.cancel();
 try{const page=await pdfDocument.getPage(index);if(generation!==pdfGeneration||index!==pdfPageIndex)return;const width=Math.max(240,$('#review-page-canvas').clientWidth||500),base=page.getViewport({scale:1}),ratio=Math.min(2,window.devicePixelRatio||1),viewport=page.getViewport({scale:width/base.width*ratio});
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.style.width='100%';canvas.style.height='auto';canvas.setAttribute('aria-label',`PDF-Seite ${index} von ${pdfDocument.numPages}`);$('#review-page-canvas').replaceChildren(canvas);
  $('#review-page-label').textContent=`Seite ${index} von ${pdfDocument.numPages}`;$('#review-page-prev').disabled=index===1;$('#review-page-next').disabled=index===pdfDocument.numPages;
  pdfRenderTask=page.render({canvas,viewport});await pdfRenderTask.promise;
 }catch(error){if(error.name!=='RenderingCancelledException'&&generation===pdfGeneration)$('#review-preview-error').textContent='Diese Seite konnte nicht dargestellt werden. Bitte die Textvorschau oder den PDF-Download verwenden.';}
}
$('#review-page-prev').onclick=()=>{if(pdfDocument&&pdfPageIndex>1){pdfPageIndex--;void renderReviewPDFPage();}};
$('#review-page-next').onclick=()=>{if(pdfDocument&&pdfPageIndex<pdfDocument.numPages){pdfPageIndex++;void renderReviewPDFPage();}};
let previewResizeTimer;new ResizeObserver(()=>{clearTimeout(previewResizeTimer);previewResizeTimer=setTimeout(()=>{if(!$('#review-pdf').hidden)void renderReviewPDFPage();},160);}).observe($('#review-pdf'));

function clearReviewPDF(){pdfGeneration++;pdfRenderTask?.cancel();if(pdfLoading)void pdfLoading.destroy();pdfDocument=null;$('#review-page-canvas').replaceChildren();}
