import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {StringDecoder} from 'node:string_decoder';
import {JobStore} from '../lib/job-store.mjs';
async function fixture(t){const directory=await mkdtemp(join(tmpdir(),'foliquo-search-material-')),key=randomBytes(32),store=await new JobStore(directory,key).init();t.after(()=>rm(directory,{recursive:true,force:true}));return {directory,key,store};}
const job=()=>({id:'fictional-search-job',owner:'fictional-owner',status:'succeeded',names:['fictional.pdf'],result:{text:'Übersetzung مُحَمَّد 🙂',pdf:'fictional-binary',sourceInventory:{schema:1,ocrIncomplete:true,items:[{id:'source-1',sourceText:'Original Café',targetText:'Übersetzung',fileIndex:0,page:2,box:[.1,.2,.3,.4],coordinateSpace:'top-left',extractionMethod:'embedded-text'}]},fields:[{id:'field-1',source:'Fictional source',translated:'Fictional translation',page:2}],context:{scanCorrections:[],privateMessage:'excluded'}},review:{version:2,messages:[{text:'excluded private chat'}],proposal:{result:{text:'excluded proposal'}},versions:[{version:1,text:'Historical fictional translation',sourceInventory:{items:[{sourceText:'Historical source',page:1}]}}]}});
async function textOf(withText,value,path){return withText(value,path,async source=>{const decoder=new StringDecoder('utf8');let result='';for await(const bytes of source)result+=decoder.write(bytes);return result+decoder.end();});}
test('search material streams owned current and historical text with provenance, excluding binaries and private conversations',async t=>{
 const {store}=await fixture(t),value=job();value.result.text+='x'.repeat(1024*1024);await store.commitJob(value);const [entry]=store.searchCatalog({owner:value.owner});assert.equal(entry.version,2);assert.deepEqual(store.searchCatalog({owner:'other-owner'}),[]);assert.throws(()=>store.searchCatalog(),/owner/);
 let called=false;assert.equal(await store.withSearchMaterial(value.id,'other-owner',entry.stamp,()=>{called=true;}),null);assert.equal(called,false);
 const result=await store.withSearchMaterial(value.id,value.owner,entry.stamp,async(material,withText)=>{
  assert.equal(material.result.pdf,undefined);assert.equal(material.review.messages,undefined);assert.equal(material.review.proposal,undefined);assert.equal(material.result.context.privateMessage,undefined);
  assert.equal(material.result.sourceInventory.ocrIncomplete,true);assert.equal(material.result.sourceInventory.items[0].page,2);assert.deepEqual(material.result.sourceInventory.items[0].box,[.1,.2,.3,.4]);
  assert.equal(await textOf(withText,material.result.text,['result','text']),value.result.text);
  assert.equal(await textOf(withText,material.result.sourceInventory.items[0].sourceText,['result','sourceInventory','items','0','sourceText']),'Original Café');
  assert.equal(await textOf(withText,material.review.versions[0].text,['review','versions','0','text']),'Historical fictional translation');return 'read';
 });assert.equal(result,'read');
});
test('search catalog ignores uncommitted writes, survives rollback and refuses deleted or replaced source stamps',async t=>{
 const {store,directory,key}=await fixture(t),value=job();await store.commitJob(value);const [prior]=store.searchCatalog({owner:value.owner});value.result.text='Changed fictional text';value.review.version=3;
 const transaction=await store.commitJobs([value],{deferCleanup:true});assert.deepEqual(store.searchCatalog({owner:value.owner}),[prior]);await transaction.rollback();assert.deepEqual(store.searchCatalog({owner:value.owner}),[prior]);
 const next=await store.commitJobs([value],{deferCleanup:true});assert.deepEqual(store.searchCatalog({owner:value.owner}),[prior]);await next.commit();const [current]=store.searchCatalog({owner:value.owner});assert.notEqual(current.stamp,prior.stamp);assert.equal(await store.withSearchMaterial(value.id,value.owner,prior.stamp,()=>assert.fail()),null);
 const restarted=await new JobStore(directory,key).init();assert.deepEqual(restarted.searchCatalog({owner:value.owner}),[current]);await restarted.deleteJob(value.id);assert.equal(await restarted.withSearchMaterial(value.id,value.owner,current.stamp,()=>assert.fail()),null);
});
test('search material discards a result if its primary document is deleted during consumption and honours cancellation',async t=>{
 const {store}=await fixture(t),value=job();await store.commitJob(value);const [entry]=store.searchCatalog({owner:value.owner});const controller=new AbortController();controller.abort();await assert.rejects(()=>store.withSearchMaterial(value.id,value.owner,entry.stamp,()=>{}, {signal:controller.signal}),{name:'AbortError'});
 assert.equal(await store.withSearchMaterial(value.id,value.owner,entry.stamp,async()=>{await store.deleteJob(value.id);return 'stale';}),null);
});
