import test from 'node:test';
import assert from 'node:assert/strict';
import {selectLearningLayout,unresolvedLearningLayout,learningLayoutQuestions} from '../lib/learning-layout.mjs';
import {learningContext} from '../lib/learning.mjs';
import {resolveContextSnapshot} from '../lib/context.mjs';
const entries=['first','second'].map((id,index)=>({id,name:`Fictional ${id}`,active:true,status:'active',version:1,documentType:'Passport',targetLanguage:'German',rules:[],layout:{font:'Aptos',fontSize:11,titleAlign:index?'left':'center',margin:40},analysis:{profileVersion:1,sourceLanguage:'English'}}));
test('contradictory approved layouts wait for a deliberate job-specific choice',()=>{
 const selection=selectLearningLayout(entries);assert.equal(selection.layout.titleAlign,undefined);assert.equal(selection.layout.margin,40);assert.equal(selection.layout.font,'Aptos');assert.deepEqual(selection.learningLayoutConflict.keys,['titleAlign']);
 const context={...learningContext(entries,{documentType:'Passport',targetLanguage:'German',sourceLanguage:'English'}),contextVersion:'frozen'},payload={metadata:{clarifications:[]}},questions=learningLayoutQuestions(payload,context);assert.equal(questions.length,1);assert.equal(questions[0].kind,'learning-layout');assert.equal(questions[0].displayContext,'1: Fictional first | 2: Fictional second');payload.metadata.clarifications=[{context:questions[0].context,answer:'not a candidate'}];assert.equal(learningLayoutQuestions(payload,context).length,1);payload.metadata.clarifications=[{context:questions[0].context,answer:'2'}];assert.deepEqual(learningLayoutQuestions(payload,context),[]);assert.equal(context.layout.titleAlign,'left');assert.equal(context.learningLayoutDecision.entryId,'second');assert.equal(context.learningLayoutDecision.profileVersion,1);assert.deepEqual(learningLayoutQuestions(payload,context),[]);assert.equal(entries[0].layout.titleAlign,'center');
});
test('explicit layouts settle matching conflicts and disabled layouts do not participate',()=>{
 const selected=selectLearningLayout(entries);assert.equal(unresolvedLearningLayout(selected.learningLayoutConflict,{titleAlign:'right'}),null);assert.equal(selectLearningLayout(entries.map(entry=>({...entry,layoutApproved:false}))).learningLayoutConflict,undefined);
 const context=resolveContextSnapshot({schema:1,createdAt:1,base:{layout:{titleAlign:'right'},terms:[],examples:[]},learning:entries},{documentType:'Passport',targetLanguage:'German',sourceLanguage:'English'});assert.equal(context.layout.titleAlign,'right');assert.equal(context.learningLayoutConflict,null);
});
