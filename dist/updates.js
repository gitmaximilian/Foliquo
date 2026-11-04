(() => {
  const button=document.querySelector('#update-check'),status=document.querySelector('#update-status'),download=document.querySelector('#update-download');
  if(!button||!status)return;
  let statusKey='',statusSuffix='';
  const show=(key,suffix='')=>{statusKey=key;statusSuffix=suffix;status.textContent=(window.TOCRI18n?.t(key)||key)+suffix;};
  const isDesktop=()=>window.__FOLIQUO_DESKTOP__===true;
  const canInstall=()=>isDesktop()&&(window.__FOLIQUO_UPDATER__??/Mac|Win/i.test(navigator.platform));
  let prompt=null,promptVersion='',installing=false,handshake=null,manualDownload=false,releaseUrl='https://github.com/gitmaximilian/Foliquo/releases/latest';
  function finishInstall(){installing=false;clearTimeout(handshake);button.disabled=false;if(download)download.removeAttribute('aria-disabled');}
  function manualFallback(key){finishInstall();manualDownload=true;show(key);if(download){download.hidden=false;download.href=releaseUrl;download.textContent=text('Update herunterladen');}}
  function text(key){return window.TOCRI18n?.t(key)||key;}
  function buildPrompt(){
    if(prompt)return prompt;
    prompt=document.createElement('dialog');prompt.className='desktop-update-dialog';prompt.setAttribute('aria-labelledby','desktop-update-title');
    const panel=document.createElement('div');panel.className='desktop-update-panel';
    const title=document.createElement('h2');title.id='desktop-update-title';
    const message=document.createElement('p');message.className='desktop-update-message';
    const version=document.createElement('p');version.className='desktop-update-version';
    const actions=document.createElement('div');actions.className='desktop-update-actions';
    const later=document.createElement('button');later.type='button';later.className='secondary';
    const install=document.createElement('button');install.type='button';install.className='primary';
    actions.append(later,install);panel.append(title,message,version,actions);prompt.append(panel);document.body.append(prompt);
    later.addEventListener('click',()=>{try{sessionStorage.setItem('foliquo-update-dismissed',promptVersion);}catch{}prompt.close();});
    install.addEventListener('click',startInstall);
    prompt.addEventListener('cancel',()=>{try{sessionStorage.setItem('foliquo-update-dismissed',promptVersion);}catch{}});
    prompt.addEventListener('close',()=>{if(!promptVersion)return;try{sessionStorage.setItem('foliquo-update-dismissed',promptVersion);}catch{}});
    prompt._copy=()=>{title.textContent=text('Neue Version verfügbar');message.textContent=text('Eine neue Version von Foliquo ist verfügbar.');version.textContent=`v${promptVersion}`;later.textContent=text('Später');install.textContent=text('Jetzt aktualisieren');};
    return prompt;
  }
  function startInstall(){
    if(!canInstall()||installing)return;
    installing=true;manualDownload=false;button.disabled=true;if(download)download.setAttribute('aria-disabled','true');
    prompt?.close();show('Die aktuelle Version wird geprüft …');
    handshake=setTimeout(()=>manualFallback('Automatisches Update startet nicht. Bitte das Update herunterladen und Foliquo ersetzen. Deine Daten bleiben erhalten.'),12000);
    window.location.href='foliquo-update://install';
  }
  function promptForUpdate(version){
    if(!canInstall()||!version)return;
    let dismissed='';try{dismissed=sessionStorage.getItem('foliquo-update-dismissed')||'';}catch{}
    if(dismissed===version)return;
    promptVersion=version;const dialog=buildPrompt();dialog._copy();if(!dialog.open)dialog.showModal();
  }
  window.addEventListener('translateocr-locale',()=>{if(statusKey)show(statusKey,statusSuffix);if(prompt?.open)prompt._copy();});
  download?.addEventListener('click',event=>{if(manualDownload||!canInstall())return;event.preventDefault();startInstall();});
  window.addEventListener('foliquo-desktop-updater',event=>{
    if(!isDesktop())return;
    const detail=event.detail||{};clearTimeout(handshake);
    if(detail.state==='checking'){installing=true;button.disabled=true;show('Die aktuelle Version wird geprüft …');}
    else if(detail.state==='downloading'){
      const percent=detail.total?` ${Math.min(100,Math.floor(detail.downloaded/detail.total*100))}%`:'';
      show('Update wird heruntergeladen …',percent);
    }else if(detail.state==='installing')show('Update wird installiert …');
    else if(detail.state==='installed')show('Update installiert. Foliquo wird neu gestartet.');
    else if(detail.state==='unavailable'){finishInstall();show('Keine neue Version verfügbar.');}
    else if(detail.state==='failed'){
      const messages={'install-location':'Bitte Foliquo zuerst nach Programme verschieben und von dort öffnen. Danach erneut aktualisieren.',permission:'Foliquo kann an diesem Speicherort nicht ersetzt werden. Bitte das Update herunterladen und Foliquo manuell ersetzen.',platform:'Für diese Installation ist ein manueller Download erforderlich.'};
      manualFallback(messages[detail.reason]||'Update fehlgeschlagen. Bitte das Update herunterladen und Foliquo ersetzen. Deine Daten bleiben erhalten.');
    }
  });
  async function check(){if(installing||button.disabled)return;button.disabled=true;show('Die aktuelle Version wird geprüft …');if(download)download.hidden=true;try{const response=await fetch('/api/update-check',{credentials:'same-origin'});if(!response.ok)throw new Error('Update check failed');const data=await response.json();if(data.unavailable){show('Update-Server gerade nicht erreichbar.');return;}if(data.updateAvailable){releaseUrl=/^https:\/\/github\.com\/gitmaximilian\/Foliquo\/releases\//.test(data.url)?data.url:releaseUrl;manualDownload=!canInstall();show('Neue Version verfügbar:',` v${data.latest} (v${data.current})`);if(download){download.hidden=false;download.href=canInstall()?'foliquo-update://install':releaseUrl;download.textContent=canInstall()?text('Jetzt aktualisieren'):text('Update herunterladen');}promptForUpdate(data.latest);}else show('Keine neue Version verfügbar.');}catch{show('Update-Server gerade nicht erreichbar.');}finally{button.disabled=installing;}}
  button.addEventListener('click',check);window.addEventListener('translateocr-ready',check,{once:true});
  const observer=new MutationObserver(()=>{if(status.dataset.checked==='yes')return;const version=document.querySelector('#app-version')?.textContent;if(version){status.dataset.checked='yes';setTimeout(check,1500);}});observer.observe(document.querySelector('#app-version')||document.body,{childList:true,subtree:true,characterData:true});
  if(isDesktop())window.setInterval(check,24*60*60*1000);
})();
