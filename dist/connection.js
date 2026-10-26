// Browser UI sends provider choices only. API keys stay in the local Node service.
let csrf=null,localRuntime=false,providerReady=false,activeProvider='chatgpt',providerList=[],translating=false,translationAbort=null,preferencesInitialized=false;
let userPreferences={locale:'en',displayName:'',introComplete:false};
window.saveUserPreferences=async(next=userPreferences)=>{const result=await localRequest('/api/preferences',next).then(r=>r.json());userPreferences=result.preferences;return userPreferences;};
let cachedPDF=null,cachedWord=null;
const convertedPreviews=new Map();
const providerKeyMessages=new Map();let providerModelLoading=null,providerModelAttempt=0;
function providerKeyFeedback(id,key){providerKeyMessages.set(id,key);if($('#provider-choice').value===id)$('#provider-key-state').textContent=window.TOCRI18n?.t(key)||key;}
const connectionStatus=$('#connection-description');
function connectionError(message){$('#connection-error').textContent=message||'';}
async function localRequest(path,payload,signal){
 let response;try{response=await fetch(path,{method:payload===undefined?'GET':'POST',credentials:'same-origin',headers:payload===undefined?{}:{'Content-Type':'application/json','X-Foliquo-Csrf':csrf},...(payload===undefined?{}:{body:JSON.stringify(payload)}),signal});}catch(error){if(error.name==='AbortError')throw error;throw new Error('Die lokale Verbindung ist unterbrochen. Läuft Foliquo noch? Bitte die Seite neu laden.');}
 if(!response.ok){let data;try{data=await response.json()}catch{}const error=new Error(data?.error||'Der lokale Dienst ist nicht erreichbar. Bitte Foliquo neu starten.');error.status=response.status;error.diagnostic=data?.diagnostic;if(error.diagnostic)$('#connection-debug').textContent=JSON.stringify(error.diagnostic,null,2);throw error;}return response;
}
function setConnectionPanel(id,open){const panel=document.getElementById(id),button=document.getElementById(id+'-toggle');if(!panel)return;panel.hidden=!open;button?.setAttribute('aria-expanded',String(open));}
for(const id of ['provider-more','connection-diagnostics'])document.getElementById(id+'-toggle')?.addEventListener('click',()=>setConnectionPanel(id,document.getElementById(id).hidden));
function providerInfo(id){return providerList.find(p=>p.id===id)||{id,label:id,help:''};}
function updateProviderPanel(){
 const choice=$('#provider-choice').value,info=providerInfo(choice),configured=choice==='chatgpt'?Boolean(window.chatgptConnected):Boolean(info.configured),chatgpt=choice==='chatgpt';
 const status=$('#provider-status'),statusKey=providerReady?'Verbunden':providerModelLoading===choice?'Modelle werden geladen …':configured&&!chatgpt?'Schlüssel gespeichert · Modell nicht bereit':'Nicht verbunden';status.textContent=window.TOCRI18n?.t(statusKey)||statusKey;status.dataset.ready=String(providerReady);
 $('#provider-help').textContent=info.help||'';if(!chatgpt&&!configured)setConnectionPanel('provider-more',true);$('#provider-api-panel').hidden=chatgpt;$('#connect-chatgpt').hidden=!chatgpt||providerReady;
 $('#provider-key-clear').hidden=chatgpt||!info.configured;const keyState=providerKeyMessages.get(choice)||(info.configured?'API-Schlüssel gespeichert.':'Noch kein API-Schlüssel gespeichert.');$('#provider-key-state').textContent=chatgpt?'':window.TOCRI18n?.t(keyState)||keyState;
 $('#provider-model-row')?.removeAttribute('hidden');$('#model-label').hidden=!configured||!providerReady||!$('#model').options.length;$('#load-models').hidden=!configured;$('#disconnect-chatgpt').hidden=!chatgpt||!window.chatgptConnected;
 if(chatgpt)connectionStatus.textContent=providerReady?'ChatGPT ist verbunden. Die freigegebene Plan-Nutzung wird für diesen Auftrag verwendet.':window.chatgptConnected?'Angemeldet, aber die Freigabe der ChatGPT-Plan-Nutzung fehlt. Bitte erneut verbinden.':'Mit ChatGPT anmelden und Foliquo die Nutzung deines Plans ausdrücklich erlauben. Kein API-Schlüssel erforderlich.';
 else {const key=providerReady?'{provider} ist bereit.':configured?'{provider}: Schlüssel gespeichert. Lade ein Modell, um die Einrichtung abzuschließen.':'{provider}: API-Schlüssel lokal speichern. Danach Modelle laden.';connectionStatus.textContent=(window.TOCRI18n?.t(key)||key).replace('{provider}',info.label);}
 $('#send-note').textContent=(window.TOCRI18n?.t('Die ausgewählten Dateien werden an {provider} gesendet. Das PDF enthält die Originalseiten; Word die bearbeitbare Übersetzung.')||'Die ausgewählten Dateien werden an {provider} gesendet. Das PDF enthält die Originalseiten; Word die bearbeitbare Übersetzung.').replace('{provider}',info.label);
 if(typeof updateQueueButton==='function')updateQueueButton();
 const selectedModel=$('#model'),modelName=selectedModel.options[selectedModel.selectedIndex]?.textContent||'';window.dispatchEvent(new CustomEvent('translateocr-ai-state',{detail:{ready:providerReady&&Boolean(selectedModel.value),providerId:choice,providerName:info.label,modelId:selectedModel.value,modelName,status:status.textContent}}));
}
window.addEventListener('translateocr-locale',()=>{if(localRuntime)updateProviderPanel();});
async function loadProviderModels(id,selectActive=false){
 const attempt=++providerModelAttempt;const button=$('#load-models');if(button)button.disabled=true;providerModelLoading=id;providerReady=false;updateProviderPanel();
 try{const result=await localRequest(`/api/models?provider=${encodeURIComponent(id)}`).then(r=>r.json());if(attempt!==providerModelAttempt||$('#provider-choice').value!==id)return;if(!result.models?.length)throw new Error('Für diesen Anbieter wurden keine Modelle gefunden.');const old=$('#model').value,options=result.models.map(m=>new Option(m.name,m.id));$('#model').replaceChildren(...options);if(options.some(o=>o.value===old))$('#model').value=old;if(selectActive)$('#provider-choice').value=id;providerReady=true;connectionError('');if(id!=='chatgpt')providerKeyFeedback(id,'Modell bereit. Gespeicherter Schlüssel wird verwendet.');updateProviderPanel();$('#connection-debug').textContent=`${infoName(id)}: ${result.models.length} Modelle verfügbar.`;return result;}catch(error){if(attempt!==providerModelAttempt||$('#provider-choice').value!==id)return;providerReady=false;updateProviderPanel();connectionError(error.message);throw error;}finally{if(attempt===providerModelAttempt&&providerModelLoading===id)providerModelLoading=null;if(button)button.disabled=false;updateProviderPanel();}
}
function infoName(id){return providerInfo(id).label||id;}
async function refreshConnection(){
 if(location.hostname!=='127.0.0.1')return;
 try{
  const [sessionResponse,providersResponse]=await Promise.all([fetch('/api/session',{credentials:'same-origin'}),fetch('/api/providers',{credentials:'same-origin'})]);if(!sessionResponse.ok||!providersResponse.ok)throw new Error('Die lokale Einrichtung konnte nicht geladen werden. Bitte Foliquo aktualisieren und die Seite neu laden.');
  const data=await sessionResponse.json(),catalog=await providersResponse.json();if(!data.local)return;
  localRuntime=true;csrf=data.csrf;window.studioDraftAvailable=data.persistent===true;$('#app-version').textContent=data.version||'';if(data.storageError)connectionError(data.storageError);if(!preferencesInitialized&&window.TOCRI18n){userPreferences=data.preferences||userPreferences;window.TOCRI18n.initOnboarding(userPreferences);preferencesInitialized=true;}if(typeof loadLibrary==='function')void loadLibrary();
  providerList=catalog.providers||[];activeProvider=catalog.selected||'chatgpt';$('#provider-choice').value=activeProvider;window.chatgptConnected=Boolean(providerList.find(p=>p.id==='chatgpt')?.configured);
  providerReady=Boolean(data.connected&&data.planEnabled);$('#local-link').hidden=true;$('#provider-settings').hidden=false;
  if(providerReady){try{await loadProviderModels(activeProvider);}catch{/* Keep provider settings accessible for recovery. */}}
  else{$('#model').replaceChildren();$('#model-label').hidden=true;}
  updateProviderPanel();if(typeof updateQueueButton==='function')updateQueueButton();window.dispatchEvent(new Event('translateocr-ready'));if(window.studioDraftAvailable)try{await window.restoreStudioDraft?.();}catch{console.warn('Foliquo: local draft restoration failed; AI settings remain available.');}
 }catch(error){connectionError(error.message);providerReady=false;$('#translate').disabled=true;}
}
$('#provider-choice').onchange=async()=>{
 connectionError('');providerModelAttempt++;providerModelLoading=null;const choice=$('#provider-choice').value,info=providerInfo(choice);
 if(choice==='chatgpt'){
  if(activeProvider!=='chatgpt'&&window.chatgptConnected){try{await localRequest('/api/providers/select',{provider:'chatgpt'});activeProvider='chatgpt';}catch(error){connectionError(error.message);$('#provider-choice').value=activeProvider;}}
  providerReady=Boolean(window.chatgptConnected&&activeProvider==='chatgpt');updateProviderPanel();if(providerReady)await loadProviderModels('chatgpt');else $('#model').replaceChildren();return;
 }
 if(!info.configured){providerReady=false;$('#model').replaceChildren();updateProviderPanel();return;}
 try{await localRequest('/api/providers/select',{provider:choice});activeProvider=choice;providerReady=true;await loadProviderModels(choice);updateProviderPanel();}catch(error){connectionError(error.message);$('#provider-choice').value=activeProvider;updateProviderPanel();}
};
$('#provider-key-save').onclick=async()=>{
 const id=$('#provider-choice').value,key=$('#provider-key').value;if(id==='chatgpt'||!key.trim()){connectionError('Bitte zuerst einen API-Schlüssel einfügen.');return;}
 const button=$('#provider-key-save');let saveConfirmed=false;button.disabled=true;connectionError('');providerKeyFeedback(id,'Wird lokal verschlüsselt gespeichert …');
 try{
  const saved=await localRequest('/api/providers/key',{provider:id,apiKey:key}).then(r=>r.json());
  if(saved.provider!==id||saved.configured!==true)throw new Error('Speichern nicht bestätigt. Bitte erneut prüfen.');
  saveConfirmed=true;$('#provider-key').value='';providerList=providerList.map(p=>p.id===id?{...p,configured:true}:p);providerKeyFeedback(id,'Schlüssel gespeichert. Modelle werden geladen …');
  await localRequest('/api/providers/select',{provider:id});activeProvider=id;await loadProviderModels(id,true);providerKeyFeedback(id,'Schlüssel gespeichert. Modell bereit.');updateProviderPanel();
 }catch(error){
  providerReady=false;connectionError(error.message);
  try{const data=await localRequest('/api/providers').then(r=>r.json());providerList=data.providers;activeProvider=data.selected||activeProvider;}catch{}
  $('#provider-choice').value=id;providerKeyFeedback(id,saveConfirmed?'Schlüssel gespeichert. Modelle konnten nicht geladen werden. Erneut laden.':'Speichern nicht bestätigt. Bitte erneut prüfen.');updateProviderPanel();
 }finally{button.disabled=false;}
};
$('#provider-key-clear').onclick=async()=>{
 const id=$('#provider-choice').value;if(!confirm('Den lokal gespeicherten API-Schlüssel entfernen?'))return;
 try{await localRequest('/api/providers/key/clear',{provider:id});const data=await localRequest('/api/providers').then(r=>r.json());providerList=data.providers;activeProvider=data.selected;providerKeyMessages.delete(id);providerReady=activeProvider==='chatgpt'&&Boolean(window.chatgptConnected);$('#provider-choice').value=id;$('#model').replaceChildren();updateProviderPanel();connectionError('');}catch(error){connectionError(error.message);}
};
$('#load-models').onclick=async()=>{try{await loadProviderModels($('#provider-choice').value);}catch{}};
$('#connect-chatgpt').onclick=async()=>{connectionError('');$('#connect-chatgpt').disabled=true;try{if(activeProvider!=='chatgpt'){await localRequest('/api/providers/select',{provider:'chatgpt'});activeProvider='chatgpt';}const result=await localRequest('/api/auth/start',{}).then(r=>r.json());location.assign(result.url);}catch(error){connectionError(error.message);$('#connect-chatgpt').disabled=false;}};
$('#disconnect-chatgpt').onclick=async()=>{connectionError('');$('#disconnect-chatgpt').disabled=true;try{const result=await localRequest('/api/auth/logout',{}).then(r=>r.json());if(!result.revoked)connectionError('Lokal getrennt. Der Widerruf bei OpenAI konnte nicht bestätigt werden. Du kannst Foliquo zusätzlich in deinen ChatGPT-Einstellungen trennen.');await refreshConnection();}catch(error){connectionError(error.message)}finally{$('#disconnect-chatgpt').disabled=false;}};
$('#model').onchange=()=>{providerReady=Boolean($('#model').value)&&$('#provider-choice').value===activeProvider;updateProviderPanel();};
function documentMetadata(){const sourceLanguage=$('#source-language')?.value||'Automatisch';return {documentType:detectedDocument?.documentType||'Automatisch',language:sourceLanguage==='Automatisch'?detectedDocument?.sourceLanguage||'Automatisch':sourceLanguage,sourceLanguage,targetLanguage:$('#target-language').value,additionalInfo:$('#additional-info').value.trim(),fileRoles:files.map(f=>fileRoles.get(f)||'auto'),scanCorrections:typeof correctionsForFiles==='function'?correctionsForFiles(files):[],example};}
function fileBase64(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Eine Datei konnte nicht gelesen werden.'));reader.readAsDataURL(blob);});}
async function documentsForRequest(selected=files){if(selected.reduce((s,f)=>s+f.size,0)>35*1024*1024)throw new Error('Bitte maximal 35 MB Dokumente auf einmal verarbeiten.');const result=[];for(const file of selected){result.push({name:file.name,type:file.type,data:await fileBase64(file)});}return result;}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function downloadBase64(base64,name,type){const raw=atob(base64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));downloadBlob(new Blob([bytes],{type}),name);}
function downloadPDF(base64,name='foliquo-uebersetzung.pdf'){downloadBase64(base64,name,'application/pdf');}
function downloadWord(base64,name='foliquo-uebersetzung.docx'){downloadBase64(base64,name,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');}
function pdfFingerprint(){return JSON.stringify({text:$('#translation').value,metadata:documentMetadata(),files:example?[]:files.map(f=>[f.name,f.size,f.lastModified])});}
function lockStudio(locked){window.manualExporting=locked;const dialog=$('#manual-editor-dialog');dialog.querySelectorAll('button,input,select,textarea').forEach(el=>{if(el.id==='manual-export-cancel')return;if(locked){el.dataset.previousDisabled=String(el.disabled);el.disabled=true;}else{el.disabled=el.dataset.previousDisabled==='true';delete el.dataset.previousDisabled;}});$('#manual-export-cancel').hidden=!locked;const status=$('#manual-export-status');status.hidden=!locked;if(!locked)status.textContent='';}
$('#cancel-translation').onclick=$('#manual-export-cancel').onclick=()=>translationAbort?.abort();
$('#pdf-download').onclick=async()=>{if(window.ensureExportSourceLanguage&&!window.ensureExportSourceLanguage())return;if(!$('#translation').value.trim()){toast('Bitte zuerst eine Übersetzung erstellen.');return;}if(!localRuntime){toast('Für den direkten PDF-Export bitte die lokale Anwendung öffnen. Der Druckexport steht auch hier zur Verfügung.');return;}const fingerprint=pdfFingerprint();if(cachedPDF?.fingerprint===fingerprint){downloadPDF(cachedPDF.data);return;}translationAbort=new AbortController();lockStudio(true);$('#manual-export-status').textContent='PDF mit Übersetzung und Originalseiten wird erstellt …';try{const upload=example?[]:await documentsForRequest();const response=await localRequest('/api/pdf',{text:$('#translation').value,files:upload,metadata:{...documentMetadata(),targetLanguage:draftTargetLanguage||$('#target-language').value}},translationAbort.signal);const data=await fileBase64(await response.blob());cachedPDF={fingerprint,data};downloadPDF(data);exported();}catch(error){toast(error.name==='AbortError'?'PDF-Erstellung abgebrochen.':error.message)}finally{lockStudio(false);translationAbort=null;}};
window.addEventListener('beforeunload',event=>{if(translating||window.manualExporting){event.preventDefault();event.returnValue='';}});
refreshConnection();
async function renderFilePreview(file,frame){frame._previewFile=file;frame.replaceChildren();const ext=file.name.split('.').pop().toLowerCase();try{let blob=file,type=file.type;if(!['pdf','jpg','jpeg','png','webp','gif','avif'].includes(ext)){const loading=document.createElement('p');loading.textContent=localRuntime?(window.TOCRI18n?.t('Vorschau wird lokal vorbereitet …')||'Vorschau wird lokal vorbereitet …'):(window.TOCRI18n?.t('Die Vorschau für dieses Format steht in der lokalen Anwendung zur Verfügung.')||'Die Vorschau für dieses Format steht in der lokalen Anwendung zur Verfügung.');frame.append(loading);if(!localRuntime)return;let converted=convertedPreviews.get(file.name);if(!converted){const result=await localRequest('/api/preview',{files:[{name:file.name,type:file.type,data:await fileBase64(file)}]}).then(r=>r.json());converted=result.files[0];convertedPreviews.set(file.name,converted);}const raw=atob(converted.data),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));blob=new Blob([bytes],{type:converted.type});type=converted.type;}if(frame._previewFile!==file)return;const url=URL.createObjectURL(blob);urls.push(url);const el=type==='application/pdf'||ext==='pdf'?document.createElement('iframe'):document.createElement('img');if(el.tagName==='IFRAME')el.title='Originalvorschau';else el.alt=`Original: ${file.name}`;el.src=url;frame.replaceChildren(el);}catch(error){if(frame._previewFile!==file)return;const p=document.createElement('p');p.textContent=error.message;frame.replaceChildren(p);}}
$('#word-download').onclick=async()=>{if(window.ensureExportSourceLanguage&&!window.ensureExportSourceLanguage())return;if(!$('#translation').value.trim()){toast('Bitte zuerst eine Übersetzung erstellen.');return;}if(!localRuntime){toast('Für den Word-Export bitte die lokale Anwendung öffnen.');return;}const fingerprint=pdfFingerprint();if(cachedWord?.fingerprint===fingerprint){downloadWord(cachedWord.data);return;}translationAbort=new AbortController();lockStudio(true);$('#manual-export-status').textContent='Word-Datei wird erstellt …';try{const response=await localRequest('/api/word',{text:$('#translation').value,metadata:{...documentMetadata(),targetLanguage:draftTargetLanguage||$('#target-language').value}},translationAbort.signal);const data=await fileBase64(await response.blob());cachedWord={fingerprint,data};downloadWord(data);exported();}catch(error){toast(error.name==='AbortError'?'Word-Erstellung abgebrochen.':error.message);}finally{lockStudio(false);translationAbort=null;}};
$('#check-connection').onclick=async()=>{
 const button=$('#check-connection');button.disabled=true;$('#connection-debug').textContent=uiText('Verbindung wird geprüft …');
 try{
  const id=$('#provider-choice').value;
  if(providerInfo(id).configured){const result=await localRequest(`/api/models?provider=${encodeURIComponent(id)}&refresh=1`).then(r=>r.json());$('#connection-debug').textContent=`${infoName(id)}: ${result.models.length} Modelle verfügbar. `+uiText('Modellkatalog geprüft. Eine Übersetzung und verfügbares Guthaben wurden damit noch nicht getestet.');}
  else if(id==='chatgpt'){
   const result=await localRequest('/api/diagnostics/check',{}).then(r=>r.json());
   $('#connection-debug').textContent=result.checks.map(check=>`${check.host}: ${check.reachable?'HTTP '+check.httpStatus:uiText('Nicht erreichbar')}`).join('\n')+'\n'+uiText('Netzwerktest ohne Anmeldung. Zum Verbinden Continue with ChatGPT wählen.');
  }else $('#connection-debug').textContent=uiText('Bitte zuerst einen API-Schlüssel speichern.');
 }catch(error){$('#connection-debug').textContent=error.diagnostic?JSON.stringify(error.diagnostic,null,2):error.message;}finally{button.disabled=false;}
};
