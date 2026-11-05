import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {unzipSync,strFromU8} from 'fflate';
import {Workspace} from '../lib/workspace.mjs';
import {createApp} from '../server.mjs';
import {initializeRuleLibrary,proposeRule,reviewRuleProposal} from '../lib/personal-rules.mjs';
import {createContextLibrarySnapshot,resolveContextSnapshot} from '../lib/context.mjs';
import {personalRuleQuestions} from '../lib/rule-questions.mjs';

function add(data,effect,scope={}){const proposal=proposeRule(data,{definition:{title:JSON.stringify(effect),effect,scope,origins:[{kind:'manual',id:'fictional-user-input'}]}});return reviewRuleProposal(data,proposal.id,{version:1,accept:true}).rule;}
test('canonical context freezes manual rules and source scope, asks for conflicts and accepts only a bound job choice',()=>{
 const data=initializeRuleLibrary({learning:[],glossary:[]});add(data,{kind:'layout',key:'lineHeight',value:1.5},{sourceLanguage:'English'});const second=add(data,{kind:'layout',key:'lineHeight',value:1.2},{sourceLanguage:'English'});
 const workspace={data,context:()=>null},metadata={targetLanguage:'Deutsch'},library=createContextLibrarySnapshot(workspace,metadata),context=resolveContextSnapshot(library,metadata),payload={metadata:{...metadata,clarifications:[]},contextLibrarySnapshot:library,ruleContextMetadata:metadata};
 let result=personalRuleQuestions(payload,context);assert.equal(result.questions[0].kind,'personal-rule-scope');assert.equal(result.context.layout,null);
 payload.metadata.clarifications.push({context:result.questions[0].context,answer:'English'});
 result=personalRuleQuestions(payload,result.context);assert.equal(result.questions.length,1);assert.equal(result.questions[0].kind,'personal-rule');assert.equal(result.context.layout,null);
 payload.metadata.clarifications.push({context:result.questions[0].context,answer:'2'});
 result=personalRuleQuestions(payload,result.context);assert.deepEqual(result.questions,[]);assert.equal(result.context.layout.lineHeight,1.2);assert.equal(result.context.appliedRules[0].id,second.id);
 data.personalRules[1].effect.value=1.8;assert.equal(resolveContextSnapshot(library,{targetLanguage:'Deutsch',sourceLanguage:'English',ruleDecisions:payload.ruleDecisions}).layout.lineHeight,1.2);
});
test('new context omits deactivated sample instructions, shares glossary filtering and preserves old snapshot interpretation',()=>{
 const data=initializeRuleLibrary({learning:[{id:'fictional-sample',name:'Fictional profile',active:true,status:'active',version:1,documentType:'Passport',targetLanguage:'Deutsch',rules:['Use fictional concise headings.'],layout:{lineHeight:1.5},analysis:{profileVersion:1,sourceLanguage:'English',observations:[],terminology:[{source:'register',target:'Register',approved:true}]}}],glossary:[]});
 const metadata={documentType:'Passport',targetLanguage:'Deutsch',sourceLanguage:'English'},library=createContextLibrarySnapshot({data,context:()=>null},metadata),context=resolveContextSnapshot(library,metadata);
 assert.equal(context.personalStyleRules.length,1);assert.equal(context.terms.length,1);assert.equal(context.layout.lineHeight,1.5);
 const style=library.rules.rules.find(rule=>rule.effect.kind==='style');style.status='inactive';
 const disabled=resolveContextSnapshot(library,metadata);assert.deepEqual(disabled.personalStyleRules,[]);assert.deepEqual(disabled.learningExamples[0].rules,[]);
 const old=resolveContextSnapshot({...library,schema:1},metadata);assert.equal(old.learningExamples[0].rules.length,1,'old pinned contexts retain their prior interpretation');
 const off=resolveContextSnapshot(library,{...metadata,useLearning:false});assert.equal(off.appliedRules.length,0);assert.equal(off.terms.length,0);
});
test('new canonical contexts consider every matching enabled sample instead of silently applying the old top-three hint limit',()=>{
 const data=initializeRuleLibrary({glossary:[],learning:Array.from({length:4},(_,index)=>({id:`fictional-${index}`,name:`Fictional sample ${index}`,active:true,status:'active',documentType:'Licence',targetLanguage:'Deutsch',rules:[],fieldLabels:[],layout:{lineHeight:index===3?1.8:1.2},analysis:{profileVersion:1,sourceLanguage:'English'}}))}),meta={sourceLanguage:'English',targetLanguage:'Deutsch',documentType:'Licence'},snapshot=createContextLibrarySnapshot({data,context:()=>null},meta),context=resolveContextSnapshot(snapshot,meta);
 assert.equal(context.ruleResolution.conflicts.length,1);assert.ok(context.ruleResolution.conflicts[0].choices.some(choice=>choice.effect.value===1.8));assert.equal(context.layout,null);const legacy=resolveContextSnapshot({...snapshot,schema:1},meta);assert.equal(legacy.learningExamples.length,3);assert.equal(legacy.layout.lineHeight,1.2);
});
test('HTTP translation applies canonical rules once and exports actual Word spacing and a PDF with its original annex',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-fictional-rule-export-')),workspace=await new Workspace(directory).init();
 add(workspace.data,{kind:'layout',key:'lineHeight',value:1.5});add(workspace.data,{kind:'style',text:'Use neutral fictional headings.'});
 workspace.data.learning=[{id:'fictional-style-sample',name:'Fictional style',active:true,status:'active',version:1,documentType:'Fictional certificate',targetLanguage:'Deutsch',rules:['Keep the fictional wording concise.'],analysis:{profileVersion:1,sourceLanguage:'English',observations:[],terminology:[]}}];await workspace.save();
 const requests=[],provider={id:'openai',selected:'openai',status:()=>({connected:true,planEnabled:true}),models:async()=>[{id:'fixture-model'}],respond:async request=>{requests.push(request);return JSON.stringify(request.instructions.includes('Extrahiere alle sichtbaren')?{documentType:'Fictional certificate',sourceLanguage:'English',fields:[]}:{status:'ready',sourceLanguage:'English',documentType:'Fictional certificate',questions:[],text:'FIKTIVE ÜBERSETZUNG\nFiktiver erster Absatz.\nFiktiver zweiter Absatz.',fields:[],regions:[]});}};
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const app=createApp({workspace,port,provider,connection:{data:{}}});await new Promise(resolve=>app.listen(port,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>app.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});});
 const origin=`http://127.0.0.1:${port}`,home=await fetch(origin),cookie=home.headers.get('set-cookie').split(';')[0],session=await fetch(origin+'/api/session',{headers:{cookie}}).then(r=>r.json()),headers={cookie,origin,'content-type':'application/json','x-foliquo-csrf':session.csrf};
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage([300,500]).drawText('FICTIONAL SOURCE ONLY',{x:30,y:450,font,size:10});
 const created=await fetch(origin+'/api/jobs',{method:'POST',headers,body:JSON.stringify({provider:'openai',model:'fixture-model',clientId:'fictional-rule-client',requestId:'fictional-rule-request',metadata:{targetLanguage:'Deutsch',sourceLanguage:'Automatisch'},files:[{name:'fictional-rule.pdf',data:Buffer.from(await pdf.save()).toString('base64')}]})});assert.equal(created.status,202,await created.clone().text());const {id}=await created.json();
 let completed;const deadline=Date.now()+60000;
 while(Date.now()<deadline){const status=await fetch(origin+'/api/jobs',{headers}).then(r=>r.json()),job=status.jobs.find(j=>j.id===id);if(job?.status==='succeeded'){completed=workspace.data.jobs.find(j=>j.id===id);break;}if(['failed','cancelled','awaiting_answers'].includes(job?.status))assert.fail(JSON.stringify(job));await new Promise(resolve=>setTimeout(resolve,50));}
 assert.ok(completed,'fictional export completes');assert.equal(requests.length,2,'one extraction and one translation; no extra rule request');
 const prompt=requests[1].input[0].content.filter(item=>item.type==='input_text').map(item=>item.text).join('\n');assert.match(prompt,/approvedPersonalRules/);assert.doesNotMatch(prompt,/"personalStyle":/);assert.equal(prompt.split('Keep the fictional wording concise.').length-1,1);
 assert.equal(completed.result.context.layout.lineHeight,1.5);assert.equal(completed.result.context.appliedRules.length,3);
 assert.deepEqual(completed.result.context.contextVersions.rules,completed.result.context.appliedRules.map(({id,version})=>({id,version})));
 const word=unzipSync(Buffer.from(completed.result.word,'base64')),xml=strFromU8(word['word/document.xml']);assert.match(xml,/w:line="360"/);
 const exported=await PDFDocument.load(Buffer.from(completed.result.pdf,'base64'));assert.ok(exported.getPageCount()>=2,'original source annex retained');
 const call=async(path,input)=>{const response=await fetch(origin+path,{method:'POST',headers,body:JSON.stringify(input)});const data=await response.json();assert.ok([200,201].includes(response.status),JSON.stringify(data));completed=workspace.data.jobs.find(job=>job.id===id);return data;};
 const oldWord=completed.result.word,oldContext=structuredClone(completed.result.context);const spacing=workspace.data.personalRules.find(rule=>rule.effect.key==='lineHeight');const change=await call('/api/personal-rules/proposals',{requestId:'11111111-1111-4111-8111-111111111111',operation:'replace',targetId:spacing.id,targetVersion:spacing.version,definition:{title:'New fictional spacing',effect:{kind:'layout',key:'lineHeight',value:1.8},scope:{}}});await call('/api/personal-rules/review',{id:change.proposal.id,version:1,accept:true});
 const preview=await call(`/api/jobs/${id}/review/rules`,{version:1});assert.equal(preview.requiresProvider,false);assert.equal(preview.layout.lineHeight,1.8);assert.equal(completed.result.word,oldWord);
 const latest=workspace.data.personalRules.find(rule=>rule.id===spacing.id),later=await call('/api/personal-rules/proposals',{requestId:'22222222-2222-4222-8222-222222222222',operation:'replace',targetId:spacing.id,targetVersion:latest.version,definition:{title:'Later fictional spacing',effect:{kind:'layout',key:'lineHeight',value:1.2},scope:{}}});await call('/api/personal-rules/review',{id:later.proposal.id,version:1,accept:true});
 const staged=await call(`/api/jobs/${id}/review/edit`,{version:1,rulePreviewId:preview.previewId,requestId:'fictional-layout-reapplication'});assert.ok(staged.proposal);assert.equal(completed.result.context.layout.lineHeight,1.5);assert.equal(completed.review.proposal.result.context.layout.lineHeight,1.8,'preview pins the approved version');assert.equal(requests.length,2,'layout reapplication is local');assert.ok((await PDFDocument.load(Buffer.from(completed.review.proposal.result.pdf,'base64'))).getPageCount()>=2,'new PDF retains the original annex');
 await call(`/api/jobs/${id}/revision`,{action:'accept',version:1,accepted:[]});assert.equal(completed.review.version,2);assert.equal(completed.result.context.layout.lineHeight,1.8);assert.match(strFromU8(unzipSync(Buffer.from(completed.result.word,'base64'))['word/document.xml']),/w:line="432"/);assert.deepEqual(completed.review.versions.find(entry=>entry.version===1).context,oldContext);
 const style=await call('/api/personal-rules/proposals',{requestId:'33333333-3333-4333-8333-333333333333',definition:{title:'New fictional wording',effect:{kind:'style',text:'Use newly approved fictional wording.'},scope:{}}});await call('/api/personal-rules/review',{id:style.proposal.id,version:1,accept:true});const wordingPreview=await call(`/api/jobs/${id}/review/rules`,{version:2});assert.equal(wordingPreview.requiresProvider,true);await call(`/api/jobs/${id}/review/edit`,{version:2,rulePreviewId:wordingPreview.previewId,requestId:'fictional-wording-reapplication'});assert.ok(completed.review.proposal);assert.ok(completed.review.proposal.result.context.personalStyleRules.includes('Use newly approved fictional wording.'));assert.equal(requests.length,3,'wording uses the existing revision call without a fresh extraction');assert.equal(JSON.stringify(requests[2]).split('Use newly approved fictional wording.').length-1,1,'revision sends each canonical wording rule once');
 await call(`/api/jobs/${id}/revision`,{action:'accept',version:2,accepted:completed.review.proposal.changes.filter(change=>change.id).map(change=>change.id)});assert.equal(completed.review.version,3);await call(`/api/jobs/${id}/revision`,{action:'restore',version:3,restoreVersion:1});assert.equal(completed.review.version,4);assert.equal(completed.result.context.layout.lineHeight,1.5);assert.deepEqual(completed.result.context.appliedRules,oldContext.appliedRules);

});
