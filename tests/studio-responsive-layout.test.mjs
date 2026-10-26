import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Context stays beside language/upload only from 1280 px and stacks after files below it',async()=>{
 const css=await readFile(new URL('../dist/style.css',import.meta.url),'utf8');
 const wide=css.slice(css.indexOf('/* Foliquo Translate premium workspace'));
 const narrow=wide.slice(wide.indexOf('@media(max-width:1279px)'));
 assert.match(wide,/#studio-view\{display:grid;grid-template-columns:minmax\(0,1fr\) var\(--settings-width\)/);
 assert.match(wide,/\.translation-composer \.settings-card\{grid-column:2;grid-row:1\/3/);
 assert.match(wide,/\.translation-composer \.upload-card\{grid-column:1;grid-row:2/);
 assert.match(wide,/\.translation-composer \.action-footer\{grid-column:1;grid-row:3/);
 assert.match(narrow,/#studio-view\{grid-template-columns:minmax\(0,1fr\);row-gap:0\}/);
 assert.match(narrow,/\.language-workspace\{grid-column:1;grid-row:1/);
 assert.match(narrow,/\.translation-composer \.upload-card\{grid-column:1;grid-row:2/);
 assert.match(narrow,/\.translation-composer \.settings-card\{grid-column:1;grid-row:3/);
 assert.match(narrow,/\.translation-composer \.action-footer\{grid-column:1;grid-row:4/);
 assert.match(wide,/@media\(max-width:599px\)[\s\S]*?\.language-pair\{grid-template-columns:minmax\(0,1fr\)/,'language fields stack below 600 px');
 assert.match(wide,/@media\(max-width:599px\)[\s\S]*?\.translation-composer \.dropzone\{min-height:240px/,'mobile upload retains its specified minimum height');
 assert.match(wide,/@media\(max-width:1023px\)[\s\S]*?\.translation-composer \.dropzone\{min-height:280px/,'tablet upload uses its specified minimum height');
 assert.match(wide,/@media\(min-width:1600px\)\{\.translation-composer \.dropzone\{min-height:400px/,'large desktop upload uses its specified minimum height');
 for(const [token,value] of [['--nav-width','216px'],['--settings-width','296px'],['--workspace-max','1600px'],['--workspace-gap','24px']])assert.match(css,new RegExp(`${token}:${value}`),`${token} matches the approved geometry`);
 assert.match(wide,/@media\(min-width:1024px\) and \(max-width:1279px\)\{\.translation-composer \.dropzone\{min-height:320px/,'1024–1279 px uses the 320 px drop zone');
 assert.match(narrow,/\.app-shell\{grid-template-columns:192px minmax\(0,1fr\)\}/,'1024–1279 px uses the 192 px rail');
 assert.match(wide,/@media\(max-width:1023px\)[\s\S]*?\.header-inner>nav\{grid-column:1\/-1;grid-row:2/,'below 1024 px navigation moves above the workspace');
 assert.match(wide,/@media\(max-width:1023px\)[\s\S]*?\.header-right \.language-picker\{width:auto;min-width:0\}/,'topbar locale picker keeps its intrinsic width instead of pushing utility buttons off-screen');
 assert.match(css,/\.app-main\{grid-column:2;grid-row:1;align-self:start;width:100%;max-width:none;margin:0;padding:24px 32px 28px/,'wide desktop uses 32 px workspace gutters');
 assert.match(narrow,/\.app-main\{padding:24px 24px 28px\}/,'1024–1279 px uses 24 px workspace gutters');
 assert.match(wide,/@media\(min-width:1280px\)\{\.workspace-layout\[data-view=studio\]>\.queue-rail\{width:calc\(100% - var\(--settings-width\) - var\(--workspace-gap\)\)/,'wide Jobs rail matches the center lane width');
 assert.match(wide,/html\[dir=rtl\] \.workspace-layout\[data-view=studio\]>\.queue-rail\{justify-self:end\}/,'RTL Jobs rail aligns with the mirrored center lane');
 assert.match(narrow,/@media\(max-width:1279px\)\{\.workspace-layout\[data-view=studio\]>\.queue-rail\{width:100%;max-width:none/,'narrow Jobs rail uses full available width');
});

test('375 px is covered by the compact shell and narrow composer source rules',async()=>{
 const css=await readFile(new URL('../dist/style.css',import.meta.url),'utf8');
 assert.match(css,/body\{[^}]*min-width:320px/,'the application can shrink below the requested viewport width');
 assert.match(css,/@media\(max-width:599px\)[\s\S]*?\.header-inner\{grid-template-columns:minmax\(0,1fr\)/,'375 px uses the compact three-row header');
 assert.ok(css.includes('#ui-language{width:80px;min-width:72px}'),'the language picker keeps its documented touch width');
 assert.match(css,/@media\(max-width:599px\)[\s\S]*?\.app-main\{padding:16px 16px 20px\}/,'375 px uses the compact workspace gutters');
 assert.match(css,/@media\(max-width:599px\)[\s\S]*?\.translation-composer \.dropzone\{min-height:240px/,'mobile upload retains its specified minimum height');
 assert.match(css,/@media\(max-width:1023px\)[\s\S]*?\.translation-composer \.dropzone\{min-height:280px/,'tablet upload uses its specified minimum height');
 assert.match(css,/@media\(min-width:1600px\)\{\.translation-composer \.dropzone\{min-height:400px/,'large desktop upload uses its specified minimum height');
 assert.ok(css.includes('.document-actions-list>button{display:inline-flex;width:auto;min-width:52px;min-height:34px;padding-inline:10px}'),'the library action-list selector matches the rendered DOM');
 assert.ok(css.includes('.action-menu>summary,.action-menu-items button,.document-actions-list>button{min-height:var(--control-height-touch)}'),'all library actions, including PDF and Word, receive 44 px touch targets');
});

test('file rows wrap by upload-panel width and keep 44 px ordering and removal targets',async()=>{
 const css=await readFile(new URL('../dist/style.css',import.meta.url),'utf8');
 const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
 assert.match(css,/\.translation-composer \.upload-card\{[^}]*container:upload \/ inline-size/);
 assert.match(css,/@container upload \(max-width:759px\)[\s\S]*?\.translation-composer \.file-item\{grid-template-columns:32px minmax\(0,1fr\) 44px;align-items:start\}[\s\S]*?\.translation-composer \.file-item>\.file-icon\{grid-column:1;grid-row:1\}[\s\S]*?\.translation-composer \.file-item \.file-order\{grid-column:1\/3;grid-row:3\}[\s\S]*?\.translation-composer \.file-item>button\{grid-column:3;grid-row:3;justify-self:end\}/,'narrow file rows reserve separate icon, ordering, and removal areas');
 assert.match(css,/@media\(max-width:599px\)[\s\S]*?\.translation-composer \.file-item\{grid-template-columns:32px minmax\(0,1fr\) 44px;gap:8px\}[\s\S]*?\.translation-composer \.file-item \.file-order\{grid-column:1\/3;grid-row:3\}[\s\S]*?\.translation-composer \.file-item>button\{grid-column:3;grid-row:3;justify-self:end\}/,'ordering and removal controls receive separate mobile grid cells');
 assert.match(css,/@container upload \(max-width:759px\)[\s\S]*?\.translation-composer \.file-item \.file-role\{grid-column:1\/-1;grid-row:2\}/);
 assert.match(css,/\.translation-composer \.file-order button,\.translation-composer \.file-item>button\{min-width:44px;min-height:44px\}/);
 assert.match(app,/icon\.className='file-icon'[\s\S]*stroke-width="1\.75"/);
});
