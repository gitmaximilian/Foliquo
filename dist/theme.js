// Shared app/demo theme state. Runs before paint; never changes document or provider data.
(()=>{
 const root=document.documentElement,key='foliquo-theme',media=matchMedia('(prefers-color-scheme: dark)');
 const copy={en:{label:'Dark mode',dark:'Switch to dark mode',light:'Switch to light mode'},de:{label:'Dunkelmodus',dark:'Zum Dunkelmodus wechseln',light:'Zum hellen Modus wechseln'},ar:{label:'الوضع الداكن',dark:'التبديل إلى الوضع الداكن',light:'التبديل إلى الوضع الفاتح'}};
 const moon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M20 14.4A8.5 8.5 0 0 1 9.6 4a8.5 8.5 0 1 0 10.4 10.4Z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 const sun='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.75"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>';
 let preference=null;try{const saved=localStorage.getItem(key);if(saved==='light'||saved==='dark')preference=saved;}catch{}
 const bound=new WeakSet();
 function current(){return preference||(media.matches?'dark':'light');}
 function sync(){const dark=current()==='dark',text=copy[root.lang]||copy.en;document.querySelectorAll('[data-theme-toggle]').forEach(button=>{button.dataset.noTranslate='';button.setAttribute('aria-label',text.label);button.setAttribute('aria-pressed',String(dark));button.title=dark?text.light:text.dark;button.innerHTML=(dark?sun:moon)+'<span class="theme-toggle-label">'+text.label+'</span>';if(!bound.has(button)){bound.add(button);button.addEventListener('click',()=>set(current()==='dark'?'light':'dark'));}});}
 function apply(){const theme=current();root.dataset.theme=theme;root.style.colorScheme=theme;sync();window.dispatchEvent(new CustomEvent('foliquo-theme',{detail:{theme}}));}
 function set(value){if(value!=='light'&&value!=='dark')return;preference=value;try{localStorage.setItem(key,value);}catch{}apply();}
 function reset(){preference=null;try{localStorage.removeItem(key);}catch{}apply();}
 window.FoliquoTheme={set,reset,get theme(){return current();}};
 apply();
 document.addEventListener('DOMContentLoaded',sync);
 window.addEventListener('translateocr-locale',sync);
 new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['lang']});
 const followSystem=()=>{if(!preference)apply();};
 if(media.addEventListener)media.addEventListener('change',followSystem);else media.addListener(followSystem);
 window.addEventListener('storage',event=>{if(event.key!==key)return;preference=['light','dark'].includes(event.newValue)?event.newValue:null;apply();});
})();
