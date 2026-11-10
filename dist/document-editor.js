(() => {
  const $ = selector => document.querySelector(selector);
  const t = key => window.TOCRI18n?.t?.(key) || key;
  let model = null, mode = 'text', host, toolbar, undo = [], redo = [];
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = () => crypto.randomUUID();
  const button = (label, onClick, className = 'secondary') => {
    const el = document.createElement('button'); el.type = 'button'; el.className = className; el.dataset.translationKey = label; el.textContent = t(label); el.onclick = onClick; return el;
  };
  function asText(value) {
    const lines = value.blocks.flatMap(block => {
      if (block.type === 'table') return block.rows.map((row, i) => row.map(cell => cell.text).join(block.rowDelimiters?.[i] || ' | '));
      if (block.type === 'stamp') return [block.properties?.marker || 'Stempel:', ...block.content.split('\n')];
      if (block.type === 'list') return block.items;
      if (block.type === 'pageBreak') return ['[Seitenumbruch]'];
      return [block.content];
    }).join('\n');
    return lines + (value.legacy?.trailingNewline ? '\n' : '');
  }
  function fromText(text, previous) {
    const trailingNewline = text.endsWith('\n'), lines = text.split('\n'), blocks = [];
    if (trailingNewline) lines.pop();
    const add = (type, content) => blocks.push({ id: uid(), type, sourceBlockIds: [], ...content });
    for (let i = 0; i < lines.length;) {
      const line = lines[i];
      if (/^\s*(?:Stempel|Stamp|ختم)\s*:\s*$/iu.test(line)) {
        const content = [], marker = line;
        while (i + 1 < lines.length && lines[i + 1].trim()) content.push(lines[++i]);
        if (content.length) add('stamp', { content: content.join('\n'), properties: { marker } }); else add('paragraph', { content: marker });
        i++; continue;
      }
      if (line.includes(' | ') || line.includes('\t')) {
        const rows = [], delimiters = [];
        while (i < lines.length && (lines[i].includes(' | ') || lines[i].includes('\t'))) {
          const delimiter = lines[i].includes('\t') ? '\t' : ' | ';
          rows.push(lines[i++].split(delimiter).map(text => ({ id: uid(), text, sourceBlockIds: [] }))); delimiters.push(delimiter);
        }
        const count = Math.max(...rows.map(row => row.length));
        add('table', { rows, relativeColumnWidths: Array(count).fill(100 / count), rowDelimiters: delimiters, keepRows: true }); continue;
      }
      if (line === '[Seitenumbruch]') add('pageBreak', {});
      else if (/^\s*(?:[-*•]|\d+[.)])\s+/.test(line)) {
        const items = []; while (i < lines.length && /^\s*(?:[-*•]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++]);
        add('list', { items }); continue;
      } else if (/^\s*\(?(?:Vorderseite|Rückseite|Seite\s+\d+)\)?[:.]?\s*$/iu.test(line)) add('heading', { content: line });
      else add('paragraph', { content: line });
      i++;
    }
    return { ...previous, blocks, legacy: { ...(previous.legacy || {}), trailingNewline } };
  }
  function saveHistory() { if (!model) return; undo.push(clone(model)); if (undo.length > 50) undo.shift(); redo = []; updateHistory(); }
  function updateHistory() { $('#document-undo').disabled = !undo.length; $('#document-redo').disabled = !redo.length; }
  function restore(from, to) { if (!from.length) return; to.push(clone(model)); model = from.pop(); updateHistory(); render(); }
  function unit(index){const id=model.blocks[index]?.properties?.columnGroup;if(!id)return {start:index,end:index};return {start:model.blocks.findIndex(block=>block.properties?.columnGroup===id),end:model.blocks.findLastIndex(block=>block.properties?.columnGroup===id)};}
  function moveUnit(index,delta){const current=unit(index),adjacent=delta<0?current.start-1:current.end+1;if(adjacent<0||adjacent>=model.blocks.length)return;const other=unit(adjacent);saveHistory();const start=Math.min(current.start,other.start),end=Math.max(current.end,other.end),first=model.blocks.slice(start,delta<0?current.start:other.start),second=model.blocks.slice(delta<0?current.start:other.start,end+1);model.blocks.splice(start,end-start+1,...second,...first);render();}
  function dissolveColumns(id){saveHistory();for(const block of model.blocks)if(block.properties?.columnGroup===id)for(const key of ['columnGroup','columnCount','columnIndex','columnWidth'])delete block.properties[key];render();}
  function updateColumnButton(){const control=toolbar?.querySelector('[data-column-action]');if(control)control.disabled=mode!=='structure'||!model||model.blocks.length<2;}
  function columnDialog(index=0){
    if(!model||model.blocks.length<2)return;const group=model.blocks[index]?.properties?.columnGroup,range=unit(index),opener=document.activeElement,dialog=document.createElement('dialog');dialog.className='rule-dialog document-column-dialog';dialog.dataset.noTranslate='';const form=document.createElement('form'),heading=document.createElement('h2');heading.textContent=t('Spalten anordnen');heading.id='document-column-title';dialog.setAttribute('aria-labelledby',heading.id);form.append(heading);
    const error=document.createElement('p');error.className='error';error.setAttribute('role','alert');form.append(error);const controls={};
    function select(key,labelText){const label=document.createElement('label');label.textContent=t(labelText);const input=document.createElement('select');input.setAttribute('aria-label',t(labelText));model.blocks.forEach((block,i)=>{const option=new Option(`${i+1}. ${asText({blocks:[block]}).slice(0,65)}`,i);option.dataset.noTranslate='';input.add(option);});label.append(input);form.append(label);controls[key]=input;return input;}
    select('start','Erster Block');select('end','Letzter Block');select('second','Beginn der zweiten Spalte');select('third','Beginn der dritten Spalte');
    const countLabel=document.createElement('label');countLabel.textContent=t('Anzahl Lesespalten');const count=document.createElement('select');count.setAttribute('aria-label',t('Anzahl Lesespalten'));for(const value of [2,3])count.add(new Option(String(value),value));countLabel.append(count);form.append(countLabel);
    const widths=document.createElement('div');widths.className='form-pair';const widthInputs=Array.from({length:3},(_,i)=>{const label=document.createElement('label');label.textContent=`${t('Breite Lesespalte')} ${i+1} (%)`;const input=document.createElement('input');input.type='number';input.min='10';input.max='90';input.step='.01';input.required=true;input.setAttribute('aria-label',`${t('Breite Lesespalte')} ${i+1}`);label.append(input);widths.append(label);return input;});form.append(widths);
    const start=group?range.start:index,end=group?range.end:Math.min(model.blocks.length-1,index+1);controls.start.value=String(start);controls.end.value=String(end);controls.start.disabled=controls.end.disabled=Boolean(group);if(group&&end-start<2)count.options[1].disabled=true;count.value=String(group?model.blocks[index].properties.columnCount:2);
    const split=column=>model.blocks.findIndex((block,i)=>i>=start&&i<=end&&block.properties?.columnIndex===column&&block.properties?.columnGroup===group);
    controls.second.value=String(group?split(1):end);controls.third.value=String(group&&Number(count.value)===3?split(2):Math.min(end,start+2));
    function layout(reset=false){const total=Number(count.value);controls.third.closest('label').hidden=total!==3;widthInputs.forEach((input,i)=>{input.closest('label').hidden=i>=total;input.disabled=i>=total;if(reset||!input.value){const block=group&&model.blocks.find(block=>block.properties?.columnGroup===group&&block.properties.columnIndex===i);input.value=String(!reset&&block?.properties.columnWidth!==undefined?block.properties.columnWidth:Math.round(10000/total)/100);}});if(total===3&&reset)widthInputs[2].value='33.34';}
    layout();count.onchange=()=>layout(true);const note=document.createElement('p');note.className='muted';note.textContent=t('Die Reihenfolge der Blöcke bleibt die Lesereihenfolge. Spaltenbreiten müssen zusammen 100 Prozent ergeben.');form.append(note);
    const actions=document.createElement('div');actions.className='rule-actions';const apply=button('Spalten übernehmen',()=>{});apply.type='submit';const cancel=button('Abbrechen',()=>dialog.close());actions.append(apply,cancel);form.append(actions);dialog.append(form);
    form.onsubmit=event=>{event.preventDefault();const first=Number(controls.start.value),last=Number(controls.end.value),second=Number(controls.second.value),third=Number(controls.third.value),total=Number(count.value),values=widthInputs.slice(0,total).map(input=>Number(input.value));
      if(!(first<second&&second<=last&&first>=0&&last<model.blocks.length)){error.textContent=t('Wähle einen zusammenhängenden Bereich und die Spaltenanfänge.');return;}
      if(total===3&&!(second<third&&third<=last)){error.textContent=t('Wähle einen zusammenhängenden Bereich und die Spaltenanfänge.');return;}
      if(values.some(value=>!Number.isFinite(value)||value<10||value>90)||Math.abs(values.reduce((sum,value)=>sum+value,0)-100)>.1){error.textContent=t('Spaltenbreiten müssen zusammen 100 Prozent ergeben.');return;}
      const selected=model.blocks.slice(first,last+1),ids=new Set(selected.map(block=>block.properties?.columnGroup).filter(Boolean));if(selected.some(block=>block.type==='pageBreak')||model.blocks.some((block,i)=>(i<first||i>last)&&ids.has(block.properties?.columnGroup))){error.textContent=t('Seitenumbrüche ausschließen und bestehende Spaltengruppen vollständig auswählen.');return;}
      saveHistory();const id=group&&ids.has(group)?group:uid();selected.forEach((block,i)=>{const absolute=first+i,column=absolute<second?0:total===2||absolute<third?1:2;block.properties={...block.properties,columnGroup:id,columnCount:total,columnIndex:column,columnWidth:values[column]};});render();dialog.close();
    };
    dialog.addEventListener('close',()=>{dialog.remove();if(opener?.isConnected)opener.focus();else toolbar.querySelector('[data-column-action]')?.focus();},{once:true});document.body.append(dialog);window.TOCRDialogs.bind(dialog);window.TOCRDialogs.open(dialog,opener);(group?controls.second:controls.start).focus();
  }
  const unresolvedHandwriting=block=>block.properties?.role==='handwriting'&&(block.properties.handwritingState==='uncertain'||!block.properties.handwritingState&&!/^\[Handschriftlich:\s*unleserlich\]$/iu.test(block.content?.trim()||''));
  function inspectHandwriting(block){window.TOCRDialogs.close($('#direct-edit-dialog'));const item=reviewData?.sourceInventory?.items?.find(item=>block.sourceBlockIds?.includes(item.id)||item.targetNodeIds?.includes(block.id));if(item)window.TOCRSourceInventory?.open(item.id,reviewData);else{const ref=model.sourceRefs?.find(ref=>block.sourceBlockIds?.includes(ref.id));void focusField({id:block.id,fileIndex:ref?.fileIndex??0,page:ref?.page??1,box:ref?.box??null,translated:''},{locate:false,original:true});}}
  function render() {
    if (!host || !model) return;
    host.replaceChildren();
    model.blocks.forEach((block, index) => {
      const card = document.createElement('section'); card.className = 'structured-block';
      const head = document.createElement('div'); head.className = 'structured-block-head';
      const title = document.createElement('strong'); title.textContent = `${t(({ heading: 'Überschrift', paragraph: 'Absatz', table: 'Tabelle', stamp: 'Stempel', list: 'Liste', pageBreak: 'Seitenumbruch' })[block.type] || 'Text')} ${index + 1}`; head.append(title);
      const range=unit(index),group=block.properties?.columnGroup;
      for (const [label, delta] of [['Nach oben', -1], ['Nach unten', 1]]) { const move = button(group?(delta<0?'Spaltengruppe nach oben':'Spaltengruppe nach unten'):label, () => moveUnit(index,delta), 'text-button'); move.disabled = delta<0?range.start===0:range.end===model.blocks.length-1;head.append(move); }
      const remove=button('Block entfernen',()=>{saveHistory();model.blocks.splice(index,1);render();},'text-button');remove.disabled=Boolean(group&&model.blocks.filter(item=>item.properties?.columnGroup===group&&item.properties.columnIndex===block.properties.columnIndex).length===1);head.append(remove);card.append(head);
      if(group){const info=document.createElement('p');info.className='muted';info.textContent=`${t('Lesespalte')} ${block.properties.columnIndex+1} / ${block.properties.columnCount}`;card.append(info,button('Spalten bearbeiten',()=>columnDialog(index),'text-button'),button('Spalten auflösen',()=>dissolveColumns(group),'text-button'));}
      if(['paragraph','heading'].includes(block.type)){
        const label=document.createElement('label');label.textContent=t('Bereichsart');const role=document.createElement('select');role.setAttribute('aria-label',t('Bereichsart'));for(const [id,key]of [['body','Normaler Text'],['margin','Randnotiz'],['signature','Unterschrift'],['handwriting','Handschrift']])role.add(new Option(t(key),id));role.value=block.properties?.role||'body';role.onchange=()=>{saveHistory();block.properties={...block.properties,role:role.value};if(role.value==='handwriting')block.properties.handwritingState='uncertain';else delete block.properties.handwritingState;delete block.properties.handwritingReviewedAt;render();};label.append(role);card.append(label);
        if(block.properties?.role==='handwriting'){
          const status=document.createElement('p');status.dataset.handwritingStatus='';status.className=unresolvedHandwriting(block)?'error':'muted';status.textContent=t(unresolvedHandwriting(block)?'Unklare Handschrift: vor der Übernahme am Original klären.':block.properties.handwritingState==='unreadable'?'Ausdrücklich als unleserlich markiert.':'Am Original bestätigte Handschrift.');card.append(status,button('Original zur Handschrift ansehen',()=>inspectHandwriting(block),'text-button'));
          const confirm=button('Handschrift am Original bestätigt',()=>{if(!block.content.trim())return;saveHistory();block.properties={...block.properties,handwritingState:'confirmed',handwritingReviewedAt:Date.now()};$('#workflow-local-error').textContent='';render();});confirm.dataset.handwritingConfirm='';confirm.disabled=!block.content.trim();card.append(confirm,button('Handschrift als unleserlich markieren',()=>{saveHistory();block.content='[Handschriftlich: unleserlich]';block.properties={...block.properties,handwritingState:'unreadable',handwritingReviewedAt:Date.now()};$('#workflow-local-error').textContent='';render();}));
        }
      }
      const edit = (value, label, rows, apply) => { const input = document.createElement('textarea'); input.rows = rows; input.maxLength = 20000; input.value = value; input.setAttribute('aria-label', label); input.oninput = () => { saveHistory(); apply(input.value); }; card.append(input); };
      if (['paragraph', 'heading', 'stamp'].includes(block.type)) edit(block.content, `${t('Inhalt')} ${index + 1}`, Math.min(8, Math.max(2, block.content.split('\n').length)), value => { block.content = value;if(block.properties?.role==='handwriting'){block.properties.handwritingState='uncertain';delete block.properties.handwritingReviewedAt;const status=card.querySelector('[data-handwriting-status]');if(status){status.className='error';status.textContent=t('Unklare Handschrift: vor der Übernahme am Original klären.');}const confirm=card.querySelector('[data-handwriting-confirm]');if(confirm)confirm.disabled=!value.trim();} });
      if (block.type === 'list') edit(block.items.join('\n'), `${t('Listeneinträge')} ${index + 1}`, Math.min(10, Math.max(3, block.items.length)), value => { block.items = value.split('\n').slice(0, 1000); });
      if (block.type === 'table') {
        const options=document.createElement('div');options.className='form-pair';const headerLabel=document.createElement('label');headerLabel.textContent=t('Wiederholte Kopfzeilen');const headerCount=document.createElement('input');headerCount.type='number';headerCount.min='0';headerCount.max=String(Math.min(5,block.rows.length));headerCount.value=String(block.properties?.headerRows||0);headerCount.setAttribute('aria-label',t('Wiederholte Kopfzeilen'));headerCount.onchange=()=>{saveHistory();block.properties={...block.properties,headerRows:Math.max(0,Math.min(5,block.rows.length,Math.floor(Number(headerCount.value)||0)))};render();};headerLabel.append(headerCount);const keepLabel=document.createElement('label');keepLabel.className='check-label';const keep=document.createElement('input');keep.type='checkbox';keep.checked=block.keepRows!==false;keep.onchange=()=>{saveHistory();block.keepRows=keep.checked;};keepLabel.append(keep,document.createTextNode(t('Zeilen nach Möglichkeit zusammenhalten')));options.append(headerLabel,keepLabel);card.append(options);const note=document.createElement('small');note.className='muted';note.textContent=t('Seitenlange Zeilen müssen umbrechen. Die Auftragseinstellung kann den Zeilenzusammenhalt ausschalten.');card.append(note);
        const widths = document.createElement('div'); widths.className = 'structured-column-widths';
        block.relativeColumnWidths.forEach((width, column) => { const label = document.createElement('label'); label.textContent = `${t('Spalte')} ${column + 1} · ${t('Prozent')}`; const input = document.createElement('input'); input.type = 'number'; input.min = '1'; input.max = '99'; input.step = '1'; const automatic=block.properties?.source==='legacy-text'&&!block.properties?.widthsExplicit&&block.relativeColumnWidths.length===2&&block.relativeColumnWidths.every(value=>Math.abs(value-50)<.01),jobWidth=reviewData?.result?.context?.layout?.tableLabelWidth||38;input.value = String(Math.round(automatic?(column===0?jobWidth:100-jobWidth):width)); input.setAttribute('aria-label', `${t('Breite Spalte')} ${column + 1} ${t('in Prozent')}`); input.onchange = () => { saveHistory(); block.properties={...block.properties,widthsExplicit:true};const desired = block.relativeColumnWidths.length === 1 ? 100 : Math.max(1, Math.min(99, Number(input.value) || 1)), remaining = block.relativeColumnWidths.filter((_, i) => i !== column).reduce((sum, value) => sum + value, 0); block.relativeColumnWidths = block.relativeColumnWidths.map((value, i) => i === column ? desired : value * (100 - desired) / remaining); render(); }; label.append(input); widths.append(label); });
        card.append(widths);
        block.rows.forEach((row, rowIndex) => { const rowBox = document.createElement('div'); rowBox.className = 'structured-table-row'; row.forEach((cell, col) => { const label = document.createElement('label'); label.textContent = `${t('Zeile')} ${rowIndex + 1}, ${t('Spalte')} ${col + 1}`; const input = document.createElement('input'); input.type = 'text'; input.maxLength = 20000; input.value = cell.text; input.oninput = () => { saveHistory(); cell.text = input.value; }; label.append(input); rowBox.append(label); }); const remove = button(t('Zeile entfernen'), () => { saveHistory(); block.rows.splice(rowIndex, 1); if(block.properties?.headerRows>block.rows.length)block.properties.headerRows=block.rows.length;block.rowDelimiters?.splice(rowIndex, 1); render(); }, 'text-button'); remove.disabled = block.rows.length <= 1; rowBox.append(remove); card.append(rowBox); });
        const add = button(t('Tabellenzeile ergänzen'), () => { if (block.rows.length >= 1000) return; saveHistory(); block.rows.push(block.relativeColumnWidths.map(() => ({ id: uid(), text: '', sourceBlockIds: [] }))); block.rowDelimiters??=Array(block.rows.length-1).fill(' | ');block.rowDelimiters.push(block.rowDelimiters.at(-1) || ' | '); render(); }); add.disabled = block.rows.length >= 1000; card.append(add);
      }
      if (block.type === 'pageBreak') { const note = document.createElement('p'); note.className = 'muted'; note.textContent = t('Neue Seite im Export.'); card.append(note); }
      host.append(card);
    }); updateHistory();updateColumnButton();
  }
  function initialize() {
    if (toolbar) return;
    const label = $('#direct-text').closest('label'); toolbar = document.createElement('div'); toolbar.className = 'document-editor-toolbar';
    const textMode = button('Text', () => setMode('text').catch(showError)), structureMode = button('Struktur', () => setMode('structure').catch(showError)); textMode.dataset.editorMode = 'text'; structureMode.dataset.editorMode = 'structure';
    const undoButton = button('Rückgängig', () => restore(undo, redo)); undoButton.id = 'document-undo'; const redoButton = button('Wiederholen', () => restore(redo, undo)); redoButton.id = 'document-redo'; const columns=button('Spalten anordnen',()=>columnDialog());columns.dataset.columnAction='';columns.disabled=true;toolbar.append(textMode, structureMode, undoButton, redoButton,columns);
    const insert = document.createElement('div'); insert.className = 'document-editor-insert';
    for (const [labelText, type] of [['Absatz hinzufügen', 'paragraph'], ['Tabelle hinzufügen', 'table'], ['Stempel hinzufügen', 'stamp'], ['Seitenumbruch einfügen', 'pageBreak']]) insert.append(button(labelText, () => { if (!model || model.blocks.length >= 20000) return; saveHistory(); const id = uid(); model.blocks.push(type === 'table' ? { id, type, sourceBlockIds: [], rows: [[{ id: uid(), text: '', sourceBlockIds: [] }, { id: uid(), text: '', sourceBlockIds: [] }]], relativeColumnWidths: [38, 62], rowDelimiters: [' | '], keepRows: true } : { id, type, sourceBlockIds: [], ...(type === 'pageBreak' ? {} : { content: '' }) }); render(); }));
    toolbar.append(insert); host = document.createElement('div'); host.id = 'structured-editor'; host.className = 'structured-editor'; host.hidden = true; label.after(toolbar, host); updateHistory();
  }
  function showError(error) { $('#workflow-local-error').textContent = error?.message || 'Die Dokumentstruktur konnte nicht geladen werden.'; }
  async function setMode(next) {
    initialize();
    if (next === 'structure') {
      if (!model) { const jobId = reviewJobId, version = reviewData.version; const response = await localRequest(`/api/jobs/${jobId}/review?preview=1&document=1&stream=1`).then(result => result.json()); if (reviewJobId !== jobId || reviewData.version !== version) throw new Error('Die Fassung wurde inzwischen geändert.'); model = clone(response.document); }
      else if (mode === 'text' && $('#direct-text').value !== asText(model)) { model = fromText($('#direct-text').value, model); undo = []; redo = []; }
      render();
    } else if (mode === 'structure' && model){if(model.blocks.some(unresolvedHandwriting))throw new Error(t('Unklare Handschrift vor dem Export am Original klären oder ausdrücklich als unleserlich markieren.'));$('#direct-text').value = asText(model);}
    mode = next;updateColumnButton(); $('#direct-text').closest('label').hidden = next === 'structure'; host.hidden = next !== 'structure';
    for (const tab of toolbar.querySelectorAll('[data-editor-mode]')) tab.setAttribute('aria-pressed', String(tab.dataset.editorMode === next));
  }
  document.querySelector('#review-edit-open').addEventListener('click', () => { initialize(); if (mode === 'structure' && model) render(); });
  window.resetStructuredEditor = () => { model = null; undo = []; redo = []; mode = 'text'; if (toolbar) { host.hidden = true; $('#direct-text').closest('label').hidden = false; } };
  window.directEditPayload = () => {if(model?.blocks.some(unresolvedHandwriting))throw new Error(t('Unklare Handschrift vor dem Export am Original klären oder ausdrücklich als unleserlich markieren.'));return model&&(mode==='structure'||$('#direct-text').value===asText(model)) ? { document: clone(model) } : { text: $('#direct-text').value };};
  window.addEventListener('translateocr-locale', () => { if (!toolbar) return; for (const el of toolbar.querySelectorAll('[data-translation-key]')) el.textContent = t(el.dataset.translationKey); if (model && mode === 'structure') render(); });
})();
