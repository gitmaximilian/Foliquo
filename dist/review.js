let reviewHadProposal=false,reviewUnavailable=false,reviewJobId=null,reviewData=null,reviewUrl=null,reviewTimer=null,reviewLoading=false,reviewSubmitting=false,reviewMessageSignature='',reviewPreviewVersion=null,reviewResumeAttempted=false;
function reviewCopy(key,values={}){const template=typeof window!=='undefined'?(window.TOCRI18n?.t(key)||key):key;return Object.entries(values).reduce((text,[name,value])=>text.replaceAll(`{${name}}`,String(value)),template);}
const localizedReviewMessages=new Set([
 'Deine Übersetzung ist bereit. Beschreibe deine Änderungen hier. Ich aktualisiere die Vorschau; du lädst die finale Fassung herunter, wenn du zufrieden bist.',
 'Direkte Korrektur übernommen. Kein Modellaufruf. Bitte die neue Fassung prüfen.',
 'Änderung übernommen. Die Vorschau zeigt die neue Fassung. Du kannst weitere Änderungen anfordern oder die finalen Dateien herunterladen.',
 'Änderungsvorschlag bereit. Prüfe die Unterschiede und übernimm die gewünschten Änderungen.',
 'Frühere Fassung als neue Version wiederhergestellt.',
 'Ausgewählte Änderungen übernommen. Bitte die neue Fassung prüfen.'
]);
function reviewMessageText(message){return message.role==='assistant'&&localizedReviewMessages.has(message.text)?reviewCopy(message.text):message.text;}
function renderReviewMessages(messages){
 const signature=JSON.stringify([window.TOCRI18n?.getLocale?.()||'',messages]);if(signature===reviewMessageSignature)return;reviewMessageSignature=signature;
 $('#review-messages').replaceChildren(...messages.map(message=>{const item=document.createElement('article');item.className=`review-message ${message.role==='user'?'from-user':'from-assistant'}`;const label=document.createElement('strong');label.textContent=reviewCopy(message.role==='user'?'Du':'Foliquo');const text=document.createElement('p');text.textContent=reviewMessageText(message);item.append(label,text);return item;}));$('#review-messages').scrollTop=$('#review-messages').scrollHeight;
}
window.addEventListener('translateocr-locale',()=>{if(!reviewData)return;renderReviewControls();renderReviewMessages(reviewData.messages);localizeReviewPageControls();});
function rememberReview(id){try{if(id)sessionStorage.setItem('translateocr-review-job',id);else sessionStorage.removeItem('translateocr-review-job');}catch{}}
function resumeReviewWorkspace(jobs){if(reviewResumeAttempted||reviewJobId)return;reviewResumeAttempted=true;let id;try{id=sessionStorage.getItem('translateocr-review-job');}catch{}if(id&&jobs.some(j=>j.id===id&&j.hasResult)){if(!$('#studio-view').hidden)void openReviewWorkspace(id);}else if(id)rememberReview(null);}
async function openReviewWorkspace(id,{historyMode='push'}={}){
 clearTimeout(reviewTimer);reviewHadProposal=false;reviewUnavailable=false;reviewJobId=id;reviewData=null;reviewPreviewVersion=null;reviewMessageSignature='';rememberReview(id);view('review',{historyMode});$('#review-error').textContent='';$('#review-names').textContent='Deine Übersetzung wird geladen …';$('#review-messages').replaceChildren();$('#review-prompt').value='';resizeReviewPrompt();
 $('#review-pdf').removeAttribute('src');$('#review-text').textContent='';if(reviewUrl){URL.revokeObjectURL(reviewUrl);reviewUrl=null;}renderReviewControls();await loadReview(true);
}
function renderReviewControls(){
 const busy=reviewUnavailable||!reviewData||reviewData.busy||reviewSubmitting||reviewData.proposal;$('#review-busy').hidden=!reviewData?.busy&&!reviewSubmitting;$('#review-send').disabled=busy;$('#review-prompt').disabled=busy;
 const blocked=reviewUnavailable||!reviewData?.result;for(const id of ['review-final-pdf','review-final-word','review-final-both'])$("#"+id).disabled=blocked;
 $('#review-version').textContent=reviewData?reviewCopy('Version {version}',{version:reviewData.version}):reviewCopy('Wird geladen');
 $('#review-final-status').textContent=reviewUnavailable?reviewCopy('Dieser Auftrag ist abgelaufen. Bitte zurückgehen und die Dateien erneut hochladen.'):!reviewData?.result?reviewCopy('Die Übersetzung wird geladen …'):reviewCopy('Version {version}',{version:reviewData.version});
 renderLearningOffer(reviewData);
}
function renderLearningOffer(snapshot){
 const card=$('#learning-offer'),button=$('#review-learning-finish'),offer=snapshot?.learningOffer,state=offer?.state;
 const known=['offered','preflight','analyzing','pending_review','interrupted','active','dismissed','removed'].includes(state);
 card.hidden=!['offered','preflight','analyzing','pending_review','interrupted','active'].includes(state);
 button.hidden=Boolean(snapshot?.learningPromptDisabled)||known||!snapshot?.result||snapshot?.hasQuestions||snapshot?.busy||snapshot?.proposal;
 button.disabled=reviewUnavailable||reviewSubmitting;
 $('#learning-offer-actions').hidden=!['offered','preflight'].includes(state);
 $('#learning-preflight').hidden=state!=='preflight';
 $('#learning-offer-copy').hidden=state!=='offered';
 $('#learning-offer-status').textContent=state==='analyzing'?'Die vollständige Musteranalyse läuft. Bereits abgeschlossene Abschnitte werden lokal gesichert.':state==='pending_review'?'Analyse abgeschlossen. Prüfe die erkannten Regeln im Bereich Anlernen, bevor du sie aktivierst.':state==='interrupted'?'Die Analyse wurde unterbrochen. Gesicherte Abschnitte bleiben erhalten; du kannst sie im Bereich Anlernen fortsetzen.':state==='active'?'Dieses Muster ist freigegeben und kann bei passenden neuen Aufträgen helfen.':'';
 if(state==='preflight'){
  const p=offer.preflight||{};const provider=({chatgpt:'ChatGPT-Konto',openai:'OpenAI API',anthropic:'Anthropic API',deepseek:'DeepSeek API'})[offer.provider]||offer.provider;
  $('#learning-preflight-summary').textContent=`${offer.pages} Seiten · etwa ${offer.requests} Modellanfragen · ${provider} · ${offer.model}`;
  $('#learning-preflight-content').textContent=p.content||'';$('#learning-preflight-standard').textContent=p.standard||'';
 }
}
function renderReview(snapshot){
 if(!snapshot.result&&reviewData?.jobId===snapshot.jobId&&reviewData.version===snapshot.version&&reviewData.result)snapshot={...snapshot,result:reviewData.result,names:snapshot.names||reviewData.names};
 reviewData=snapshot;$('#review-proposal').hidden=!snapshot.proposal;$('#review-messages').hidden=snapshot.messages.length===1&&snapshot.messages[0].role==='assistant';if(snapshot.proposal&&!reviewHadProposal){$('#revision-card').open=true;}reviewHadProposal=Boolean(snapshot.proposal);$('#review-error').textContent=snapshot.error||'';const styles=snapshot.styleReferences||[];$('#review-style-indicator').hidden=!styles.length;if(styles.length){$('#review-style-indicator summary').textContent=styles.length===1?reviewCopy('Stil aus einem Muster verwendet'):reviewCopy('Stil aus {count} Mustern verwendet',{count:styles.length});$('#review-style-details').replaceChildren(...styles.map(style=>{const item=document.createElement('p');item.textContent=`${style.name} · ${style.documentType} · ${style.targetLanguage} · ${style.reason}`;return item;}));}else $('#review-style-details').replaceChildren();
 renderReviewMessages(snapshot.messages);
 if(snapshot.result){
  $('#review-preview-note').textContent=reviewCopy(snapshot.result.context?.layout?.includeOriginals===false?'PDF ohne Originalanhang · Word mit derselben bearbeitbaren Übersetzung':'PDF mit Originalseiten · Word mit derselben bearbeitbaren Übersetzung');$('#review-names').textContent=snapshot.names.join(' · ');$('#review-text').textContent=snapshot.result.text;
  if(reviewPreviewVersion!==snapshot.version){void setReviewPDF(snapshot.result.pdf);reviewPreviewVersion=snapshot.version;}queueResultCache.delete(reviewJobId);
 }
 if(typeof renderInspector==='function')renderInspector(snapshot);if(typeof renderStudio==='function')renderStudio(snapshot);if(typeof renderWorkflow==='function')renderWorkflow(snapshot);
 renderReviewControls();
}
async function loadReview(preview=false){
 if(!reviewJobId||reviewUnavailable)return;const id=reviewJobId;if(reviewLoading){reviewTimer=setTimeout(()=>loadReview(preview),500);return;}reviewLoading=true;
 try{let snapshot=await localRequest(`/api/jobs/${id}/review${preview?'?preview=1':''}`).then(r=>r.json());if(id!==reviewJobId)return;if(!snapshot.result&&reviewPreviewVersion!==snapshot.version)snapshot=await localRequest(`/api/jobs/${id}/review?preview=1`).then(r=>r.json());if(id!==reviewJobId)return;renderReview(snapshot);}
 catch(error){if(id===reviewJobId){$('#review-error').textContent=error.message;if(error.status===401||/Auftrag nicht gefunden|nicht mehr verfügbar/.test(error.message)){reviewUnavailable=true;rememberReview(null);renderReviewControls();view('studio',{historyMode:'replace'});}for(const button of document.querySelectorAll('.review-final button'))button.disabled=true;}}
 finally{reviewLoading=false;if(id===reviewJobId&&!reviewUnavailable){clearTimeout(reviewTimer);reviewTimer=setTimeout(()=>loadReview(),reviewData?.busy?1500:3500);}}
}
$('#review-back').onclick=()=>{rememberReview(null);clearReviewPDF();reviewJobId=null;clearTimeout(reviewTimer);if(reviewUrl){URL.revokeObjectURL(reviewUrl);reviewUrl=null;}$('#review-pdf').removeAttribute('src');view('studio');};
function resizeReviewPrompt(){const field=$('#review-prompt');if(!field)return;field.style.height='auto';field.style.height=`${field.scrollHeight}px`;}
$('#review-prompt').addEventListener('input',resizeReviewPrompt);
$('#review-form').onsubmit=async event=>{
 event.preventDefault();if(reviewUnavailable||!reviewJobId||!reviewData||reviewData.busy||reviewSubmitting)return;const prompt=$('#review-prompt').value.trim();if(!prompt)return;
 const id=reviewJobId,version=reviewData.version;reviewSubmitting=true;$('#review-error').textContent='';renderReviewControls();
 try{const snapshot=await localRequest(`/api/jobs/${id}/review/edit`,{prompt,version,requestId:crypto.randomUUID()}).then(r=>r.json());if(id!==reviewJobId)return;$('#review-prompt').value='';resizeReviewPrompt();renderReview(snapshot);await loadReview(true);}
 catch(error){if(id===reviewJobId){$('#review-error').textContent=error.message;await loadReview();}}
 finally{reviewSubmitting=false;if(id===reviewJobId)renderReviewControls();}
};
async function learningOfferAction(action,extra={}){
 if(!reviewJobId||!reviewData)return;const id=reviewJobId,version=reviewData.version;$('#learning-offer-status').textContent=reviewCopy('Wird gespeichert …');
 try{const snapshot=await localRequest(`/api/jobs/${id}/learn`,{action,version,...extra}).then(r=>r.json());if(id!==reviewJobId)return;renderReview(snapshot);if(action==='start')toast(reviewCopy('Die Musteranalyse wurde gestartet.'));await loadReview(true);}
 catch(error){if(id===reviewJobId){$('#learning-offer-status').textContent='';$('#review-error').textContent=error.message;}}
}
$('#review-learning-finish').onclick=()=>void learningOfferAction('finish');
$('#learning-offer-add').onclick=()=>{
 if(!providerReady){window.openAISettings?.($('#review-learning-finish'));$('#learning-offer-status').textContent=reviewCopy('Verbinde zuerst einen Anbieter, um die Musteranalyse vorzubereiten.');return;}
 const model=$('#model')?.value;if(!model){window.openAISettings?.($('#review-learning-finish'));$('#learning-offer-status').textContent=reviewCopy('Bitte zuerst ein Modell auswählen.');return;}
 void learningOfferAction('prepare',{provider:activeProvider||'chatgpt',model});
};
$('#learning-offer-later').onclick=()=>void learningOfferAction('dismiss');
$('#learning-offer-never').onclick=()=>void learningOfferAction('never');
$('#learning-analysis-start').onclick=()=>void learningOfferAction('start',{provider:activeProvider||'chatgpt',model:$('#model')?.value,confirmed:true});
$('#learning-analysis-cancel').onclick=()=>void learningOfferAction('cancel');
$('#review-prompt').onkeydown=event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();$('#review-form').requestSubmit();}};
function reviewPreviewMode(mode){$('#review-pdf').hidden=mode!=='pdf';$('#review-text').hidden=mode!=='text';$('#review-show-pdf').classList.toggle('active',mode==='pdf');$('#review-show-text').classList.toggle('active',mode==='text');}
$('#review-show-pdf').onclick=()=>reviewPreviewMode('pdf');$('#review-show-text').onclick=()=>reviewPreviewMode('text');
async function downloadFinal(format){
 if(reviewUnavailable||!reviewData?.result)return;const id=reviewJobId,version=reviewData.version;
 try{const response=await localRequest(`/api/jobs/${id}/review/finalize`,{version,format,certification:$('#certification-confirm').checked});downloadBlob(await response.blob(),`foliquo-v${version}.${format==='bundle'?'zip':format==='pdf'?'pdf':'docx'}`);toast(reviewCopy('Finale Version {version} wird heruntergeladen.',{version}));await loadReview();}catch(error){$('#review-error').textContent=error.message;}
}
$('#review-final-pdf').onclick=()=>downloadFinal('pdf');$('#review-final-word').onclick=()=>downloadFinal('word');$('#review-final-both').onclick=()=>downloadFinal('bundle');

