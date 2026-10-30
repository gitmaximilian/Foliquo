(()=>{
 const ranges=new WeakMap();
 const copy={
  en:{placeholder:'1-3:1; 4-6:2',label:'PDF pages by job',note:'For a PDF, enter page ranges as range:job number, separated by semicolons (for example 1-3:1; 4-6:2). Assign every page once. Page numbers refer to the uploaded PDF; saved scan rotation, crop, and page order are then applied inside each job. Leave blank to keep the whole PDF in the selected job.',invalid:'Check the PDF page ranges. Use entries such as 1-3:1; 4-6:2, without overlaps.'},
  de:{placeholder:'1-3:1; 4-6:2',label:'PDF-Seiten den Aufträgen zuordnen',note:'Bei PDFs Seitenbereiche als Bereich:Auftragsnummer eingeben, getrennt durch Semikolon (zum Beispiel 1-3:1; 4-6:2). Jede Seite genau einmal zuordnen. Die Nummern beziehen sich auf das hochgeladene PDF; gespeicherte Drehung, Zuschnitt und Seitenreihenfolge werden danach im jeweiligen Auftrag angewandt. Leer lassen, um das ganze PDF dem ausgewählten Auftrag zuzuordnen.',invalid:'PDF-Seitenbereiche prüfen. Format: 1-3:1; 4-6:2, ohne Überschneidungen.'},
  ar:{placeholder:'1-3:1; 4-6:2',label:'توزيع صفحات PDF على المهام',note:'في ملفات PDF أدخل نطاق الصفحات ورقم المهمة بصيغة النطاق:رقم المهمة، وافصل بينها بفواصل منقوطة (مثال 1-3:1; 4-6:2). خصص كل صفحة مرة واحدة. تشير الأرقام إلى ملف PDF الأصلي؛ ثم تطبق التدويرات والقص وترتيب الصفحات المحفوظة داخل كل مهمة. اترك الحقل فارغاً لإضافة ملف PDF كاملاً إلى المهمة المحددة.',invalid:'تحقق من نطاقات صفحات PDF. استخدم صيغة مثل 1-3:1; 4-6:2 من دون تداخل.'}
 };
 const locale=()=>copy[window.currentInterfaceLanguage]||copy.en;
 function attach(){
  const batch=$('#batch-mode')?.checked===true;
  document.querySelectorAll('.file-item').forEach((row,index)=>{
   const file=files[index],name=row.querySelector(':scope > span:not(.file-icon)');if(!file||!name||!/\.pdf$/i.test(file.name))return;
   let input=name.querySelector('.file-batch-pages');if(!input){input=document.createElement('input');input.type='text';input.className='file-batch-pages';input.autocomplete='off';input.spellcheck=false;input.value=ranges.get(file)||'';input.oninput=()=>{ranges.set(file,input.value);const group=row.querySelector('.file-batch-group');if(group){group.disabled=Boolean(input.value.trim());group.hidden=Boolean(input.value.trim());}renderState();if(typeof updateQueueButton==='function')updateQueueButton();};name.append(input);}
   input.placeholder=locale().placeholder;input.setAttribute('aria-label',`${file.name} · ${locale().label}`);input.hidden=!batch;
   const group=row.querySelector('.file-batch-group');if(group){group.disabled=Boolean(input.value.trim());group.hidden=Boolean(input.value.trim());}
  });
  const note=$('#batch-range-note');if(note){note.textContent=locale().note;note.hidden=!batch;}
  renderState();
 }
 function renderState(){const groups=window.selectedImportGroups?.(files)||[],error=window.importBatchRangeError||'';const target=$('#batch-range-error');if(target){target.textContent=error;target.hidden=!error;}}
 function parseRanges(value){
  const assignments=[];for(const part of value.split(';').map(value=>value.trim()).filter(Boolean)){
   const match=part.match(/^(\d+)(?:\s*-\s*(\d+))?\s*:\s*(\d+)$/);if(!match)throw new Error(locale().invalid);
   const first=Number(match[1]),last=Number(match[2]||match[1]),group=Number(match[3]);if(first<1||last<first||last>50||group<1||group>10)throw new Error(locale().invalid);
   assignments.push({group,pages:Array.from({length:last-first+1},(_,index)=>first+index)});
  }
  if(!assignments.length)throw new Error(locale().invalid);const seen=new Set();for(const assignment of assignments)for(const page of assignment.pages){if(seen.has(page))throw new Error(locale().invalid);seen.add(page);}return assignments;
 }
 window.importBatchPageSummary=async(selected,groups)=>{
  let renderer=null;const pageCounts=[];let knownPages=0,unknownFiles=0;
  for(const file of selected){
   if(!/\.pdf$/i.test(file.name)){pageCounts.push(1);knownPages++;if(/\.(?:docx?|odt|rtf|txt|md)$/i.test(file.name))unknownFiles++;continue;}
   try{renderer||=await import('/vendor/pdfjs/pdf.mjs');renderer.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.mjs';const loading=renderer.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useWorkerFetch:false,standardFontDataUrl:'/vendor/pdfjs/standard_fonts/',cMapUrl:'/vendor/pdfjs/cmaps/',cMapPacked:true,wasmUrl:'/vendor/pdfjs/wasm/'}),document=await loading.promise,count=document.numPages;await loading.destroy();if(count>50)throw new Error('too many pages');pageCounts.push(count);knownPages+=count;}
   catch{throw new Error(locale()===copy.de?'PDF-Seiten konnten lokal nicht gelesen werden. Bitte Datei prüfen.':locale()===copy.ar?'تعذرت قراءة صفحات PDF محلياً. تحقق من الملف.':'PDF pages could not be read locally. Please check the file.');}
  }
  const assigned=selected.map(()=>[]);for(const group of groups)for(const item of group.items||[]){if(!Number.isInteger(item.fileIndex)||!selected[item.fileIndex])throw new Error(locale().invalid);assigned[item.fileIndex].push(item.pages);}
  for(let index=0;index<selected.length;index++){
   const pages=assigned[index],count=pageCounts[index];if(/\.pdf$/i.test(selected[index].name)){
    const full=pages.filter(value=>value===null);if(full.length===1&&pages.length===1)continue;
    const chosen=pages.flatMap(value=>Array.isArray(value)?value:[]);if(full.length||chosen.length!==count||new Set(chosen).size!==count||Array.from({length:count},(_,page)=>page+1).some(page=>!chosen.includes(page)))throw new Error(locale()===copy.de?'Bitte alle Seiten jeder PDF genau einem Auftrag zuordnen.':locale()===copy.ar?'خصص كل صفحة من كل ملف PDF لمهمة واحدة فقط.':'Assign every page of each PDF to exactly one job.');
   }else if(pages.length!==1||pages[0]!==null)throw new Error(locale().invalid);
  }
  return {knownPages,unknownFiles};
 };
 window.selectedImportGroups=(selected=files)=>{
  const groups=new Map();window.importBatchRangeError='';
  try{selected.forEach((file,index)=>{
   const row=document.querySelectorAll('.file-item')[index],selector=row?.querySelector('.file-batch-group'),groupNumber=Number(selector?.value)||index+1,raw=/\.pdf$/i.test(file.name)?(ranges.get(file)||row?.querySelector('.file-batch-pages')?.value||'').trim():'';
   const assignments=raw?parseRanges(raw):[{group:groupNumber,pages:null}];
   for(const assignment of assignments){const key=String(assignment.group);if(!groups.has(key))groups.set(key,{name:`${locale()===copy.en?'Job':locale()===copy.ar?'المهمة':'Auftrag'} ${key}`,items:[]});const target=groups.get(key),existing=target.items.find(item=>item.fileIndex===index);if(existing){if(!assignment.pages||existing.pages===null)throw new Error(locale().invalid);const seen=new Set(existing.pages);if(assignment.pages.some(page=>seen.has(page)))throw new Error(locale().invalid);existing.pages.push(...assignment.pages);}else target.items.push({fileIndex:index,pages:assignment.pages});}
  });}catch(error){window.importBatchRangeError=error.message;groups.clear();}
  return [...groups.values()];
 };
 $('#batch-mode')?.addEventListener('change',()=>{setTimeout(attach,0);});
 window.addEventListener('translateocr-locale',attach);
 new MutationObserver(attach).observe($('#file-list'),{childList:true,subtree:true});
 attach();
})();
