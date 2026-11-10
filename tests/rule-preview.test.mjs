import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {initializeRuleLibrary,proposeRule,reviewRuleProposal} from '../lib/personal-rules.mjs';
import {deriveLayoutPreview,renderLayoutPreview} from '../lib/rule-preview.mjs';

function fixture(effect,extra={}){
 const data=initializeRuleLibrary({glossary:[],learning:[]});
 const proposal=proposeRule(data,{definition:{title:'Fictional layout',effect:{kind:'layout',...effect},scope:{},origins:[{kind:'manual',id:'fictional'}],...extra}});
 return {workspace:{data,context:()=>undefined},input:{kind:'proposal',id:proposal.id,version:proposal.version}};
}
test('all seven layout examples change only their validated property without publishing a rule',()=>{
 for(const [key,value]of Object.entries({lineHeight:1,margin:15,paragraphSpacing:18,tableLabelWidth:65,titleAlign:'right',keepRows:false,pageNumbers:false})){
  const {workspace,input}=fixture({key,value}),saved=JSON.stringify(workspace.data),result=deriveLayoutPreview(workspace,input);
  assert.equal(result.after[key],value);assert.deepEqual({...result.before,[key]:value},result.after);
  assert.equal(result.fictional,true);assert.equal(result.decision.state,'effective');assert.equal(JSON.stringify(workspace.data),saved);
  assert.equal(result.after.font,'Aptos');assert.equal(result.after.fontSize,11);assert.equal(result.after.includeOriginals,true);
 }
});
test('preview uses actual applicability, handles stale drafts and never activates a source',()=>{
 const {workspace,input}=fixture({key:'lineHeight',value:1.5},{independent:false,profileIds:['fictional-source']});
 assert.equal(deriveLayoutPreview(workspace,input).decision.state,'profile_inactive');
 assert.throws(()=>deriveLayoutPreview(workspace,{...input,version:2}),{code:'ERR_RULE_STALE'});
 const {rule}=reviewRuleProposal(workspace.data,input.id,{version:1,accept:true});
 assert.throws(()=>deriveLayoutPreview(workspace,input),{code:'ERR_RULE_STALE'});
 assert.equal(deriveLayoutPreview(workspace,{kind:'rule',id:rule.id,version:rule.version}).decision.state,'profile_inactive');
 assert.deepEqual(workspace.data.learning,[]);
});

test('replacement previews retain the actual current value as their before state',()=>{
 const {workspace,input}=fixture({key:'lineHeight',value:1.2}),{rule}=reviewRuleProposal(workspace.data,input.id,{version:1,accept:true});
 const draft=proposeRule(workspace.data,{operation:'replace',targetId:rule.id,targetVersion:rule.version,definition:{title:rule.title,scope:rule.scope,origins:rule.origins,effect:{kind:'layout',key:'lineHeight',value:1.5}}});
 const result=deriveLayoutPreview(workspace,{kind:'proposal',id:draft.id,version:draft.version});
 assert.equal(result.before.lineHeight,1.2);assert.equal(result.after.lineHeight,1.5);assert.equal(workspace.data.personalRules[0].effect.value,1.2);
});
test('actual Word examples encode 1.0 and 1.5 line spacing in the shared export path',async()=>{
 for(const [value,twips]of [[1,240],[1.5,360]]){
  const {workspace,input}=fixture({key:'lineHeight',value}),result=await renderLayoutPreview(workspace,{...input,format:'docx'});
  const files=unzipSync(Buffer.from(result.documents.after,'base64')),xml=strFromU8(files['word/document.xml']);
  assert.match(xml,new RegExp(`w:line="${twips}"`));assert.match(xml,/FIKTIVES BEISPIEL/);assert.match(xml,/DEMO-12345/);
  assert.equal(workspace.data.personalRules.length,0);
 }
});

test('Word examples expose alignment, row splitting, numbering, margins and table widths',async()=>{
 for(const [key,value,part,pattern]of [
  ['titleAlign','right','word/header1.xml',/w:jc w:val="right"/],
  ['keepRows',true,'word/document.xml',/w:cantSplit/],
  ['pageNumbers',true,'word/footer1.xml',/ PAGE /],
  ['margin',15,'word/document.xml',/w:top="850"/],
  ['tableLabelWidth',65,'word/document.xml',/w:gridCol w:w="5897"/],
  ['paragraphSpacing',18,'word/document.xml',/w:after="360"/]
 ]){
  const {workspace,input}=fixture({key,value}),result=await renderLayoutPreview(workspace,{...input,format:'docx'}),files=unzipSync(Buffer.from(result.documents.after,'base64'));
  assert.ok(files[part],part);assert.match(strFromU8(files[part]),pattern);
  assert.match(strFromU8(files['word/header1.xml']),/FIKTIVES LAYOUTBEISPIEL/);
 }
});
