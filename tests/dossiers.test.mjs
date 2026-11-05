import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {Workspace} from '../lib/workspace.mjs';
import {createApp} from '../server.mjs';
import {putDossier,addFact,putDossierEntity,dossierChecks,assignDossierDocument,dossierDocumentView} from '../lib/dossiers.mjs';
import {createContextLibrarySnapshot,resolveContextSnapshot} from '../lib/context.mjs';

async function store(t){const directory=await mkdtemp(join(tmpdir(),'foliquo-dossier-')),workspace=await new Workspace(directory).init();t.after(async()=>{await workspace.tail;await rm(directory,{recursive:true,force:true});});return {workspace,directory};}
const field=(id,label,source,translated)=>({id,label,kind:label==='Name'?'name':'date',source,translated,fileIndex:0,page:1,box:[.1,.2,.4,.1]});
const job=(owner,name,fields,meta={})=>({id:randomUUID(),owner,names:[name],status:'succeeded',createdAt:Date.now(),finishedAt:Date.now(),review:{version:1},result:{text:'Fictional translation',fields,context:meta}});

test('two explicit people retain separate preferred values and immutable context, while legacy facts stay unassigned',async t=>{
 const {workspace:w,directory}=await store(t),d=putDossier(w,{name:'Fictional family'},'owner');addFact(d,{key:'birthDate',label:'Legacy date',value:'01.01.1950',confirmed:true});
 const a=putDossierEntity(d,{name:'Fictional Alex',version:d.version}),b=putDossierEntity(d,{name:'Fictional Bea',version:d.version});
 addFact(d,{key:'personName',label:'Name',entityId:a.id,value:'Alex Example',confirmed:true});addFact(d,{key:'birthDate',label:'Birth date',entityId:a.id,value:'07.03.1998',confirmed:true});addFact(d,{key:'birthDate',label:'Birth date',entityId:b.id,value:'08.04.2001',confirmed:true});
 const meta={dossierId:d.id,dossierEntityId:a.id,useLearning:false},snapshot=createContextLibrarySnapshot(w,meta,'fictional-job','owner'),frozen=resolveContextSnapshot(snapshot,meta);
 assert.equal(frozen.dossierEntity.id,a.id);assert.equal(frozen.dossierFacts.length,2);assert.ok(frozen.dossierFacts.every(f=>f.entityId===a.id));assert.ok(!JSON.stringify(frozen.dossierFacts).includes('1950'));assert.ok(!JSON.stringify(frozen.dossierFacts).includes('2001'));
 assert.equal(dossierChecks({context:{dossierEntityId:b.id},fields:[field('date','Geburtsdatum','8 April 2001','08.04.2001')]},d).length,1);assert.equal(dossierChecks({context:{dossierEntityId:b.id},fields:[field('date','Geburtsdatum','8 April 2001','08.04.2001')]},d)[0].present,true);
 addFact(d,{key:'birthDate',label:'Birth date',entityId:a.id,value:'09.03.1998',confirmed:true});assert.equal(resolveContextSnapshot(snapshot,meta).dossierFacts.find(f=>f.key==='birthDate').value,'07.03.1998');
 assert.throws(()=>createContextLibrarySnapshot(w,{dossierId:d.id,dossierEntityId:'guessed-person'},'job','owner'),/Person/);assert.throws(()=>createContextLibrarySnapshot(w,meta,'job','other-owner'),/Dossier/);
 const linked=job('owner','Fictional passport.pdf',[field('name','Name','Fictional source','Alex Example')]);w.data.jobs.push(linked);assignDossierDocument(d,{entityId:a.id,confirm:true,version:d.version},linked);
 await w.save();const backup=w.backup('fictional-passphrase-123'),restarted=await new Workspace(directory).init();assert.deepEqual(restarted.data.dossiers,w.data.dossiers);restarted.restore(backup,'fictional-passphrase-123');await restarted.save();assert.deepEqual(restarted.data.dossiers,w.data.dossiers);assert.equal(d.facts.find(f=>!f.entityId).value,'01.01.1950');
});

