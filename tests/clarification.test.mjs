import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFinalTranslation,normalizeDates,translationTitle} from '../lib/translation-policy.mjs';
import {createTranslationPDF} from '../lib/documents.mjs';
import {TranslationQueue} from '../lib/queue.mjs';
import {createApp} from '../server.mjs';
import {PDFDocument} from 'pdf-lib';
const result=(text,extra={})=>JSON.stringify({status:'ready',sourceLanguage:'Arabisch',documentType:'Geburtsurkunde',questions:[],text,...extra});
const turn=()=>new Promise(r=>setImmediate(r));
const payload={model:'test',files:[{name:'test.pdf',bytes:Buffer.from('%PDF-')}],metadata:{targetLanguage:'Deutsch',additionalInfo:'Name laut Pass: Omar Hassan'}};
test('Only resolved, structured translations pass; open items become questions without draft text',()=>{
 assert.throws(()=>parseFinalTranslation('unstructured text'));
 assert.throws(()=>parseFinalTranslation(result('',{status:'questions'})));
 for(const text of ['Name: [zu prüfen: Omar]', 'PRÜFHINWEISE\nName abgleichen', 'Geburtsdatum: 31 02 2000', 'Kennzeichen: ب', 'Stempel: [unleserlich]']){const parsed=parseFinalTranslation(result(text));assert.equal(parsed.requiresInput,true);assert.ok(parsed.questions.length);assert.equal('text' in parsed,false);}
 assert.equal(parseFinalTranslation(result('Stempel: [im Original unleserlich]')).requiresInput,undefined);
 const question=parseFinalTranslation(result('Never show this',{status:'questions',questions:[{question:'Wie lautet der Name laut Pass?',context:'Seite 1, Name'}]}));assert.equal('text' in question,false);
});
test('Dates normalize and PDF heading contains both languages and the requested wording',async()=>{
 assert.equal(normalizeDates('Geboren: 7.3.1998; gültig bis 2030-01-09'),'Geboren: 07.03.1998; gültig bis 09.01.2030');
 assert.equal(translationTitle({language:'Arabisch',targetLanguage:'Deutsch'}),'Beglaubigte Übersetzung aus der arabischen Sprache ins Deutsche');
 const parsed=parseFinalTranslation(result('Name: Omar Hassan\nGeboren: 7.3.1998\nKennzeichen: [Arabischer Buchstabe, Lautschrift: „bāʾ“]'));
 assert.match(parsed.text,/07\.03\.1998/);
 const bytes=await createTranslationPDF(parsed.text,[],{language:'Arabisch',targetLanguage:'Deutsch'});assert.equal((await PDFDocument.load(bytes)).getPageCount(),1);
 await assert.rejects(createTranslationPDF('Name: [zu prüfen: Omar]'),/Rückfragen/);
 await assert.rejects(createTranslationPDF('Name: \u{1F600}'),/Zeichen/);
});
test('Waiting questions release worker; answers require ownership, completeness and current IDs',async()=>{
 const q=new TranslationQueue(async p=>p.metadata.clarifications?{pdf:'final',text:'Omar Hassan'}:{requiresInput:true,questions:[{question:'Name?',context:'Seite 1'}],detected:{sourceLanguage:'Arabisch'}});
 const a=q.add({owner:'owner',clientId:'one',requestId:'a',payload:structuredClone(payload)});const b=q.add({owner:'owner',clientId:'one',requestId:'b',payload:structuredClone(payload)});
 await turn();await turn();assert.equal(a.status,'awaiting_answers');assert.equal(b.status,'awaiting_answers');assert.equal(a.result,null);assert.equal(q.active,null);
 const id=a.questions[0].id;assert.throws(()=>q.answer(a.id,'other',[{id,answer:'Omar'}]));assert.throws(()=>q.answer(a.id,'owner',[]));assert.throws(()=>q.answer(a.id,'owner',[{id:'stale',answer:'Omar'}]));assert.equal(a.status,'awaiting_answers');
 q.answer(a.id,'owner',[{id,answer:'Omar Hassan'}]);assert.throws(()=>q.answer(a.id,'owner',[{id,answer:'Again'}]));await turn();assert.equal(a.status,'succeeded');assert.equal(a.result.pdf,'final');q.cancel(b.id,'owner');assert.equal(b.status,'cancelled');
});
test('HTTP questions block PDF until answers arrive and preserve upload facts in subsequent inference',async t=>{
 const port=14320;const seen=[];
 const connection={data:{hostId:'host'},status:()=>({connected:true,planEnabled:true}),models:async()=>[{id:'test'}],accessToken:async()=>'test'};
 const app=createApp({connection,port,fetcher:async(_,options)=>{const request=JSON.parse(options.body);seen.push(request);const answered=request.input[0].content[0].text.includes('Omar Hassan confirmed');const raw=result(answered?'Name: Omar Hassan\nGeburtsdatum: 7.3.1998':'',{status:answered?'ready':'questions',questions:answered?[]:[{question:'Name laut Pass?',context:'Seite 1'}]});return new Response(`data: ${JSON.stringify({type:'response.output_text.delta',delta:raw})}\n\ndata: ${JSON.stringify({type:'response.completed'})}\n\n`);}});
 await new Promise(r=>app.listen(port,'127.0.0.1',r));t.after(()=>new Promise(r=>app.close(r)));const origin=`http://127.0.0.1:${port}`;
 async function login(){const root=await fetch(origin),cookie=root.headers.get('set-cookie').split(';')[0],session=await fetch(`${origin}/api/session`,{headers:{Cookie:cookie}}).then(r=>r.json());return {Cookie:cookie,Origin:origin,'Content-Type':'application/json','X-TranslateOCR-Csrf':session.csrf};}
 const headers=await login(),other=await login();const original=await PDFDocument.create();original.addPage();const data=Buffer.from(await original.save()).toString('base64');
 const post=async(path,input,h=headers)=>fetch(origin+path,{method:'POST',headers:h,body:JSON.stringify(input)});
 const added=await post('/api/jobs',{model:'test',clientId:'browser',requestId:'one',files:[{name:'test.pdf',data}],metadata:{targetLanguage:'Deutsch',additionalInfo:'Passschreibweise Omar Hassan'}}).then(r=>r.json());
 async function waitFor(status){for(let i=0;i<100;i++){const state=await fetch(`${origin}/api/jobs`,{headers}).then(r=>r.json());if(state.jobs[0].status===status)return state.jobs[0];await new Promise(r=>setTimeout(r,10));}assert.fail(`Missing status ${status}`);}
 const job=await waitFor('awaiting_answers');assert.equal(job.hasResult,false);assert.equal((await fetch(`${origin}/api/jobs/${job.id}/result`,{headers})).status,409);
 const answers=[{id:job.questions[0].id,answer:'Omar Hassan confirmed'}];assert.equal((await post(`/api/jobs/${job.id}/answer`,{answers},other)).status,400);assert.equal((await post(`/api/jobs/${job.id}/answer`,{answers:[]})).status,400);assert.equal((await post(`/api/jobs/${job.id}/answer`,{answers})).status,200);
 await waitFor('succeeded');const output=await fetch(`${origin}/api/jobs/${added.id}/result`,{headers}).then(r=>r.json());assert.match(output.text,/07\.03\.1998/);assert.equal(Buffer.from(output.pdf,'base64').subarray(0,5).toString(),'%PDF-');assert.match(seen[1].input[0].content[0].text,/Passschreibweise Omar Hassan/);assert.match(seen[1].input[0].content[0].text,/Omar Hassan confirmed/);
});
