import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../dist/theme.js',import.meta.url),'utf8');
function setup(saved=null){
 const events={},mediaEvents={},attributes={},root={lang:'de',dataset:{},style:{}},storage=new Map(saved?[['foliquo-theme',saved]]:[]);
 const button={dataset:{},setAttribute:(k,v)=>attributes[k]=v,addEventListener:(k,v)=>events['button:'+k]=v};
 const media={matches:false,addEventListener:(k,v)=>mediaEvents[k]=v};
 const window={addEventListener:(k,v)=>events[k]=v,dispatchEvent:()=>{}};
 vm.runInNewContext(source,{document:{documentElement:root,querySelectorAll:()=>[button],addEventListener:(k,v)=>events[k]=v},window,matchMedia:()=>media,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},WeakSet,MutationObserver:class{observe(){}},CustomEvent:class{}});
 return {root,events,media,mediaEvents,storage,button,attributes,api:window.FoliquoTheme};
}
test('theme toggles repeatedly, persists and restores the manual preference',()=>{const s=setup();assert.equal(s.root.dataset.theme,'light');s.events['button:click']();assert.equal(s.root.dataset.theme,'dark');assert.equal(s.attributes['aria-pressed'],'true');assert.equal(setup(s.storage.get('foliquo-theme')).root.dataset.theme,'dark');s.events['button:click']();assert.equal(s.root.dataset.theme,'light');});
test('system changes follow only without a manual preference and reset resumes them',()=>{const s=setup();s.media.matches=true;s.mediaEvents.change();assert.equal(s.root.dataset.theme,'dark');s.api.set('light');s.mediaEvents.change();assert.equal(s.root.dataset.theme,'light');s.api.reset();assert.equal(s.root.dataset.theme,'dark');assert.equal(s.storage.size,0);});
test('cross-tab changes and localized toggle labels stay synchronized',()=>{const s=setup();s.root.lang='ar';s.events['translateocr-locale']();assert.equal(s.attributes['aria-label'],'الوضع الداكن');s.events.storage({key:'foliquo-theme',newValue:'dark'});assert.equal(s.root.dataset.theme,'dark');assert.equal(s.attributes['aria-pressed'],'true');});