test('dossier commits are invisible until durable, survive an already queued ordinary save and roll back denied writes',async t=>{
 const {workspace:w,directory}=await store(t),d=putDossier(w,{name:'Fictional durable case'},'owner');await w.save();const write=w.writeMetadata.bind(w);let release,entered;const held=new Promise(resolve=>release=resolve),writing=new Promise(resolve=>entered=resolve);w.writeMetadata=async value=>{entered();await held;return write(value);};
 const commit=w.save({dossierOperation:list=>{const current=list.find(item=>item.id===d.id);putDossierEntity(current,{name:'Explicit person',version:d.version});return current;}});await writing;assert.equal(w.data.dossiers[0].entities.length,0);w.data.settings.displayName='Fictional owner';const queued=w.save();release();await commit;await queued;w.writeMetadata=write;
 assert.equal(w.data.dossiers[0].entities.length,1);const restarted=await new Workspace(directory).init();assert.equal(restarted.data.dossiers[0].entities.length,1);assert.equal(restarted.data.settings.displayName,'Fictional owner');
 const before=JSON.stringify(w.data.dossiers);w.writeMetadata=async()=>{throw new Error('Fictional denied write');};await assert.rejects(w.save({dossierOperation:list=>{putDossierEntity(list[0],{name:'Must not appear'});return list[0];}}),/denied/);assert.equal(JSON.stringify(w.data.dossiers),before);w.writeMetadata=write;
});

test('explicit document links override historical selection without modifying frozen results or copying source text',()=>{
 const w={data:{dossiers:[]}},d=putDossier(w,{name:'Fictional case'},'owner'),a=putDossierEntity(d,{name:'Alex'}),b=putDossierEntity(d,{name:'Bea'}),original=job('owner','Fictional passport',[field('name','Name','Original fictional Alex','Alex Example')],{dossierId:d.id,dossierEntityId:a.id}),before=JSON.stringify(original);
 assert.equal(dossierDocumentView(d,original).entityId,a.id);assignDossierDocument(d,{entityId:b.id,confirm:true,version:d.version},original);assert.equal(dossierDocumentView(d,original).entityId,b.id);assert.equal(JSON.stringify(original),before);
 addFact(d,{key:'personName',label:'Name',value:'Bea Example',entityId:b.id,confirmed:true,provenance:{kind:'document',jobId:original.id,fieldId:'name',version:1}});assert.ok(!JSON.stringify(d.documents).includes('Original fictional Alex'));assert.ok(!JSON.stringify(d.facts).includes('Original fictional Alex'));
 assignDossierDocument(d,{active:false,confirm:true,version:d.version},original);assert.equal(dossierDocumentView(d,original),null);assert.equal(dossierDocumentView(d,{...original,owner:'another-owner'}),null);
});