let reviewPDFViewer=null;
let pdfRenderer=null,pdfLoading=null,pdfDocument=null,pdfRenderTask=null,pdfPageIndex=1,pdfGeneration=0;
function localizeReviewPageControls(){if(!pdfDocument)return;const values={page:pdfPageIndex,total:pdfDocument.numPages};$('#review-page-label').textContent=reviewCopy('Seite {page} von {total}',values);$('#review-page-canvas canvas')?.setAttribute('aria-label',reviewCopy('PDF-Seite {page} von {total}',values));}
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
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.style.width='100%';canvas.style.height='auto';canvas.setAttribute('aria-label',reviewCopy('PDF-Seite {page} von {total}',{page:index,total:pdfDocument.numPages}));reviewPDFViewer?.destroy();reviewPDFViewer=createSourceViewer($('#review-page-canvas'));reviewPDFViewer.setCanvas(canvas);
  localizeReviewPageControls();$('#review-page-prev').disabled=index===1;$('#review-page-next').disabled=index===pdfDocument.numPages;
  pdfRenderTask=page.render({canvas,viewport});await pdfRenderTask.promise;
 }catch(error){if(error.name!=='RenderingCancelledException'&&generation===pdfGeneration)$('#review-preview-error').textContent='Diese Seite konnte nicht dargestellt werden. Bitte die Textvorschau oder den PDF-Download verwenden.';}
}
$('#review-page-prev').onclick=()=>{if(pdfDocument&&pdfPageIndex>1){pdfPageIndex--;void renderReviewPDFPage();}};
$('#review-page-next').onclick=()=>{if(pdfDocument&&pdfPageIndex<pdfDocument.numPages){pdfPageIndex++;void renderReviewPDFPage();}};
let previewResizeTimer,lastPDFPreviewWidth=0;new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width||0;if(Math.abs(width-lastPDFPreviewWidth)<1)return;lastPDFPreviewWidth=width;clearTimeout(previewResizeTimer);previewResizeTimer=setTimeout(()=>{if(!$('#review-pdf').hidden)void renderReviewPDFPage();},160);}).observe($('#review-pdf'));

function clearReviewPDF(){reviewPDFViewer?.destroy();reviewPDFViewer=null;pdfGeneration++;pdfRenderTask?.cancel();if(pdfLoading)void pdfLoading.destroy();pdfDocument=null;$('#review-page-canvas').replaceChildren();}
