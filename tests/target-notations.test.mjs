import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as createNetServer} from 'node:net';
import {TARGET_NOTATIONS,unreadableHandwriting} from '../lib/target-notations.mjs';
import {translationInstructions,normalizeTranslation,translationTitle,translationHeaderLines,finalTextQuestions} from '../lib/translation-policy.mjs';
import {specialRegions} from '../lib/form-fields.mjs';
import {createDocumentModel,assertDocumentClarified} from '../lib/document-model.mjs';
import {documentFromLegacyText,documentToLegacyText} from '../lib/document-adapter.mjs';
import {Workspace} from '../lib/workspace.mjs';
import {createApp} from '../server.mjs';

const targets=Object.keys(TARGET_NOTATIONS);

test('German prompt keeps its established notations and question language',()=>{
 const prompt=translationInstructions('Deutsch','Arabisch');
 assert.match(prompt,/stelle gezielte Fragen in deutscher Sprache \(maximal 10 pro Runde\)/);
 assert.match(prompt,/\[Unterschrift: unleserlich\]/);
 assert.match(prompt,/„Stempel:“/);
 assert.equal(prompt,translationInstructions('Deutsch','Arabisch','Deutsch'));
});

test('prompts for other target languages use target-language notations only',()=>{
 for(const target of targets.filter(target=>target!=='Deutsch')){
  const n=TARGET_NOTATIONS[target],prompt=translationInstructions(target,'Arabisch');
  assert.ok(prompt.includes(`[${n.signature}: ${n.illegible}]`),target);
  assert.ok(prompt.includes(`„${n.stamp}:“`),target);
  assert.ok(prompt.includes(`[${n.illegibleInOriginal}]`),target);
  assert.doesNotMatch(prompt,/\[Unterschrift|„Stempel:“|Im Original unleserlich|Staatswappen Syriens|Blauer ovaler Stempel|Arabischer Buchstabe/,target);
 }
});

test('model questions follow the interface language',()=>{
 assert.match(translationInstructions('Deutsch','Arabisch','Englisch'),/Fragen in englischer Sprache \(Sprache der Benutzeroberfläche\)/);
 assert.match(translationInstructions('Englisch','Arabisch','Arabisch'),/Fragen in arabischer Sprache \(Sprache der Benutzeroberfläche\)/);
 assert.match(translationInstructions('Englisch','Arabisch','unknown'),/Fragen in deutscher Sprache/);
});

test('normalization writes signature, handwriting, stamp and photo notes in the target language',()=>{
 const input='[Stempel: Fictional registry]\n\n[Unterschrift vorhanden]\n[Signature: illegible]\n[Handschriftlicher Zusatz: 12]\n[Handwritten: 13]\npassport photo';
 assert.equal(normalizeTranslation(input,'Deutsch'),'Stempel:\nFictional registry\n\n[Unterschrift: unleserlich]\n[Unterschrift: unleserlich]\n[Handschriftlich: 12]\n[Handschriftlich: 13]\n[Lichtbild]');
 assert.equal(normalizeTranslation(input,'Englisch'),'Stamp:\nFictional registry\n\n[Signature: illegible]\n[Signature: illegible]\n[Handwritten: 12]\n[Handwritten: 13]\n[Photo]');
 assert.equal(normalizeTranslation(input,'Arabisch'),'ختم:\nFictional registry\n\n[توقيع: غير مقروء]\n[توقيع: غير مقروء]\n[بخط اليد: 12]\n[بخط اليد: 13]\n[صورة شخصية]');
 for(const target of targets){const n=TARGET_NOTATIONS[target],output=normalizeTranslation(input,target);assert.ok(output.startsWith(`${n.stamp}:\n`),target);assert.ok(output.includes(`[${n.signature}: ${n.illegible}]`),target);assert.ok(output.includes(`[${n.photo}]`),target);}
 assert.equal(normalizeTranslation('Name | [Signature: illegible]','Englisch'),'Name | [Signature: illegible]');
});

test('an illegible marker in any target language asks for clarification',()=>{
 for(const target of targets)assert.equal(finalTextQuestions(`Name | [${TARGET_NOTATIONS[target].illegible}]`,target).length,1,target);
});

test('signature and handwriting regions follow the target language',()=>{
 const regions=[{label:'Signature',kind:'signature',source:'scribble',translated:'[Unterschrift: unleserlich]'},{label:'Signed',kind:'signature',source:'A. Example',translated:'[Signature: A. Example]'},{label:'Note',kind:'handwriting',source:'12',translated:'[Handschriftlich: 12]'}];
 assert.deepEqual(specialRegions(regions).map(r=>r.translated),['[Unterschrift: unleserlich]','[Unterschrift: A. Example]','[Handschriftlich: 12]']);
 assert.deepEqual(specialRegions(regions,[],'Englisch').map(r=>r.translated),['[Signature: illegible]','[Signature: A. Example]','[Handwritten: 12]']);
 assert.deepEqual(specialRegions(regions,[],'Französisch').map(r=>r.translated),['[Signature: illisible]','[Signature: A. Example]','[Mention manuscrite: 12]']);
});

test('document model accepts target-language stamp markers and unreadable handwriting',()=>{
 for(const target of targets){
  const n=TARGET_NOTATIONS[target],document=createDocumentModel({language:target,blocks:[{id:'stamp',type:'stamp',content:'Fictional office',properties:{marker:`${n.stamp}:`}},{id:'note',type:'paragraph',content:unreadableHandwriting(target),properties:{role:'handwriting',handwritingState:'unreadable'}}]});
  assert.doesNotThrow(()=>assertDocumentClarified(document),target);
  assert.equal(documentToLegacyText(document).split('\n')[0],`${n.stamp}:`,target);
  assert.equal(documentFromLegacyText(`${n.stamp}:\nFictional office`,{language:target}).blocks[0].type,'stamp',target);
 }
 const unmarked=createDocumentModel({language:'Englisch',blocks:[{id:'stamp',type:'stamp',content:'Fictional office',properties:{}}]});
 assert.equal(documentToLegacyText(unmarked).split('\n')[0],'Stamp:');
});

test('editor writes the same unreadable handwriting note as the server',async()=>{
 const editor=await readFile(new URL('../dist/document-editor.js',import.meta.url),'utf8'),map=Function(`return {${editor.match(/const HANDWRITING_UNREADABLE=\{([^}]*)\}/)[1]}};`)();
 for(const target of targets)assert.equal(map[target],unreadableHandwriting(target),target);
});

test('document titles use the target language',()=>{
 assert.equal(translationTitle({targetLanguage:'Englisch',sourceLanguage:'Arabisch'}),'Certified translation from Arabic into English');
 assert.equal(translationTitle({targetLanguage:'Deutsch',sourceLanguage:'Arabisch'}),'Beglaubigte Übersetzung aus der arabischen Sprache ins Deutsche');
 assert.equal(translationTitle({targetLanguage:'Französisch',sourceLanguage:'Arabisch'}),'Traduction certifiée de l’arabe vers le français');
 assert.equal(translationTitle({targetLanguage:'Arabisch',sourceLanguage:'Ukrainisch'}),'ترجمة مصدّقة من الأوكرانية إلى العربية');
 for(const target of targets.filter(target=>target!=='Deutsch'))assert.doesNotMatch(translationTitle({targetLanguage:target,sourceLanguage:'Englisch'}),/Beglaubigte|Übersetzung/,target);
 assert.equal(translationHeaderLines({targetLanguage:'Englisch',sourceLanguage:'Arabisch'})[0].language,'en');
});

async function availablePort(){const server=createNetServer();await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));const {port}=server.address();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));return port;}

