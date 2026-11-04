import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeRuleLibrary,proposeRule,reviewRuleProposal} from '../lib/personal-rules.mjs';
import {createRuleApplicationPreview,resolveRuleApplicationPreview,ruleApplicationPreviewDTO,stageRuleLayoutApplication} from '../lib/rule-application.mjs';

function setup(){const data=initializeRuleLibrary({glossary:[],learning:[]});for(const value of [1.5,1.2]){const proposal=proposeRule(data,{definition:{title:`Fictional spacing ${value}`,effect:{kind:'layout',key:'lineHeight',value},scope:{},origins:[{kind:'manual',id:'fictional'}]}});reviewRuleProposal(data,proposal.id,{version:1,accept:true});}return {workspace:{data,context:()=>null},job:{id:'fictional-job',owner:'fictional-owner',status:'succeeded',targetLanguage:'Deutsch',result:{text:'Fictional translation',detected:{sourceLanguage:'English',documentType:'Certificate'},context:{layout:{lineHeight:1},personalStyleRules:[],personalFieldOrder:[],terms:[]},pdf:'old-pdf',word:'old-word'}}};}
test('new-rule application resolves a frozen conflict explicitly and never changes the existing result while staging',async()=>{
 const {workspace,job}=setup(),preview=createRuleApplicationPreview(workspace,job,1),checked=resolveRuleApplicationPreview(job,{version:1,previewId:preview.id},()=>[]);assert.equal(checked.questions.length,1);assert.equal(job.result.context.layout.lineHeight,1);
 assert.throws(()=>resolveRuleApplicationPreview(job,{version:1,previewId:preview.id,answers:[{context:'unbound',answer:'1'}]},()=>[]));
 workspace.data.personalRules[1].effect.value=1.9;const resolved=resolveRuleApplicationPreview(job,{version:1,previewId:preview.id,answers:[{context:checked.questions[0].context,answer:'2'}]},()=>[]);assert.equal(resolved.questions.length,0);assert.equal(resolved.payload.contextSnapshot.layout.lineHeight,1.2);assert.equal(ruleApplicationPreviewDTO(job,resolved).requiresProvider,false);
 await stageRuleLayoutApplication(job,resolved.payload.contextSnapshot,async(text,base)=>({...base,pdf:'new-pdf',word:'new-word'}),{version:1,requestId:'fictional-request'});assert.equal(job.result.word,'old-word');assert.equal(job.review.proposal.result.context.layout.lineHeight,1.2);assert.equal(job.review.versions[0].context.layout.lineHeight,1);assert.equal(job.review.rulePreview,undefined);
});
test('failed local exports and stale previews cannot create a revision or mutate the current result',async()=>{
 const {workspace,job}=setup(),preview=createRuleApplicationPreview(workspace,job,1);assert.throws(()=>resolveRuleApplicationPreview(job,{version:2,previewId:preview.id},()=>[]));const original=structuredClone(job.result);
 await assert.rejects(stageRuleLayoutApplication(job,{layout:{lineHeight:1.5}},async()=>{throw new Error('Fictional export failure');},{version:1,requestId:'fictional-request'}));assert.deepEqual(job.result,original);assert.equal(job.review.proposal,undefined);assert.equal(job.review.busy,false);
});
test('reapplication retains pinned template defaults and can resolve rules after the template was removed',()=>{
 const {workspace,job}=setup();workspace.data.templates=[];workspace.context=()=>({layout:{margin:35},template:null,profile:null,terms:[],examples:[]});job.result.context={...job.result.context,templateId:'removed-fictional-template',template:{id:'removed-fictional-template',version:1,fields:[]},baseLayout:{margin:22,lineHeight:1.1}};
 const preview=createRuleApplicationPreview(workspace,job,1);assert.deepEqual(preview.payload.contextLibrarySnapshot.base.layout,{margin:22,lineHeight:1.1});assert.equal(preview.payload.contextLibrarySnapshot.base.template.version,1);assert.equal(job.result.context.layout.lineHeight,1);
});