test('HTTP dossier source confirmation is owner/version-bound and reassignment preserves the saved translation',async t=>{
 const {workspace:w}=await store(t),owner='fictional-owner',csrf='fictional-csrf',documents=[job(owner,'Fictional passport.pdf',[field('name','Name','Fictional Aleksej','Alex Example')]),job(owner,'Fictional birth certificate.pdf',[field('name','Name','Fictional Aleksej','Aleksej Example')]),job(owner,'Fictional certificate.pdf',[field('name','Name','Fictional Aleksej','Alex Example')])];w.data.jobs.push(...documents);w.data.sessions=[[owner,{id:owner,csrf,expiresAt:Date.now()+60000}]];await w.save();const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));const server=createApp({workspace:w,port,connection:{status:()=>({connected:false,planEnabled:false})}});await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const origin=`http://127.0.0.1:${server.address().port}`;
 const cookie=`urkundenklar=${owner}`,session={id:owner,csrf},send=(path,data,method='POST')=>fetch(origin+path,{method,headers:{cookie,origin,'content-type':'application/json','x-foliquo-csrf':session.csrf},body:JSON.stringify(data)}),get=path=>fetch(origin+path,{headers:{cookie}}).then(r=>r.json());
 let d=(await send('/api/dossiers',{name:'Fictional three-document case'}).then(r=>r.json())).dossier;d=(await send(`/api/dossiers/${d.id}/entities`,{name:'Alex Example',version:d.version}).then(r=>r.json())).dossier;const person=d.entities[0];
 for(const document of documents){const response=await send(`/api/dossiers/${d.id}/documents`,{jobId:document.id,entityId:person.id,confirm:true,version:d.version});const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));d=data.dossier;}
 let view=await get(`/api/dossiers/${d.id}/documents`);assert.equal(view.documents.length,3);assert.deepEqual(view.documents.flatMap(item=>item.fields.map(f=>f.translated)).sort(),['Aleksej Example','Alex Example','Alex Example']);
 const source={jobId:documents[0].id,version:1,fieldId:'name'},confirmation={label:'Name',value:'Alex Example',entityId:person.id,confirmed:true,version:d.version,source};let response=await send(`/api/dossiers/${d.id}/facts`,{...confirmation,source:{...source,version:2}});assert.equal(response.status,400);
 response=await send(`/api/dossiers/${d.id}/facts`,confirmation);assert.equal(response.status,200);d=(await response.json()).dossier;assert.deepEqual(d.facts[0].provenance,{kind:'document',...source});view=await get(`/api/dossiers/${d.id}/documents`);assert.equal(view.documents.reduce((count,item)=>count+item.conflicts.length,0),1);assert.equal(view.documents.find(item=>item.id===documents[0].id).fields[0].source,'Fictional Aleksej');
 assert.equal((await send(`/api/dossiers/${d.id}/facts`,confirmation)).status,400,'a stale dossier version cannot overwrite the confirmation');
 const otherHome=await fetch(origin),otherCookie=otherHome.headers.get('set-cookie').split(';')[0];assert.equal((await fetch(origin+`/api/dossiers/${d.id}/documents`,{headers:{cookie:otherCookie}})).status,400);
 const other=(await send('/api/dossiers',{name:'Another fictional case'}).then(r=>r.json())).dossier,old=JSON.stringify(documents[0].result);response=await send(`/api/dossiers/${other.id}/documents`,{jobId:documents[0].id,entityId:'',confirm:true,version:other.version});assert.equal(response.status,200);assert.equal(JSON.stringify(documents[0].result),old);view=await get(`/api/dossiers/${d.id}/documents`);assert.equal(view.documents.length,2);assert.equal((await get(`/api/dossiers/${other.id}/documents`)).documents.length,1);
 const otherCurrent=w.data.dossiers.find(item=>item.id===other.id);assert.equal((await send(`/api/dossiers/${other.id}`,{version:otherCurrent.version,confirm:true},'DELETE')).status,200);assert.equal(JSON.stringify(documents[0].result),old);assert.ok(!w.data.dossiers.some(item=>item.id===other.id));
});

test('lazy case overview pages legacy selections without hydrating binaries and drops deleted document rows',async t=>{
 const {workspace:w,directory}=await store(t),owner='fictional-lazy-owner',csrf='fictional-lazy-csrf',d=putDossier(w,{name:'Fictional legacy case'},owner),person=putDossierEntity(d,{name:'Fictional person'}),documents=Array.from({length:24},(_,index)=>job(owner,`Fictional page ${index}.pdf`,[field('name','Name','Private fictional source','Fictional Person')],{dossierId:d.id,dossierEntityId:person.id}));w.data.jobs.push(...documents);w.data.sessions=[[owner,{id:owner,csrf,expiresAt:Date.now()+60000}]];await w.save();
 const lazy=await new Workspace(directory,{lazyJobs:true}).init();assert.equal(lazy.data.jobs.length,0);let metadataReads=0;const read=lazy.jobStore.getJobMetadata.bind(lazy.jobStore);lazy.jobStore.getJob=async()=>{throw new Error('Case overview must not hydrate whole jobs');};lazy.jobStore.getJobMetadata=async(id,owner,options)=>{metadataReads++;assert.equal(options.deferText,true);return read(id,owner,options);};
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));const server=createApp({workspace:lazy,port,connection:{status:()=>({connected:false,planEnabled:false})}});await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));t.after(async()=>{await new Promise(resolve=>server.close(resolve));await lazy.tail;});const origin=`http://127.0.0.1:${port}`,get=path=>fetch(origin+path,{headers:{cookie:`urkundenklar=${owner}`}}).then(r=>r.json());
 let view=await get(`/api/dossiers/${d.id}/documents`);assert.equal(view.documents.length,20);assert.equal(view.nextOffset,20);assert.equal(metadataReads,20);view=await get(`/api/dossiers/${d.id}/documents?offset=20`);assert.equal(view.documents.length,4);assert.equal(view.nextOffset,null);assert.equal(metadataReads,24);
 await lazy.jobStore.deleteJob(documents[0].id);view=await get(`/api/dossiers/${d.id}/documents`);assert.equal(view.totalJobs,23);assert.ok(!view.documents.some(item=>item.id===documents[0].id));assert.ok(!JSON.stringify(lazy.data.dossiers).includes('Private fictional source'));assert.equal(lazy.data.jobs.length,0);
});
