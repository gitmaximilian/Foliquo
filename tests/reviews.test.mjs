import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {unzipSync,strFromU8} from 'fflate';
import {normalizeDates,normalizeTranslation,parseFinalTranslation,translationInstructions} from '../lib/translation-policy.mjs';
import {applyReview,reviewSnapshot,finalReview} from '../lib/reviews.mjs';
import {createApp} from '../server.mjs';
test('Dates use dots everywhere and German terminology applies without altering other target languages',()=>{
 assert.equal(normalizeDates('7.3.1998; 07 03 1998; 1998-03-07; 7/3/1998'),'07.03.1998; 07.03.1998; 07.03.1998; 07.03.1998');
 assert.equal(normalizeTranslation('Kennzeichen: unversehrt'),'Merkmale: keine besonderen Merkmale');assert.equal(normalizeTranslation('Kennzeichen: unversehrt','Englisch'),'Kennzeichen: unversehrt');
 assert.equal(normalizeTranslation('وزارة الداخلية'),'Innenministerium');assert.equal(normalizeTranslation('Ministerium des Inneren'),'Innenministerium');assert.equal(normalizeTranslation('Passbild'),'[Lichtbild]');assert.equal(normalizeTranslation('[Passfoto]'),'[Lichtbild]');assert.equal(normalizeTranslation('Handschriftlicher Zusatz: Die Direktorin Zainab Hasan'),'[Handschriftlich: Die Direktorin Zainab Hasan]');assert.equal(normalizeTranslation('Stempel:\n[Blauer ovaler Stempel]\n[Mehrzweck-Gemeinschaftszentrum]'),'Stempel:\nBlauer ovaler Stempel\nMehrzweck-Gemeinschaftszentrum');assert.equal(normalizeTranslation('[Blauer ovaler Stempel]'),'Blauer ovaler Stempel');assert.equal(normalizeTranslation('Stempel:\n[Staatswappen Syriens (Adler)]'),'Stempel:\n[Staatswappen Syriens (Adler)]');assert.equal(normalizeTranslation('Name | [Alex Example]\nLogo | [Firmenzeichen]\nUnterschrift | [Unterschrift: unleserlich]\nWappen | [Adler]'),'Name | Alex Example\nLogo | [Firmenzeichen]\nUnterschrift | [Unterschrift: unleserlich]\nWappen | [Adler]');assert.equal(normalizeTranslation('Ministerium des Inneren','English'),'Ministerium des Inneren');assert.equal(normalizeTranslation('Passfoto','English'),'[Lichtbild]');assert.equal(normalizeTranslation('[Unterschrift vorhanden]'),'[Unterschrift: unleserlich]');assert.equal(normalizeTranslation('Automatischer Entwurf · nicht beglaubigt\nName | Alex'),'Name | Alex');
 const prompt=translationInstructions('Deutsch','Arabisch');assert.match(prompt,/Unterschrift ohne klar lesbaren[\s\S]*?frage dazu niemals nach/u);assert.match(prompt,/Unterschriften ohne klar lesbaren Namen sind davon ausgenommen/u);
 const result=parseFinalTranslation(JSON.stringify({status:'ready',sourceLanguage:'Arabisch',documentType:'Urkunde',questions:[],text:'Geboren: 31.02.1998'}));assert.equal(result.requiresInput,true);
});
test('Review changes are atomic, deduplicated and versioned; failed exports retain previous files',async()=>{
 const original={text:'Original',pdf:'old-pdf',word:'old-word'},job={id:'job',status:'succeeded',model:'test',result:original};const input={prompt:'Ändern',version:1,requestId:'one'};
 const failed=await applyReview(job,input,async()=>({text:'New'}),async()=>{throw new Error('Export failed');});assert.equal(failed.version,1);assert.equal(failed.busy,false);assert.equal(job.result,original);assert.ok(failed.diagnostic);
 let calls=0;await applyReview(job,input,async()=>{calls++;},async()=>{});assert.equal(calls,0);
 const updated=await applyReview(job,{...input,requestId:'two'},async()=>({text:'New'}),async r=>({...r,pdf:'new-pdf',word:'new-word'}));assert.equal(updated.version,2);assert.equal(finalReview(job,2).pdf,'new-pdf');assert.throws(()=>finalReview(job,1));
});
test('HTTP editing chat preserves original pages, blocks stale/final downloads while busy and asks in chat before committing',async t=>{
 const port=14322;let call=0,release;const gate=new Promise(r=>release=r);const seen=[];
 const ready=text=>JSON.stringify({status:'ready',sourceLanguage:'Arabisch',documentType:'Führerschein',questions:[],text});
 const first='(Vorderseite)\nName: Alex Example\nGeboren: 07 03 1998\nKennzeichen: unversehrt';
 const connection={data:{hostId:'host'},status:()=>({connected:true,planEnabled:true}),models:async()=>[{id:'test'}],accessToken:async()=>'test'};
 const app=createApp({connection,port,fetcher:async(_,options)=>{call++;seen.push(JSON.parse(options.body));if(call===2)await gate;const raw=call===3?JSON.stringify({status:'questions',sourceLanguage:'Arabisch',documentType:'Führerschein',questions:[{question:'Welche Schreibweise soll verwendet werden?',context:'Name'}],text:''}):ready(call===1?first:'(Vorderseite)\nName: Omar Hassan\nGeboren: 07.03.1998\nMerkmale: keine besonderen Merkmale');return new Response(`data: ${JSON.stringify({type:'response.output_text.delta',delta:raw})}\n\ndata: ${JSON.stringify({type:'response.completed'})}\n\n`);}});
 await new Promise(r=>app.listen(port,'127.0.0.1',r));t.after(()=>new Promise(r=>app.close(r)));const origin=`http://127.0.0.1:${port}`;
 async function login(){const r=await fetch(origin),cookie=r.headers.get('set-cookie').split(';')[0],s=await fetch(origin+'/api/session',{headers:{Cookie:cookie}}).then(r=>r.json());return {Cookie:cookie,Origin:origin,'Content-Type':'application/json','X-TranslateOCR-Csrf':s.csrf};}
 const headers=await login(),other=await login(),post=(path,input,h=headers)=>fetch(origin+path,{method:'POST',headers:h,body:JSON.stringify(input)});
 const source=await PDFDocument.create();source.addPage();const data=Buffer.from(await source.save()).toString('base64');
 const {id}=await post('/api/jobs',{clientId:'test',requestId:'one',model:'test',metadata:{targetLanguage:'Deutsch',additionalInfo:'Bereits geklärt.'},files:[{name:'sample.pdf',data}]}).then(r=>r.json());
 for(let n=0;n<6000;n++){const state=await fetch(origin+'/api/jobs',{headers}).then(r=>r.json());if(state.jobs[0].status==='succeeded')break;await new Promise(r=>setTimeout(r,10));}
 const base=`/api/jobs/${id}/review`;let state=await fetch(origin+base+'?preview=1',{headers}).then(r=>r.json());assert.equal(state.version,1);assert.match(state.result.text,/07\.03\.1998/);assert.match(state.result.text,/Merkmale: keine besonderen Merkmale/);assert.equal((await fetch(origin+base,{headers:other})).status,400);
 const editing=post(base+'/edit',{prompt:'Name auf Omar Hassan ändern.',version:1,requestId:'edit-one'});for(let i=0;i<50&&call<2;i++)await new Promise(r=>setTimeout(r,5));
 state=await fetch(origin+base,{headers}).then(r=>r.json());assert.equal(state.busy,true);assert.equal((await post(base+'/finalize',{version:1,format:'pdf'})).status,200,'the current complete version remains downloadable during an optional edit');assert.equal((await post(base+'/edit',{prompt:'Zweite Änderung',version:1,requestId:'overlap'})).status,400);
 release();state=await editing.then(r=>r.json());assert.equal(state.busy,false);assert.equal(state.version,2);assert.equal((await post(base+'/finalize',{version:1,format:'bundle'})).status,400);
 const final=await post(base+'/finalize',{version:2,format:'bundle'});assert.equal(final.status,200);const zip=unzipSync(new Uint8Array(await final.arrayBuffer()));assert.match(strFromU8(unzipSync(zip['uebersetzung.docx'])['word/document.xml']),/Omar Hassan/);assert.equal((await PDFDocument.load(zip['uebersetzung.pdf'])).getPageCount(),2);
 assert.match(seen[1].input[0].content[0].text,/currentTranslation/);assert.match(seen[1].input[0].content[0].text,/Omar Hassan/);assert.match(JSON.stringify(seen[1]),/Bereits geklärt/);
 state=await post(base+'/edit',{prompt:'Ändere den Namen nochmal.',version:2,requestId:'question'}).then(r=>r.json());assert.equal(state.version,2);assert.equal(state.hasQuestions,true);assert.equal(state.busy,false);assert.equal((await post(base+'/finalize',{version:2,format:'word'})).status,200,'an optional follow-up question does not lock the completed version');
 state=await post(base+'/edit',{prompt:'Omar Hassan ist richtig, beibehalten.',version:2,requestId:'answer'}).then(r=>r.json());assert.equal(state.version,3);assert.equal(state.hasQuestions,false);assert.ok(state.messages.some(m=>m.text.includes('Welche Schreibweise')));assert.equal((await post(base+'/finalize',{version:3,format:'word'})).status,200);
});
