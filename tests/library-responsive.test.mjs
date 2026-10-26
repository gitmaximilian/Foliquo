import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Library rows retain named table semantics and add mobile field labels',async()=>{
 const [app,css]=await Promise.all([read('dist/app.js'),read('dist/style.css')]);
 assert.ok(css.includes('.document-cell-label{display:none}'),'labels stay hidden while desktop table headers are visible');
 assert.match(app,/table\.setAttribute\('role','table'\)/);
 assert.match(app,/cell\.setAttribute\('role','columnheader'\)/);
 assert.match(app,/cellLabel\(name,'Dokument'\)/);
 for(const label of ['Dokumenttyp','Datum','Status','Aktionen'])assert.ok(app.includes(`cellLabel(${label==='Dokumenttyp'?'type':label==='Datum'?'date':label==='Status'?'status':'actions'},'${label}')`),`mobile label ${label} is present`);
 assert.match(css,/@media\(max-width:600px\)\{\r?\n#document-cards\{padding:var\(--space-4\)\}/,'mobile library breakpoint uses the shared spacing scale');
 assert.ok(css.includes('.document-table tbody{display:grid;gap:10px}'),'mobile results are stacked');
 assert.ok(css.includes('.document-table tr{display:grid;grid-template-columns:minmax(0,1fr)'),'each document is a labeled card');
 assert.ok(css.includes('.document-cell-label{display:block'),'mobile cell labels are visible');
});
