import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import sharp from 'sharp';
import {PDFDocument} from 'pdf-lib';
import {createApp} from '../server.mjs';
import {diagnosticFor,networkFetch} from '../lib/diagnostics.mjs';
import {createTranslationWord} from '../lib/word.mjs';
const raw=()=>JSON.stringify({status:'ready',sourceLanguage:'Arabisch',documentType:'Führerschein',questions:[],text:'(Vorderseite)\nName | Alex Example\nGeburtsdatum | 7.3.1998\n(Rückseite)\nGültig bis | 2030-11-09\nKennzeichen | [Arabischer Buchstabe, Lautschrift: „bāʾ“]'});
const output=()=>new Response(`data: ${JSON.stringify({type:'response.output_text.delta',delta:raw()})}\n\ndata: ${JSON.stringify({type:'response.completed'})}\n\n`);
const networkError=()=>new TypeError('fetch failed',{cause:new AggregateError([Object.assign(new Error('secret token and private body'),{code:'ENETUNREACH'}),Object.assign(new Error('private address'),{code:'UND_ERR_CONNECT_TIMEOUT'})])});
test('Diagnostics retain nested transport codes but never raw causes, tokens or document contents',()=>{
 const d=diagnosticFor(networkError(),{stage:'translation_request',host:'api.openai.com',fileCount:2,requestId:'req-test'});
 assert.deepEqual(d.codes,['ENETUNREACH','UND_ERR_CONNECT_TIMEOUT']);assert.equal(d.type,'network');assert.equal(d.stage,'translation_request');assert.match(d.reason,/Netzwerk/);assert.match(d.id,/^[a-f0-9-]+$/);assert.equal(JSON.stringify(d).includes('secret'),false);assert.equal(JSON.stringify(d).includes('private'),false);
});
test('Safe pre-connect GET failures retry once; translation POST and interrupted streams never resubmit',async()=>{
 let calls=0;const fetcher=async()=>{calls++;if(calls===1)throw networkError();return new Response('{}');};await networkFetch('https://api.openai.com/v1/models',{}, {stage:'model_catalog'},fetcher);assert.equal(calls,2);
 calls=0;await assert.rejects(networkFetch('https://api.openai.com/v1/responses',{method:'POST'},{stage:'translation_request'},async()=>{calls++;throw networkError();}));assert.equal(calls,1);
});
test('Word contains editable structured paragraphs, real tables, safe XML, and final dates',()=>{
 const bytes=createTranslationWord('Name | Alex & Example <Test>\nGeburtsdatum | 7.3.1998\n(Rückseite)\nKennzeichen: [Arabischer Buchstabe, Lautschrift: „bāʾ“]',{language:'Arabisch',targetLanguage:'Deutsch'});const files=unzipSync(bytes),xml=strFromU8(files['word/document.xml']);assert.ok(files['[Content_Types].xml']);assert.match(xml,/Beglaubigte Übersetzung aus dem Arabischen ins Deutsche/);assert.match(xml,/<w:tbl>/);assert.match(xml,/07\.03\.1998/);assert.match(xml,/Alex &amp; Example &lt;Test&gt;/);assert.doesNotMatch(xml,/TODO|PRÜFHINWEISE|Unbeglaubigter Entwurf/);assert.throws(()=>createTranslationWord('Name: [zu prüfen: Alex]'));
 const ar=strFromU8(unzipSync(createTranslationWord('اسم: مثال',{language:'Deutsch',targetLanguage:'Arabisch'}))['word/document.xml']);assert.match(ar,/<w:bidi\/>/);assert.match(ar,/اسم/);
});
test('One job accepts front and back, reports transport diagnostics, retries and produces PDF plus editable Word in a private ZIP',async t=>{
 const port=14321,requests=[];let fail=true;
 const connection={data:{hostId:'host'},status:()=>({connected:true,planEnabled:true}),models:async()=>[{id:'test'}],accessToken:async()=>'never-log-this-token'};
 const app=createApp({connection,port,fetcher:async(url,options)=>{if(options?.method==='POST'){requests.push(JSON.parse(options.body));if(fail)throw networkError();return output();}return new Response('{}',{status:url.includes('api.openai.com')?401:200});}});
 await new Promise(r=>app.listen(port,'127.0.0.1',r));t.after(()=>new Promise(r=>app.close(r)));const origin=`http://127.0.0.1:${port}`;
 async function login(){const root=await fetch(origin),cookie=root.headers.get('set-cookie').split(';')[0],s=await fetch(`${origin}/api/session`,{headers:{Cookie:cookie}}).then(r=>r.json());return {Cookie:cookie,Origin:origin,'Content-Type':'application/json','X-TranslateOCR-Csrf':s.csrf};}
 const headers=await login(),other=await login();const image=await sharp({create:{width:60,height:40,channels:3,background:'white'}}).jpeg().toBuffer();
 const backImage=await sharp({create:{width:60,height:40,channels:3,background:'lightgray'}}).jpeg().toBuffer();
 const post=(path,value,h=headers)=>fetch(origin+path,{method:'POST',headers:h,body:JSON.stringify(value)});
 const {id}=await post('/api/jobs',{clientId:'qa',requestId:'front-back',model:'test',metadata:{targetLanguage:'Deutsch'},files:['front.jpeg','back.jpeg'].map((name,i)=>({name,data:(i?backImage:image).toString('base64')}))}).then(r=>r.json());
 async function waitFor(status){for(let i=0;i<120;i++){const state=await fetch(`${origin}/api/jobs`,{headers}).then(r=>r.json()),job=state.jobs[0];if(job.status===status)return job;if(status==='succeeded'&&job.status==='failed')assert.fail(job.error);await new Promise(r=>setTimeout(r,10));}assert.fail(`Missing ${status}`);}
 const failed=await waitFor('failed');assert.equal(failed.diagnostic.stage,'translation_request');assert.equal(failed.diagnostic.fileCount,2);assert.ok(failed.diagnostic.codes.includes('UND_ERR_CONNECT_TIMEOUT'));assert.notEqual(failed.error,'fetch failed');assert.equal(JSON.stringify(failed).includes('never-log'),false);assert.equal(requests.length,1);
 fail=false;await post(`/api/jobs/${id}/retry`,{});const done=await waitFor('succeeded');assert.equal(done.diagnostic,null);assert.ok(done.events.some(e=>e.stage==='word'));
 const result=await fetch(`${origin}/api/jobs/${id}/result`,{headers}).then(r=>r.json());assert.equal(result.previews.length,2);assert.equal((await PDFDocument.load(Buffer.from(result.pdf,'base64'))).getPageCount(),3);assert.match(strFromU8(unzipSync(Buffer.from(result.word,'base64'))['word/document.xml']),/Rückseite/);
 const content=requests[1].input[0].content;assert.equal(content.filter(c=>c.type==='input_image').length,2);assert.ok(content.findIndex(c=>c.text?.includes('front.jpeg'))<content.findIndex(c=>c.text?.includes('back.jpeg')));
 const zipResponse=await fetch(`${origin}/api/jobs/${id}/bundle`,{headers});assert.match(zipResponse.headers.get('content-type'),/zip/);const zip=unzipSync(new Uint8Array(await zipResponse.arrayBuffer()));assert.deepEqual(Object.keys(zip),['uebersetzung.pdf','uebersetzung.docx']);assert.equal(Buffer.from(zip['uebersetzung.pdf']).subarray(0,5).toString(),'%PDF-');assert.ok(unzipSync(zip['uebersetzung.docx'])['word/document.xml']);assert.equal((await fetch(`${origin}/api/jobs/${id}/bundle`,{headers:other})).status,400);
 const health=await post('/api/diagnostics/check',{}).then(r=>r.json());assert.equal(health.checks.length,2);assert.equal(health.checks[0].reachable,true);assert.equal(health.checks[0].httpStatus,401);
 const wordResponse=await post('/api/word',{text:'Name: Example',metadata:{targetLanguage:'Deutsch'}});assert.match(wordResponse.headers.get('content-type'),/wordprocessingml/);
});
