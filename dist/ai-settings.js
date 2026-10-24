// Reuse one set of connection controls in onboarding and in the header dialog.
(() => {
 const dialog=document.querySelector('#ai-settings-dialog');
 const card=document.querySelector('#connection-card');
 const home=document.querySelector('#ai-settings-home');
 const tourHost=document.querySelector('#intro-ai-host');
 const disclosure=document.querySelector('#send-note');
 const next=document.querySelector('#intro-next');
 const later=document.querySelector('#intro-ai-later');
 let tourStep=false,ready=false;
 function mount(host){host.append(card,disclosure);}
 function sync(){
  next.disabled=tourStep&&!ready;
  later.hidden=!tourStep||ready;
  document.querySelector('#ai-settings-open').dataset.connected=String(ready);
 }
 window.positionAISetupForTour=step=>{
  tourStep=step===2; tourHost.hidden=!tourStep;
  mount(tourStep?tourHost:home);
  sync();
 };
 window.openAISettings=()=>{if(tourStep)return;mount(home);if(!dialog.open)dialog.showModal();};
 document.querySelector('#ai-settings-open').addEventListener('click',window.openAISettings);
 document.querySelector('#guide-ai-open')?.addEventListener('click',window.openAISettings);
 document.querySelector('#ai-settings-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
 window.addEventListener('translateocr-ai-state',event=>{ready=Boolean(event.detail.ready);sync();});
})();
