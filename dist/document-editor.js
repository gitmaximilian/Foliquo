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
  function render() {
    if (!host || !model) return;
    host.replaceChildren();
    model.blocks.forEach((block, index) => {
      const card = document.createElement('section'); card.className = 'structured-block';
      const head = document.createElement('div'); head.className = 'structured-block-head';
      const title = document.createElement('strong'); title.textContent = `${t(({ heading: 'Überschrift', paragraph: 'Absatz', table: 'Tabelle', stamp: 'Stempel', list: 'Liste', pageBreak: 'Seitenumbruch' })[block.type] || 'Text')} ${index + 1}`; head.append(title);
      for (const [label, delta] of [['Nach oben', -1], ['Nach unten', 1]]) { const move = button(t(label), () => { const target = index + delta; if (target < 0 || target >= model.blocks.length) return; saveHistory(); [model.blocks[index], model.blocks[target]] = [model.blocks[target], model.blocks[index]]; render(); }, 'text-button'); move.disabled = index + delta < 0 || index + delta >= model.blocks.length; head.append(move); }
      head.append(button(t('Block entfernen'), () => { saveHistory(); model.blocks.splice(index, 1); render(); }, 'text-button')); card.append(head);
      const edit = (value, label, rows, apply) => { const input = document.createElement('textarea'); input.rows = rows; input.maxLength = 20000; input.value = value; input.setAttribute('aria-label', label); input.oninput = () => { saveHistory(); apply(input.value); }; card.append(input); };
      if (['paragraph', 'heading', 'stamp'].includes(block.type)) edit(block.content, `${t('Inhalt')} ${index + 1}`, Math.min(8, Math.max(2, block.content.split('\n').length)), value => { block.content = value; });
      if (block.type === 'list') edit(block.items.join('\n'), `${t('Listeneinträge')} ${index + 1}`, Math.min(10, Math.max(3, block.items.length)), value => { block.items = value.split('\n').slice(0, 1000); });
      if (block.type === 'table') {
        const widths = document.createElement('div'); widths.className = 'structured-column-widths';
        block.relativeColumnWidths.forEach((width, column) => { const label = document.createElement('label'); label.textContent = `${t('Spalte')} ${column + 1} · ${t('Prozent')}`; const input = document.createElement('input'); input.type = 'number'; input.min = '1'; input.max = '99'; input.step = '1'; input.value = String(Math.round(width)); input.setAttribute('aria-label', `${t('Breite Spalte')} ${column + 1} ${t('in Prozent')}`); input.onchange = () => { saveHistory(); const desired = block.relativeColumnWidths.length === 1 ? 100 : Math.max(1, Math.min(99, Number(input.value) || 1)), remaining = block.relativeColumnWidths.filter((_, i) => i !== column).reduce((sum, value) => sum + value, 0); block.relativeColumnWidths = block.relativeColumnWidths.map((value, i) => i === column ? desired : value * (100 - desired) / remaining); render(); }; label.append(input); widths.append(label); });
        card.append(widths);
        block.rows.forEach((row, rowIndex) => { const rowBox = document.createElement('div'); rowBox.className = 'structured-table-row'; row.forEach((cell, col) => { const label = document.createElement('label'); label.textContent = `${t('Zeile')} ${rowIndex + 1}, ${t('Spalte')} ${col + 1}`; const input = document.createElement('input'); input.type = 'text'; input.maxLength = 20000; input.value = cell.text; input.oninput = () => { saveHistory(); cell.text = input.value; }; label.append(input); rowBox.append(label); }); const remove = button(t('Zeile entfernen'), () => { saveHistory(); block.rows.splice(rowIndex, 1); block.rowDelimiters.splice(rowIndex, 1); render(); }, 'text-button'); remove.disabled = block.rows.length <= 1; rowBox.append(remove); card.append(rowBox); });
        const add = button(t('Tabellenzeile ergänzen'), () => { if (block.rows.length >= 1000) return; saveHistory(); block.rows.push(block.relativeColumnWidths.map(() => ({ id: uid(), text: '', sourceBlockIds: [] }))); block.rowDelimiters.push(block.rowDelimiters.at(-1) || ' | '); render(); }); add.disabled = block.rows.length >= 1000; card.append(add);
      }
      if (block.type === 'pageBreak') { const note = document.createElement('p'); note.className = 'muted'; note.textContent = t('Neue Seite im Export.'); card.append(note); }
      host.append(card);
    }); updateHistory();
  }
  function initialize() {
    if (toolbar) return;
    const label = $('#direct-text').closest('label'); toolbar = document.createElement('div'); toolbar.className = 'document-editor-toolbar';
    const textMode = button(t('Text'), () => setMode('text').catch(showError)), structureMode = button(t('Struktur'), () => setMode('structure').catch(showError)); textMode.dataset.editorMode = 'text'; structureMode.dataset.editorMode = 'structure';
    const undoButton = button(t('Rückgängig'), () => restore(undo, redo)); undoButton.id = 'document-undo'; const redoButton = button(t('Wiederholen'), () => restore(redo, undo)); redoButton.id = 'document-redo'; toolbar.append(textMode, structureMode, undoButton, redoButton);
    const insert = document.createElement('div'); insert.className = 'document-editor-insert';
    for (const [labelText, type] of [['Absatz hinzufügen', 'paragraph'], ['Tabelle hinzufügen', 'table'], ['Stempel hinzufügen', 'stamp'], ['Seitenumbruch einfügen', 'pageBreak']]) insert.append(button(t(labelText), () => { if (!model || model.blocks.length >= 20000) return; saveHistory(); const id = uid(); model.blocks.push(type === 'table' ? { id, type, sourceBlockIds: [], rows: [[{ id: uid(), text: '', sourceBlockIds: [] }, { id: uid(), text: '', sourceBlockIds: [] }]], relativeColumnWidths: [38, 62], rowDelimiters: [' | '], keepRows: true } : { id, type, sourceBlockIds: [], ...(type === 'pageBreak' ? {} : { content: '' }) }); render(); }));
    toolbar.append(insert); host = document.createElement('div'); host.id = 'structured-editor'; host.className = 'structured-editor'; host.hidden = true; label.after(toolbar, host); updateHistory();
  }
  function showError(error) { $('#workflow-local-error').textContent = error?.message || 'Die Dokumentstruktur konnte nicht geladen werden.'; }
  async function setMode(next) {
    initialize();
    if (next === 'structure') {
      if (!model) { const jobId = reviewJobId, version = reviewData.version; const response = await localRequest(`/api/jobs/${jobId}/review?preview=1&document=1&stream=1`).then(result => result.json()); if (reviewJobId !== jobId || reviewData.version !== version) throw new Error('Die Fassung wurde inzwischen geändert.'); model = clone(response.document); }
      else if (mode === 'text' && $('#direct-text').value !== asText(model)) { model = fromText($('#direct-text').value, model); undo = []; redo = []; }
      render();
    } else if (mode === 'structure' && model) $('#direct-text').value = asText(model);
    mode = next; $('#direct-text').closest('label').hidden = next === 'structure'; host.hidden = next !== 'structure';
    for (const tab of toolbar.querySelectorAll('[data-editor-mode]')) tab.setAttribute('aria-pressed', String(tab.dataset.editorMode === next));
  }
  document.querySelector('#review-edit-open').addEventListener('click', () => { initialize(); if (mode === 'structure' && model) render(); });
  window.resetStructuredEditor = () => { model = null; undo = []; redo = []; mode = 'text'; if (toolbar) { host.hidden = true; $('#direct-text').closest('label').hidden = false; } };
  window.directEditPayload = () => mode === 'structure' && model ? { document: clone(model) } : { text: $('#direct-text').value };
  window.addEventListener('translateocr-locale', () => { if (!toolbar) return; for (const el of toolbar.querySelectorAll('[data-translation-key]')) el.textContent = t(el.dataset.translationKey); if (model && mode === 'structure') render(); });
})();
