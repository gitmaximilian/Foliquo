import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedSampleDefinitions,synchronizeSampleRules} from '../lib/sample-rules.mjs';
import {initializeRuleLibrary} from '../lib/personal-rules.mjs';
import {createRuleSnapshot,resolveRuleSnapshot} from '../lib/rule-resolver.mjs';
import {selectGlossary} from '../lib/glossary.mjs';

const sample=(id='fictional-sample')=>({id,name:'Fictional birth sample',status:'active',active:true,version:2,documentType:'Geburtsurkunde',targetLanguage:'Deutsch',rules:['Keep headings concise.'],fieldLabels:['Name','Date'],layoutApproved:true,layout:{lineHeight:1.5,font:'Aptos',fontSize:11,privateNote:'PRIVATE SOURCE'},sources:[{data:'PRIVATE SOURCE'}],analysis:{profileVersion:2,approvedAt:100,sourceLanguage:'Englisch',observations:[{id:'fictional-approved',text:'Use neutral wording.',approved:true,pages:[1],certainty:'observed'},{id:'fictional-rejected',text:'Rejected observation.',approved:false}],terminology:[{id:'fictional-term',source:'birth register',target:'Geburtenregister',approved:true,pages:[1]},{id:'fictional-rejected-term',source:'rejected',target:'abgelehnt',approved:false}]}});
test('approved sample conversion retains scope and evidence but not private sources or rejected observations',()=>{
 const entry=sample(),definitions=approvedSampleDefinitions(entry);
 assert.equal(definitions.length,4);assert.doesNotMatch(JSON.stringify(definitions),/PRIVATE SOURCE|Rejected observation/);
 assert.deepEqual(definitions[0].scope,{sourceLanguage:'en',targetLanguage:'de',documentType:'birth-certificate'});
 assert.equal(definitions.find(d=>d.effect.text==='Use neutral wording.').origins[0].method,'observed');
 assert.equal(definitions.find(d=>d.effect.kind==='layout').effect.value,1.5);
 assert.deepEqual(approvedSampleDefinitions({...entry,status:'pending_review',active:false}),[]);
});
test('migration merges duplicate evidence, is idempotent and never reactivates disabled or rejected rules',()=>{
 const data=initializeRuleLibrary({learning:[sample('sample-a'),sample('sample-b')],glossary:[]});
 const initial=synchronizeSampleRules(data,{now:1000});assert.equal(initial.changed,true);assert.equal(data.personalRules.length,5);assert.equal(data.glossary.length,1);
 const before=structuredClone(data);assert.equal(synchronizeSampleRules(data,{now:2000}).changed,false);assert.deepEqual(data,before);
 const metadata={sourceLanguage:'Englisch',targetLanguage:'Deutsch',documentType:'Geburtsurkunde'};
 assert.equal(selectGlossary(data.glossary,metadata).terms.length,0,'sample terms must not bypass rule activation');
 assert.equal(selectGlossary(data.glossary,{...metadata,ruleGlossaryIds:[data.glossary[0].id]}).terms.length,1);
 data.personalRules[0].status='inactive';const id=data.personalRules[0].id;
 data.learning[0].analysis.profileVersion++;synchronizeSampleRules(data,{now:3000});assert.equal(data.personalRules.find(r=>r.id===id).status,'inactive');
 data.learning[0].rules=[];data.learning[1].rules=[];synchronizeSampleRules(data,{now:4000});assert.deepEqual(data.personalRules.find(r=>r.id===id).profileIds,[]);
});
test('profile deactivation and removal affect dependent rules without changing frozen job context',()=>{
 const data=initializeRuleLibrary({learning:[sample()],glossary:[]});synchronizeSampleRules(data,{now:1000});
 const meta={documentType:'birth-certificate',sourceLanguage:'English',targetLanguage:'German'},snapshot=createRuleSnapshot(data);
 assert.equal(resolveRuleSnapshot(snapshot,meta).layoutPatch.lineHeight,1.5);
 data.learning[0].active=false;assert.equal(resolveRuleSnapshot(createRuleSnapshot(data),meta).appliedRules.length,0);
 data.learning=[];assert.equal(resolveRuleSnapshot(createRuleSnapshot(data),meta).appliedRules.length,0);
 assert.equal(resolveRuleSnapshot(snapshot,meta).layoutPatch.lineHeight,1.5);
});
test('pending profile edits preserve the prior approval and legacy effective profiles remain marked for review',()=>{
 const entry=sample();entry.pendingEdit={rules:entry.rules,fieldLabels:entry.fieldLabels,layout:entry.layout,layoutApproved:true,documentType:entry.documentType,targetLanguage:entry.targetLanguage,analysis:{...entry.analysis}};entry.status='pending_review';entry.active=false;entry.rules=['Not yet approved.'];
 const data=initializeRuleLibrary({learning:[entry],glossary:[]});synchronizeSampleRules(data,{now:1000});assert.equal(data.personalRules.some(r=>r.effect.text==='Not yet approved.'),false);assert.equal(data.personalRules.some(r=>r.effect.text==='Keep headings concise.'),true);
 const legacy=sample('legacy');delete legacy.status;delete legacy.analysis;legacy.rules=['Legacy effective wording.'];
 const old=initializeRuleLibrary({learning:[legacy],glossary:[]});synchronizeSampleRules(old,{now:1000});assert.equal(old.personalRules[0].approvalMode,'legacy-effective');assert.equal(old.personalRules[0].approvedAt,0);
});
