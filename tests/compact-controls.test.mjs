import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('phone navigation is one horizontally scrollable row',async()=>{
 const css=await read('dist/style.css'),phone=css.slice(css.indexOf('@media(max-width:599px){\n .header-inner{'));
 assert.match(phone,/\.header-inner>nav\{grid-row:2;display:flex;flex-wrap:nowrap;[^}]*overflow-x:auto/);
 assert.match(phone,/\.header-inner>nav \.nav-item\{flex:0 0 auto;[^}]*min-height:44px/);
 assert.doesNotMatch(phone.slice(0,2000),/\.header-inner>nav\{[^}]*repeat\(2,/);
});

test('clarification image upload uses an app-styled, keyboard-focusable control',async()=>{
 const [html,queue,css]=await Promise.all([read('dist/index.html'),read('dist/queue.js'),read('dist/style.css')]);
 assert.match(html,/<input id="clarification-extra" class="visually-hidden" type="file"[^>]*><span class="secondary clarification-upload-button" aria-hidden="true">Dateien auswählen<\/span><span id="clarification-extra-names"/);
 assert.match(css,/\.clarification-upload input:focus-visible\+\.clarification-upload-button\{outline/);
 assert.match(queue,/function renderClarificationExtraNames\(\)/);
});

test('an empty studio action bar shows no empty frame',async()=>{
 const css=await read('dist/style.css');
 assert.match(css,/\.action-footer:has\(\.composer-note\[data-empty=true\]\):not\(:has\(#error:not\(:empty\)\)\)\{padding:0;border:0;min-height:0;background:transparent\}/);
});
