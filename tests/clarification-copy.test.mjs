import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

// Strings rendered by queue.js while answering clarifications must be translated in every interface language.
test('clarification answer controls and notices are translated for English and Arabic',async()=>{
 const [i18n,queue]=await Promise.all([read('dist/i18n.js'),read('dist/queue.js')]);
 const expected={
  'Antworten werden benötigt.':['Your answers are needed.','نحتاج إلى إجاباتك.'],
  'Deine Antwort …':['Your answer …','إجابتك …'],
  'Antwort senden':['Send answer','إرسال الإجابة'],
 };
 for(const [source,[en,ar]] of Object.entries(expected)){
  assert.ok(queue.includes(`'${source}'`),`queue.js still uses ${source}`);
  assert.match(i18n,new RegExp(`Object\\.assign\\(dictionaries\\.en,\\{[^\\n]*'${escape(source)}':'${escape(en)}'`),`English ${source}`);
  assert.match(i18n,new RegExp(`Object\\.assign\\(dictionaries\\.ar,\\{[^\\n]*'${escape(source)}':'${escape(ar)}'`),`Arabic ${source}`);
 }
});

test('review confirmation checkboxes announce the translated check label',async()=>{
 const guide=await read('dist/review-guide.js');
 assert.match(guide,/confirmed\.setAttribute\('aria-label',`\$\{t\('confirm'\)\}: \$\{window\.TOCRI18n\?\.t\(check\.label\)\|\|check\.label\}`\)/);
});

test('toast action text meets WCAG AA contrast',async()=>{
 const css=await read('dist/style.css'),rule=css.match(/#toast \.toast-action\{([^}]*)\}/)?.[1]||'';
 const color=rule.match(/(?:^|;)color:(#[0-9a-f]{6})/i)?.[1],background=rule.match(/background:(#[0-9a-f]{6})/i)?.[1];
 assert.ok(color&&background,'toast action uses explicit hex colors');
 const luminance=hex=>{const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*r+0.7152*g+0.0722*b;};
 const [high,low]=[luminance(color),luminance(background)].sort((a,b)=>b-a);
 assert.ok((high+0.05)/(low+0.05)>=4.5,`contrast ${((high+0.05)/(low+0.05)).toFixed(2)}`);
});
