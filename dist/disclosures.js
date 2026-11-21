// Fewer fold-outs: informational <details> stay open and read as a titled section; only optional input forms
// and menus still fold, and those look like a button with a chevron instead of a "▶ text" link.
(()=>{
 // These still fold: optional forms, menus, long technical lists and per-item detail rows.
 const FOLDABLE=[
  '.action-menu','.manual-action-menu','.studio-options','.extra-info','.translation-context','.clarification-extra-options',
  '#review-rule-options','#review-other-formats','.rule-entry-details','.rule-filter-advanced','.glossary-add','#glossary-mapping','.foli-tools','.foli-confirmation','.job-debug','.provider-usage-records',
  '.connection-controls','.connection-diagnostics','.learning-entry-details','.learning-analysis-disclosure','.regions-card details',
  '.dossier-attach','.review-trace-row','.used-reference','[data-foldable]'
 ].join(',');
 const flatten=details=>{
  if(details.dataset.flat==='1'||details.matches(FOLDABLE))return;
  details.dataset.flat='1';details.open=true;
  const summary=details.querySelector(':scope>summary');
  if(summary){summary.tabIndex=-1;summary.setAttribute('role','heading');summary.setAttribute('aria-level','3');}
 };
 const scan=root=>{if(root.matches?.('details'))flatten(root);root.querySelectorAll?.('details').forEach(flatten);};
 // A flat section never closes, whatever is clicked or pressed on its title.
 document.addEventListener('click',event=>{const summary=event.target.closest?.('details[data-flat="1"]>summary');if(summary)event.preventDefault();},true);
 document.addEventListener('toggle',event=>{const details=event.target;if(details?.dataset?.flat==='1'&&!details.open)details.open=true;},true);
 const start=()=>{scan(document.body);new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)scan(node);}).observe(document.body,{childList:true,subtree:true});};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
 window.TOCRDisclosures={flatten,FOLDABLE};
})();
