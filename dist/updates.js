(() => {
  const button=document.querySelector('#update-check'),status=document.querySelector('#update-status'),download=document.querySelector('#update-download');
  if(!button||!status)return;
  let statusKey='',statusSuffix='';
  const show=(key,suffix='')=>{statusKey=key;statusSuffix=suffix;status.textContent=(window.TOCRI18n?.t(key)||key)+suffix;};
  window.addEventListener('translateocr-locale',()=>{if(statusKey)show(statusKey,statusSuffix);});
  async function check(){button.disabled=true;show('Die aktuelle Version wird geprüft …');download.hidden=true;try{const response=await fetch('/api/update-check',{credentials:'same-origin'});if(!response.ok)throw new Error('Update check failed');const data=await response.json();if(data.unavailable){show('Update-Server gerade nicht erreichbar.');return;}if(data.updateAvailable){show('Neue Version verfügbar:',` v${data.latest} (v${data.current})`);download.hidden=false;download.href=data.url;}else show('Keine neue Version verfügbar.');}catch{show('Update-Server gerade nicht erreichbar.');}finally{button.disabled=false;}}
  button.addEventListener('click',check);window.addEventListener('translateocr-ready',check,{once:true});
  const observer=new MutationObserver(()=>{if(status.dataset.checked==='yes')return;const version=document.querySelector('#app-version')?.textContent;if(version){status.dataset.checked='yes';setTimeout(check,1500);}});observer.observe(document.querySelector('#app-version')||document.body,{childList:true,subtree:true,characterData:true});
})();
