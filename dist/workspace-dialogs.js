// Native dialogs keep their mounted forms, browser focus containment and state.
(() => {
 const launchers=new WeakMap(),bound=new WeakSet();
 function positionLibraryActionMenu(menu){
  const items=menu?.querySelector('.action-menu-items');if(!menu?.open||!items)return;
  items.style.setProperty('--action-menu-shift-x','0px');
  requestAnimationFrame(()=>{
   if(!menu.open)return;
   const clipper=menu.closest('.workspace-layout'),clip=clipper?.getBoundingClientRect(),clips=clipper&&['clip','hidden','auto','scroll'].includes(getComputedStyle(clipper).overflowX),left=Math.max(16,clips?clip.left:0),right=Math.min(innerWidth-16,clips?clip.right:innerWidth),rect=items.getBoundingClientRect();
   const shift=rect.left<left?left-rect.left:rect.right>right?right-rect.right:0;
   items.style.setProperty('--action-menu-shift-x',`${Math.round(shift*100)/100}px`);
  });
 }
 function closeActionMenu(menu){menu.open=false;menu.querySelector('.action-menu-items')?.style.removeProperty('--action-menu-shift-x');}
 document.addEventListener('click',event=>{const summary=event.target.closest?.('.document-actions-list>.action-menu>summary');if(summary)requestAnimationFrame(()=>positionLibraryActionMenu(summary.parentElement));},true);
 window.addEventListener('resize',()=>{for(const menu of document.querySelectorAll('.document-actions-list>.action-menu[open]'))positionLibraryActionMenu(menu);});
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  const menu=event.target.closest?.('details.action-menu[open]');
  if(!menu)return;
  closeActionMenu(menu);menu.querySelector('summary')?.focus({preventScroll:true});event.preventDefault();event.stopImmediatePropagation();
 });
 document.addEventListener('click',event=>{
  const item=event.target.closest?.('.action-menu-items button');
  for(const menu of document.querySelectorAll('details.action-menu[open]')){
   if(menu.contains(event.target)&&!item)continue;
   const restoreFocus=menu.contains(document.activeElement);
   closeActionMenu(menu);
   if(restoreFocus)menu.querySelector('summary')?.focus({preventScroll:true});
  }
 });
 const api={
  open(dialog,launcher=document.activeElement){if(dialog.open)return;launchers.set(dialog,launcher);dialog.hidden=false;dialog.showModal();},
  close(dialog){if(dialog.open)dialog.close();},
  bind(dialog,dismiss=()=>api.close(dialog),{cancel=true}={}){
   if(bound.has(dialog))return;bound.add(dialog);
   dialog.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const items=[...dialog.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex],[contenteditable="true"]')].filter(el=>{const closedDetails=el.closest('details:not([open])');return !el.disabled&&el.tabIndex>=0&&!el.closest('[hidden],[inert]')&&(!closedDetails||(el.tagName==='SUMMARY'&&el.parentElement===closedDetails))&&el.getClientRects().length;});
    if(!items.length){event.preventDefault();return;}
    const current=items.indexOf(document.activeElement),next=event.shiftKey?(current<=0?items.length-1:current-1):(current+1)%items.length;
    event.preventDefault();items[next].focus();
   });
   if(cancel)dialog.addEventListener('cancel',event=>{event.preventDefault();void dismiss();});
   dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)void dismiss();});
   dialog.addEventListener('close',()=>{const launcher=launchers.get(dialog);launchers.delete(dialog);if(launcher?.isConnected&&!launcher.closest?.('[inert]'))launcher.focus?.({preventScroll:true});});
  }
 };
 window.TOCRDialogs=api;
})();

// Mounted workflow dialogs reuse the shared controller above.
(() => {
 const dialogs=window.TOCRDialogs;
 const tools=document.querySelector('#review-tools-dialog');
 window.closeReviewTools=()=>dialogs.close(tools);
 for(const id of ['review-tools-open','review-proposal-open'])document.querySelector('#'+id).addEventListener('click',event=>{dialogs.open(tools,event.currentTarget);});
 document.querySelector('#review-tools-close').addEventListener('click',window.closeReviewTools);
 dialogs.bind(tools);
 const directEdit=document.querySelector('#direct-edit-dialog');
 document.querySelector('#review-edit-open').addEventListener('click',event=>dialogs.open(directEdit,event.currentTarget));
 document.querySelector('#direct-edit-close').addEventListener('click',()=>dialogs.close(directEdit));
 dialogs.bind(directEdit);
 const manual=document.querySelector('#manual-editor-dialog');
 window.showManualEditor=launcher=>{dialogs.open(manual,launcher||document.activeElement);};
 window.hideManualEditor=()=>{dialogs.close(manual);};
 for(const id of ['manual-editor-close','manual-editor-done'])document.querySelector('#'+id).addEventListener('click',window.hideManualEditor);
 dialogs.bind(manual,window.hideManualEditor);
 const scan=document.querySelector('#scan-dialog');
 document.querySelector('#scan-dialog-open').addEventListener('click',event=>{if(!scan.open){scan.dataset.focusCropOnReady='true';dialogs.open(scan,event.currentTarget);document.querySelector('#scan-analyze').click();}});
 for(const id of ['scan-dialog-close','scan-dialog-done'])document.querySelector('#'+id).addEventListener('click',()=>dialogs.close(scan));
 dialogs.bind(scan);
 for(const id of ['guide-storage-dialog','guide-sources-dialog','guide-update-dialog']){
  const dialog=document.getElementById(id);
  const key=id==='guide-storage-dialog'?'storage':id==='guide-sources-dialog'?'sources':'update';
  document.getElementById(`guide-${key}-open`).addEventListener('click',event=>{dialogs.open(dialog,event.currentTarget);});
  dialog.querySelectorAll('.guide-dialog-close').forEach(button=>button.addEventListener('click',()=>dialogs.close(dialog)));
  dialogs.bind(dialog);
 }
 dialogs.bind(document.querySelector('#clarification-dialog'),()=>document.querySelector('#clarification-close').click(),{cancel:false});
 // Keep the mounted forms intact while hidden, including canvas and file input state.
 window.showClarificationDialog=launcher=>{const dialog=document.querySelector('#clarification-dialog');dialogs.open(dialog,launcher||document.activeElement);};
 window.hideClarificationDialog=()=>dialogs.close(document.querySelector('#clarification-dialog'));
})();
