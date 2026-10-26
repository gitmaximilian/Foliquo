import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {translationInstructions} from '../lib/translation-policy.mjs';
import {translationRequest} from '../lib/documents.mjs';

const [html,script,css,queue]=await Promise.all([
 readFile(new URL('../dist/index.html',import.meta.url),'utf8'),
 readFile(new URL('../dist/studio.js',import.meta.url),'utf8'),
 readFile(new URL('../dist/style.css',import.meta.url),'utf8'),
 readFile(new URL('../dist/queue.js',import.meta.url),'utf8')
]);

test('website-wide locale selector keeps the supported native values and exposes full labels',()=>{
 assert.match(html,/id="ui-language-trigger"[^>]*aria-haspopup="listbox"/);
 assert.match(html,/id="ui-language-value">Deutsch/);
 assert.match(html,/id="ui-language"[^>]*hidden/);
 for(const locale of ['en','de','ar'])assert.match(html,new RegExp(`<option value="${locale}"`));
 assert.match(script,/localeNames:\{en:'English',de:'German',ar:'Arabic'\}/);
 assert.match(script,/localeNames:\{en:'Englisch',de:'Deutsch',ar:'Arabisch'\}/);
 assert.match(script,/localeNames:\{en:'الإنجليزية',de:'الألمانية',ar:'العربية'\}/);
 assert.match(script,/ArrowDown[\s\S]*ArrowUp[\s\S]*Home[\s\S]*End[\s\S]*Escape/);
 assert.match(script,/document\.addEventListener\('pointerdown'/);
});

test('translation language pair provides source Auto-detect, searchable choices, swap, validation and RTL',()=>{
 assert.match(html,/id="source-language-trigger"/);
 assert.match(html,/id="target-language-trigger"/);
 assert.match(html,/class="language-field-label visually-hidden" id="source-language-label"/);
 assert.match(html,/class="language-field-label visually-hidden" id="target-language-label"/);
 assert.match(html,/id="source-language" hidden><option value="Automatisch"/);
 assert.match(html,/id="language-swap"[^>]*disabled/);
 assert.match(html,/id="language-error" role="status" aria-live="polite"/);
 const pairMarkup=html.slice(html.indexOf('id="language-pair"'),html.indexOf('id="language-error"'));
 assert.equal((pairMarkup.match(/<option value="(?:Deutsch|Englisch|Arabisch|Französisch|Spanisch|Italienisch|Türkisch)"/g)||[]).length,14);
 assert.match(script,/aria-activedescendant/);
 assert.match(script,/window\.isLanguagePairValid=\(\)=>source\.value==='Automatisch'\|\|source\.value!==target\.value/);
 assert.match(script,/const hint=\$\('#language-swap-hint'\);if\(hint\)hint\.textContent=swap\.disabled\?copy\[locale\]\.swapHint:''/);
 assert.match(script,/option\.id=`language-option-\$\{activeField\}-\$\{item\.aliases\[0\]\}`/,'option IDs remain stable when the list is filtered');
 assert.match(html,/class="language-swap-hint" id="language-swap-hint"/);
 assert.match(css,/\.language-workspace:focus-within \.language-swap-hint:not\(:empty\)/,'the disabled-swap explanation is available when the language group receives focus');
 assert.match(script,/source\.addEventListener\('change',[\s\S]*scheduleStudioDraftSave/);
 assert.match(queue,/target-language'\)\.value=job\.targetLanguage;window\.syncLanguageSelectors\?\.\(\)/,'reopening a saved job refreshes the visible target-language control');
 assert.match(css,/\.language-pair\{display:grid;grid-template-columns:minmax\(0,1fr\) 40px minmax\(0,1fr\)/);
 assert.match(css,/\.language-swap\{[^}]*align-self:center/,'the swap control is vertically centered with the language triggers');
 assert.match(css,/html\[dir=rtl\] \.language-swap svg\{transform:scaleX\(-1\)\}/);
 assert.match(css,/prefers-reduced-motion:reduce\).*language-picker-popover/);
});

test('language search exposes its controlled listbox and synchronized expanded state',()=>{
 assert.match(script,/search\.setAttribute\('aria-controls',languageList\.id\)/);
 assert.match(script,/languageList\.setAttribute\('aria-labelledby',dialogTitle\.id\)/);
 assert.match(script,/search\.setAttribute\('aria-expanded','false'\)/);
 assert.match(script,/search\.setAttribute\('aria-expanded','true'\)/);
 assert.match(script,/if\(panel===languagePopover\)\{search\.setAttribute\('aria-expanded','false'\);search\.removeAttribute\('aria-activedescendant'\);\}/);
});

test('mobile language picker keeps native modal Tab trapping and follows viewport changes',()=>{
 assert.match(script,/if\(languagePopover\.matches\(':modal'\)\)return;event\.preventDefault\(\)/,'modal Tab and Shift+Tab stay inside the native dialog while anchored desktop pickers follow document order');
 assert.match(script,/shouldBeModal!==isModal[\s\S]*languagePopover\.showModal\(\)[\s\S]*languagePopover\.show\(\)/,'resizing changes the open picker between modal sheet and anchored popover');
 assert.match(script,/languageClose\.className='language-picker-close secondary'/);
});

test('language popover measures rendered height and clamps to the visual viewport',()=>{
 assert.match(script,/panel\.getBoundingClientRect\(\)\.height\|\|available/);
 assert.match(script,/viewLeft\+viewWidth-width-gutter/);
 assert.match(script,/viewTop\+viewHeight-height-gutter/);
 assert.match(script,/languagePopover\.style\.visibility='hidden'[\s\S]*anchor\(languagePopover,openTrigger,320\)[\s\S]*languagePopover\.style\.visibility=''/);
});

test('locale selector Tab follows the new DOM order and view changes dismiss the language panel',async()=>{
 const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
 assert.match(script,/backwards\?\$\('#ai-settings-open'\):sourceTrigger/);
 assert.doesNotMatch(script,/\$\('#dropzone'\)\)\?\.focus/);
 assert.match(app,/new CustomEvent\('translateocr-view-change',\{detail:\{view:name\}\}\)/);
 assert.match(script,/translateocr-view-change',event=>\{if\(openPanel&&\(isTypeFilter\(activeField\)\|\|event\.detail\?\.view!=='studio'\)\)closePanel\(true\);\}/);
});

test('explicit source language guides translation while Auto-detect retains document detection',()=>{
 assert.match(translationInstructions('Englisch','Automatisch'),/Erkenne Ausgangssprache und Dokumenttyp/);
 assert.match(translationInstructions('Deutsch','Arabisch'),/gewählte Ausgangssprache ist Arabisch/);
 assert.match(translationInstructions('Deutsch','Arabisch'),/sichtbare Dokumentinhalt deutlich widerspricht/);
 const request=translationRequest('available',[],{targetLanguage:'Deutsch',sourceLanguage:'Arabisch'});
 assert.match(request.instructions,/Ausgangssprache ist Arabisch/);
});