test('the translation request asks questions in the saved interface language',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-question-language-')),workspace=await new Workspace(directory).init(),port=await availablePort(),origin=`http://127.0.0.1:${port}`,instructions=[];
 const provider={id:'openai',selected:'openai',status:()=>({connected:true,planEnabled:true}),models:async()=>[{id:'fictional-model'}],respond:async(request,signal,progress,onUsage)=>{onUsage({inputTokens:1,outputTokens:1},{complete:true});if(request.instructions.startsWith('Lies ausschließlich'))return JSON.stringify({documentType:'Fictional certificate',fields:[],uncertainRegions:[]});instructions.push(request.instructions);return JSON.stringify({status:'ready',sourceLanguage:'Englisch',documentType:'Fictional certificate',questions:[],text:'Name | Alex Example',fields:[],regions:[]});}};
 const server=createApp({connection:{data:{},status:()=>({connected:true,planEnabled:true})},workspace,provider,port});await new Promise((resolve,reject)=>server.once('error',reject).listen(port,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await workspace.tail;await rm(directory,{recursive:true,force:true});});
 const page=await fetch(origin),cookie=page.headers.get('set-cookie').split(';')[0],session=await fetch(origin+'/api/session',{headers:{cookie}}).then(response=>response.json());
 const post=(path,data)=>fetch(origin+path,{method:'POST',headers:{cookie,origin,'content-type':'application/json','x-foliquo-csrf':session.csrf},body:JSON.stringify(data)});
 const file={name:'fictional-source.txt',type:'text/plain',data:Buffer.from('Fictional source document. Name: Alex Example.').toString('base64')};
 for(const [locale,expected] of [['ar',/Fragen in arabischer Sprache/],['de',/Fragen in deutscher Sprache/],['en',/Fragen in englischer Sprache/]]){
  assert.equal((await post('/api/preferences',{...session.preferences,locale,introComplete:true})).status,200);
  const response=await post('/api/translate',{provider:'openai',model:'fictional-model',files:[file],metadata:{targetLanguage:'Englisch'}});assert.equal(response.status,200,await response.clone().text());
  assert.match(instructions.at(-1),expected,locale);
  assert.match(instructions.at(-1),/\[Signature: illegible\]/);
 }
});
