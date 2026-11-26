// One design picker, used in Settings and in the intro. The choice stays in this browser (theme.js).
(()=>{
 const copy={
  de:{label:'Design',system:['Automatisch','Folgt deinem System, hell oder dunkel.'],light:['Hell','Klar und ruhig.'],dark:['Dunkel','Angenehm am Abend.'],glass:['Glas','Durchscheinend, mit Tiefe.']},
  en:{label:'Design',system:['Automatic','Follows your system, light or dark.'],light:['Light','Clear and calm.'],dark:['Dark','Easy on the eyes at night.'],glass:['Glass','Translucent, with depth.']},
  ar:{label:'التصميم',system:['تلقائي','يتبع نظامك، فاتح أو داكن.'],light:['فاتح','واضح وهادئ.'],dark:['داكن','مريح في المساء.'],glass:['زجاجي','شفاف بعمق.']}
 };
 const CHOICES=['system','light','dark','glass'];let count=0;
 const text=()=>copy[document.documentElement.lang]||copy[window.TOCRI18n?.getLocale?.()]||copy.en;
 function render(host){
  const name=host.dataset.pickerName||(host.dataset.pickerName=`foliquo-design-${++count}`),current=window.FoliquoTheme?.choice||'system',words=text();
  host.dataset.noTranslate='';host.setAttribute('role','radiogroup');if(!host.hasAttribute('aria-labelledby'))host.setAttribute('aria-label',words.label);
  host.replaceChildren(...CHOICES.map(choice=>{
   const option=document.createElement('label');option.className='design-option';option.dataset.choice=choice;
   const input=document.createElement('input');input.type='radio';input.name=name;input.value=choice;input.checked=choice===current;
   input.addEventListener('change',()=>{if(input.checked)window.FoliquoTheme?.choose(choice);});
   const swatch=document.createElement('span');swatch.className='design-swatch';swatch.dataset.swatch=choice;swatch.setAttribute('aria-hidden','true');
   swatch.innerHTML='<span class="swatch-side"></span><span class="swatch-card"></span><span class="swatch-card swatch-card-small"></span>';
   const copyBox=document.createElement('span');copyBox.className='design-option-copy';
   const title=document.createElement('strong');title.textContent=words[choice][0];const hint=document.createElement('small');hint.textContent=words[choice][1];
   copyBox.append(title,hint);option.append(input,swatch,copyBox);return option;
  }));
 }
 const renderAll=()=>document.querySelectorAll('[data-design-picker]').forEach(render);
 const syncChecked=()=>{const current=window.FoliquoTheme?.choice||'system';document.querySelectorAll('[data-design-picker] input').forEach(input=>{input.checked=input.value===current;});};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',renderAll,{once:true});else renderAll();
 window.addEventListener('foliquo-theme',syncChecked);window.addEventListener('translateocr-locale',renderAll);
 new MutationObserver(renderAll).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 // Desktop apps (macOS, Windows): Glass asks the window for real translucency, so the desktop shows
 // through blurred. The page only turns see-through once the app confirms the effect is on.
 const root=document.documentElement,desktopGlass=window.__FOLIQUO_DESKTOP__===true&&window.__FOLIQUO_WINDOW_GLASS__===true;let requested=null;
 function syncWindow(){
  if(!desktopGlass)return;const glass=window.FoliquoTheme?.design==='glass';if(glass===requested)return;requested=glass;
  if(!glass)delete root.dataset.windowGlass;
  const link=document.createElement('a');link.href=`foliquo-window://${glass?'glass':'solid'}`;link.hidden=true;document.body.append(link);link.click();link.remove();
 }
 window.addEventListener('foliquo-window-glass',event=>{if(event.detail?.applied===true&&window.FoliquoTheme?.design==='glass')root.dataset.windowGlass='';else delete root.dataset.windowGlass;});
 window.addEventListener('foliquo-theme',syncWindow);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncWindow,{once:true});else syncWindow();
 window.TOCRDesignPicker={render:renderAll};
})();
