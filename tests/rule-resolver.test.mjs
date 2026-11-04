import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeRuleLibrary,proposeRule,reviewRuleProposal} from '../lib/personal-rules.mjs';
import {createRuleSnapshot,resolveRuleSnapshot,resolvePersonalRules} from '../lib/rule-resolver.mjs';

function add(data,{scope={},value=1.5,key='lineHeight',...rest}={}){
 const proposal=proposeRule(data,{definition:{title:'Fictional layout',effect:{kind:'layout',key,value},scope,origins:[{kind:'manual',id:'fictional-input'}],...rest}});
 return reviewRuleProposal(data,proposal.id,{version:1,accept:true}).rule;
}
const meta={sourceLanguage:'English',targetLanguage:'Deutsch',documentType:'Geburtsurkunde'};
test('specific scope overrides global values while unrelated overlapping scopes require a decision',()=>{
 const data=initializeRuleLibrary({}),global=add(data),specific=add(data,{scope:{targetLanguage:'Deutsch'},value:1.2});
 let result=resolvePersonalRules(data.personalRules,meta);assert.equal(result.layoutPatch.lineHeight,1.2);assert.equal(result.decisions.find(d=>d.id===global.id).state,'overridden');assert.equal(result.appliedRules[0].id,specific.id);
 const other=add(data,{scope:{documentType:'birth-certificate'},value:1.8});result=resolvePersonalRules(data.personalRules,meta);
 assert.equal(result.layoutPatch.lineHeight,undefined);assert.equal(result.conflicts.length,1);assert.deepEqual(new Set(result.conflicts[0].choices.map(c=>c.id)),new Set([specific.id,other.id]));
});
test('unknown scope, mismatch, per-job exclusion and explicit override have distinct outcomes',()=>{
 const data=initializeRuleLibrary({}),source=add(data,{scope:{sourceLanguage:'English'}}),doc=add(data,{scope:{documentType:'Geburtsurkunde'},key:'margin',value:20});
 let result=resolvePersonalRules(data.personalRules,{targetLanguage:'Deutsch'});assert.equal(result.pending,true);assert.equal(result.appliedRules.length,0);
 result=resolvePersonalRules(data.personalRules,{...meta,sourceLanguage:'Arabisch'},{excludedRuleIds:[doc.id]});assert.equal(result.decisions.find(d=>d.id===source.id).state,'not_matching');assert.equal(result.decisions.find(d=>d.id===doc.id).state,'excluded');
 result=resolvePersonalRules(data.personalRules,meta,{layoutOverrides:{lineHeight:'1,1'}});assert.equal(result.layoutPatch.lineHeight,1.1);assert.equal(result.decisions.find(d=>d.id===source.id).reason,'job_override');
 assert.throws(()=>resolvePersonalRules(data.personalRules,meta,{layoutOverrides:{fontSize:10}}));
});
test('profile controls only dependent sample rules and snapshots retain rule versions and activation decisions',()=>{
 const data=initializeRuleLibrary({learning:[{id:'fictional-sample',active:true,status:'active',documentType:'Geburtsurkunde',targetLanguage:'Deutsch'}]});
 const sample=add(data,{profileIds:['fictional-sample'],independent:false,origins:[{kind:'sample',id:'fictional-sample',version:1,method:'observed'}]});
 const independent=add(data,{key:'margin',value:22});const snapshot=createRuleSnapshot(data);
 let result=resolveRuleSnapshot(snapshot,{...meta,useLearning:false});assert.equal(result.decisions.find(d=>d.id===sample.id).state,'profile_inactive');assert.equal(result.decisions.find(d=>d.id===independent.id).state,'effective');
 data.learning[0].active=false;data.personalRules[0].status='inactive';data.personalRules[0].version++;data.personalRules[1].effect.value=30;
 result=resolveRuleSnapshot(snapshot,meta);assert.equal(result.layoutPatch.lineHeight,1.5);assert.equal(result.layoutPatch.margin,22);assert.equal(result.appliedRules.find(r=>r.id===sample.id).version,1);
 const fresh=resolveRuleSnapshot(createRuleSnapshot(data),meta);assert.equal(fresh.layoutPatch.lineHeight,undefined);assert.equal(fresh.layoutPatch.margin,30);
});
test('origins do not create priority and same-value rules on incomparable scopes need no conflict',()=>{
 const data=initializeRuleLibrary({});add(data,{scope:{targetLanguage:'Deutsch'},origins:[{kind:'chat',id:'fictional-message'}]});add(data,{scope:{documentType:'Geburtsurkunde'},origins:[{kind:'sample',id:'fictional-sample',version:1}],independent:true});
 const result=resolvePersonalRules(data.personalRules,meta);assert.equal(result.conflicts.length,0);assert.equal(result.appliedRules.length,2);assert.deepEqual(result.layoutPatch,{lineHeight:1.5});
});
