import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {reviewState} from '../lib/reviews.mjs';
import {lockFields} from '../lib/protection.mjs';
import {proposeRevision,acceptRevision} from '../lib/revisions.mjs';

function job(){
 const field={id:'name',kind:'name',label:'Name',source:'Alex',translated:'Alex Example',fileIndex:0,page:1};
 const value={id:'fictional',status:'succeeded',targetLanguage:'Deutsch',result:{text:'Name | Alex Example\nOrt | Beispielstadt',fields:[field],checks:[{id:'name',confirmed:true}],context:{}}};
 lockFields(value,{version:1,ids:['name']},reviewState(value));
 proposeRevision(value,{...value.result,text:'Name | Omar Example\nOrt | Beispielstadt',fields:[{...field,translated:'Omar Example'}]});
 return value;
}
const rebuild=async(text,base)=>({...base,text});

test('a requested change that touches a protected value is applied when the inline proposal is accepted',async()=>{
 const value=job(),r=reviewState(value),accepted=r.proposal.changes.filter(change=>change.id).map(change=>change.id);
 await assert.rejects(acceptRevision(value,{action:'accept',version:1,accepted},rebuild),/Geschützte Angaben/);
 await acceptRevision(value,{action:'accept',version:1,accepted,confirmProposalFields:true},rebuild);
 assert.equal(r.version,2);assert.equal(r.proposal,null);
 assert.match(value.result.text,/Name \| Omar Example/);
 assert.equal(value.protectedFields.find(field=>field.id==='name')?.value,'Omar Example');
});

test('the confirmation does not apply to restoring an older version or to rejected passages',async()=>{
 const value=job(),r=reviewState(value);
 await acceptRevision(value,{action:'accept',version:1,accepted:[],confirmProposalFields:true},rebuild);
 assert.match(value.result.text,/Name \| Alex Example/);assert.equal(r.version,2);
});

test('the review page shows the proposal inline with one decision and no detour through the tools dialog',async()=>{
 const [html,module,dialogs,guide]=await Promise.all(['dist/index.html','dist/review-proposal.js','dist/workspace-dialogs.js','dist/review-guide.js'].map(path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')));
 assert.match(html,/<section id="review-proposal-inline"[^>]*hidden/);
 assert.match(html,/id="review-send" type="submit">Änderung vorschlagen →</);
 assert.match(module,/confirmProposalFields:true/);
 assert.doesNotMatch(dialogs,/'review-proposal-open'/);
 assert.doesNotMatch(guide,/tools\('#revision-changes'\)/);
});
