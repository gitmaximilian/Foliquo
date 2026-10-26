import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

async function setup(){
 const nodes=new Map();
 class Element extends EventTarget{
  hidden=false;disabled=false;open=false;children=[];dataset={};
  append(...items){for(const item of items){if(item.parent)item.parent.children=item.parent.children.filter(e=>e!==item);item.parent=this;this.children.push(item);}}
  showModal(){this.open=true;}close(){this.open=false;}
 }
 const window=new EventTarget();window.TOCRDialogs={bind(){},open(dialog){dialog.open=true;},close(dialog){dialog.open=false;}};const document={querySelector(id){if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);}};
 vm.runInNewContext(await readFile(new URL('../dist/ai-settings.js',import.meta.url),'utf8'),{window,document});
 const state=ready=>{const event=new Event('translateocr-ai-state');event.detail={ready};window.dispatchEvent(event);};
 return {window,state,node:id=>document.querySelector(id)};
}

test('The model step uses real connection controls and requires readiness or explicit deferral',async()=>{
 const {window,state,node}=await setup();window.positionAISetupForTour(2);
 assert.equal(node('#connection-card').parent,node('#intro-ai-host'));
 assert.equal(node('#intro-ai-host').hidden,false);
 assert.equal(node('#intro-next').disabled,true);
 assert.equal(node('#intro-ai-later').hidden,false);
 state(true);assert.equal(node('#intro-next').disabled,false);assert.equal(node('#intro-ai-later').hidden,true);
 state(false);assert.equal(node('#intro-next').disabled,true);
 window.positionAISetupForTour(3);
 assert.equal(node('#intro-next').disabled,false,'deferring must not disable subsequent tour steps');
 assert.equal(node('#connection-card').parent,node('#ai-settings-home'));
 assert.equal(node('#send-note').parent,node('#ai-settings-home'));
 assert.equal(node('#intro-ai-host').hidden,true);
});

test('Header settings reuse the same controls; closing them preserves connection state',async()=>{
 const {window,state,node}=await setup();const card=node('#connection-card');state(true);
 window.openAISettings();assert.equal(node('#ai-settings-dialog').open,true);assert.equal(card.parent,node('#ai-settings-home'));
 node('#ai-settings-close').dispatchEvent(new Event('click'));assert.equal(node('#ai-settings-dialog').open,false);
 window.positionAISetupForTour(2);assert.equal(node('#connection-card'),card);assert.equal(node('#intro-next').disabled,false);
 window.positionAISetupForTour(-1);window.openAISettings();assert.equal(card.parent,node('#ai-settings-home'));
});
