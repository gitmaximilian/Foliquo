import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {Workspace} from '../lib/workspace.mjs';
import {createApp} from '../server.mjs';

test('translation review exposes a non-mutating glossary warning when a selected source term is omitted',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-glossary-audit-')),workspace=await new Workspace(directory).init(),port=21000+Math.floor(Math.random()*10000),origin=`http://127.0.0.1:${port}`,term=workspace.put('glossary',{name:'Fictional Authority',source:'Fictional Authority',target:'Fiktive Behörde',sourceLanguage:'Englisch',targetLanguage:'Deutsch',documentType:'Fictional',scope:'global',status:'approved'});
 const provider={id:'openai',selected:'openai',status:()=>({connected:true,planEnabled:true}),models:async()=>[{id:'fixture-model'}],respond:async request=>request.instructions.includes('Extrahiere alle sichtbaren')?JSON.stringify({documentType:'Fictional',fields:[{label:'Authority',kind:'other',source:'Fictional Authority',translated:'Fictional Authority',fileIndex:0,page:1}],uncertainRegions:[]}):JSON.stringify({status:'ready',sourceLanguage:'Englisch',documentType:'Fictional',questions:[],text:'Die Behörde wurde bestätigt.',fields:[{label:'Authority',kind:'other',source:'Fictional Authority',translated:'Behörde',fileIndex:0,page:1}]})};
 const app=createApp({port,workspace,connection:{data:{}},provider});await new Promise(resolve=>app.listen(port,'127.0.0.1',resolve));t.after(async()=>{await new Promise(resolve=>app.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});});
 const home=await fetch(origin),cookie=home.headers.get('set-cookie').split(';')[0],session=await fetch(origin+'/api/session',{headers:{cookie}}).then(response=>response.json()),headers={cookie,origin,'content-type':'application/json','x-translateocr-csrf':session.csrf},post=(path,value)=>fetch(origin+path,{method:'POST',headers,body:JSON.stringify(value)}),get=path=>fetch(origin+path,{headers});
 const pdf=await PDFDocument.create(),page=pdf.addPage(),font=await pdf.embedFont(StandardFonts.Helvetica);page.drawText('FICTIONAL AUTHORITY SOURCE',{x:40,y:700,font,size:12});const added=await post('/api/jobs',{clientId:'glossary-audit',requestId:'review-term',provider:'openai',model:'fixture-model',metadata:{sourceLanguage:'Englisch',targetLanguage:'Deutsch'},files:[{name:'fictional.pdf',data:Buffer.from(await pdf.save()).toString('base64')}]});assert.equal(added.status,202);const {id}=await added.json();
 let job;for(let tries=0;tries<3000;tries++){const snapshot=await get('/api/jobs').then(response=>response.json());job=snapshot.jobs.find(item=>item.id===id);if(job?.status==='succeeded'||job?.status==='failed')break;await new Promise(resolve=>setTimeout(resolve,20));}assert.equal(job?.status,'succeeded',job?.error||'fictional translation did not complete');
 const review=await get(`/api/jobs/${id}/review?preview=1`).then(response=>response.json()),check=review.checks.find(item=>item.termId===term.id);assert.ok(check);assert.equal(check.present,false);assert.equal(check.severity,'warning');assert.match(check.issue,/erlaubte Variante/u);const result=await get(`/api/jobs/${id}/result`).then(response=>response.json());assert.equal(result.text,'Die Behörde wurde bestätigt.','glossary review must not silently replace translation text');
});
