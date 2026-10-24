(() => {
 const tools=document.querySelector('#review-tools-dialog');
 window.closeReviewTools=()=>tools.close();
 for(const id of ['review-tools-open','review-proposal-open'])document.querySelector('#'+id).addEventListener('click',()=>{if(!tools.open)tools.showModal();});
 document.querySelector('#review-tools-close').addEventListener('click',window.closeReviewTools);
 const manual=document.querySelector('#manual-editor-dialog');
 window.showManualEditor=()=>{if(!manual.open)manual.showModal();};
 window.hideManualEditor=()=>{if(manual.open)manual.close();};
 for(const id of ['manual-editor-close','manual-editor-done'])document.querySelector('#'+id).addEventListener('click',window.hideManualEditor);
 manual.addEventListener('click',event=>{if(event.target===manual){const r=manual.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)window.hideManualEditor();}});
 const scan=document.querySelector('#scan-dialog');
 document.querySelector('#scan-dialog-open').addEventListener('click',()=>{if(!scan.open)scan.showModal();});
 for(const id of ['scan-dialog-close','scan-dialog-done'])document.querySelector('#'+id).addEventListener('click',()=>scan.close());
 scan.addEventListener('click',event=>{if(event.target===scan){const r=scan.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)scan.close();}});
 // Keep the mounted forms intact while hidden, including canvas and file input state.
 window.showClarificationDialog=()=>{const dialog=document.querySelector('#clarification-dialog');if(!dialog.open)dialog.showModal();};
 window.hideClarificationDialog=()=>document.querySelector('#clarification-dialog').close();
})();
