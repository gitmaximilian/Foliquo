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
 window.openAISettings=launcher=>{if(tourStep)return;mount(home);window.TOCRDialogs.open(dialog,launcher||document.activeElement);};
 document.querySelector('#ai-settings-open').addEventListener('click',event=>window.openAISettings(event.currentTarget));
 document.querySelector('#guide-ai-open')?.addEventListener('click',event=>window.openAISettings(event.currentTarget));
 document.querySelector('#ai-settings-close').addEventListener('click',()=>window.TOCRDialogs.close(dialog));
 window.TOCRDialogs.bind(dialog);
 window.addEventListener('translateocr-ai-state',event=>{ready=Boolean(event.detail.ready);sync();});
})();

// Keep the native model value as the request contract; share the workspace picker styling.
(() => {
 const select=document.querySelector('#model'),label=document.querySelector('#model-label');
 if(!select||select.tagName!=='SELECT'||!label)return;
 const caption=document.createElement('span');caption.id='model-picker-caption';caption.textContent='Modell';
 const trigger=document.createElement('button');trigger.type='button';trigger.id='model-picker-trigger';trigger.className='language-picker-trigger model-picker-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','model-picker-options');trigger.setAttribute('aria-labelledby','model-picker-caption model-picker-value');
 const value=document.createElement('span');value.id='model-picker-value';value.dataset.noTranslate='';const chevron=document.createElement('span');chevron.className='language-picker-chevron';chevron.setAttribute('aria-hidden','true');trigger.append(value,chevron);
 const panel=document.createElement('div');panel.id='model-picker-panel';panel.className='model-picker-panel';panel.setAttribute('popover','manual');panel.hidden=true;
 const search=document.createElement('input');search.type='search';search.dataset.noTranslate='';search.autocomplete='off';search.className='language-picker-search';search.setAttribute('role','combobox');search.setAttribute('aria-autocomplete','list');search.setAttribute('aria-controls','model-picker-options');search.setAttribute('aria-expanded','false');
 const list=document.createElement('div');list.id='model-picker-options';list.className='language-picker-options';list.setAttribute('role','listbox');list.setAttribute('aria-labelledby',caption.id);
 const empty=document.createElement('p');empty.className='language-picker-empty';empty.dataset.noTranslate='';empty.setAttribute('role','status');panel.append(search,list,empty);
 select.hidden=true;label.replaceChildren(caption,select,trigger,panel);
 let opened=false,active=-1,items=[];
 const t=key=>window.TOCRI18n?.t(key)||key;
 function close(restore=false){if(!opened)return;opened=false;if(panel.matches(':popover-open'))panel.hidePopover();panel.hidden=true;trigger.setAttribute('aria-expanded','false');search.setAttribute('aria-expanded','false');search.removeAttribute('aria-activedescendant');if(restore)trigger.focus({preventScroll:true});}
 function sync(){value.textContent=select.selectedOptions[0]?.textContent||t('Modell auswählen');trigger.disabled=select.disabled||!select.options.length;search.setAttribute('aria-label',t('Modelle suchen'));search.placeholder=t('Modelle suchen');if(opened&&(label.hidden||trigger.disabled))close();}
 function activate(index){active=items.length?Math.max(0,Math.min(index,items.length-1)):-1;[...list.children].forEach((el,i)=>el.toggleAttribute('data-active',i===active));if(active<0){search.removeAttribute('aria-activedescendant');return;}search.setAttribute('aria-activedescendant',list.children[active].id);list.children[active].scrollIntoView({block:'nearest'});}
 function choose(index){if(!items[index])return;select.value=items[index].value;close(true);select.dispatchEvent(new Event('change',{bubbles:true}));sync();}
 function render(){const query=search.value.trim().toLocaleLowerCase();items=[...select.options].filter(o=>!o.disabled&&(!query||`${o.textContent} ${o.value}`.toLocaleLowerCase().includes(query)));list.replaceChildren(...items.map((option,i)=>{const el=document.createElement('div');el.id=`model-option-${i}`;el.className='language-picker-option';el.dataset.noTranslate='';el.setAttribute('role','option');el.setAttribute('aria-selected',String(option.value===select.value));el.textContent=option.textContent;el.addEventListener('pointerenter',()=>activate(i));el.addEventListener('click',()=>choose(i));return el;}));empty.textContent=t('Keine passenden Modelle.');empty.hidden=items.length>0;activate(Math.max(0,items.findIndex(o=>o.value===select.value)));}
 function position(){if(!opened)return;const r=trigger.getBoundingClientRect(),below=innerHeight-r.bottom-20,above=r.top-20,up=below<180&&above>below;panel.style.width=`${Math.min(Math.max(r.width,280),innerWidth-24)}px`;panel.style.maxHeight=`${Math.min(360,Math.max(100,up?above:below))}px`;const p=panel.getBoundingClientRect();panel.style.left=`${Math.max(12,Math.min(document.documentElement.dir==='rtl'?r.right-p.width:r.left,innerWidth-p.width-12))}px`;panel.style.top=`${up?Math.max(12,r.top-p.height-8):Math.min(r.bottom+8,innerHeight-p.height-12)}px`;}
 function open(){if(trigger.disabled)return;if(opened){close(true);return;}opened=true;panel.hidden=false;search.value='';trigger.setAttribute('aria-expanded','true');search.setAttribute('aria-expanded','true');render();if(panel.showPopover)panel.showPopover();position();search.focus({preventScroll:true});}
 trigger.addEventListener('click',event=>{event.preventDefault();open();});trigger.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!opened)open();}});
 search.addEventListener('input',()=>{render();position();});search.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();activate(active+1);}else if(event.key==='ArrowUp'){event.preventDefault();activate(active-1);}else if(event.key==='Enter'){event.preventDefault();choose(active);}else if(event.key==='Home'&&event.ctrlKey){event.preventDefault();activate(0);}else if(event.key==='End'&&event.ctrlKey){event.preventDefault();activate(items.length-1);}else if(event.key==='Tab')close(true);});
 document.addEventListener('keydown',event=>{if(opened&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close(true);}},true);
 document.addEventListener('pointerdown',event=>{if(opened&&!panel.contains(event.target)&&!trigger.contains(event.target))close(panel.contains(document.activeElement));});
 label.closest('dialog')?.addEventListener('close',()=>close());window.addEventListener('resize',position);document.addEventListener('scroll',event=>{if(opened&&!panel.contains(event.target))position();},true);
 select.addEventListener('change',sync);new MutationObserver(()=>{sync();if(opened){render();position();}}).observe(select,{childList:true,subtree:true,attributes:true});window.addEventListener('translateocr-ai-state',sync);window.addEventListener('translateocr-locale',()=>{sync();if(opened)render();});sync();
})();
