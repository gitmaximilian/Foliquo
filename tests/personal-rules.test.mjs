import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCipheriv,randomBytes} from 'node:crypto';
import {Readable} from 'node:stream';
import {Workspace,WORKSPACE_SCHEMA} from '../lib/workspace.mjs';
import {validateWorkspaceData} from '../lib/workspace-schema.mjs';
import {initializeRuleLibrary,normalizeRuleDefinition,proposeRule,reviewRuleProposal,ruleFingerprint,validateRuleLibrary} from '../lib/personal-rules.mjs';

const definition=(extra={})=>({title:'Fictional spacing preference',effect:{kind:'layout',key:'lineHeight',value:'1,5'},scope:{targetLanguage:'Deutsch'},origins:[{kind:'manual',id:'fictional-manual-input'}],...extra});
function library(){return initializeRuleLibrary({});}
function approve(data,input=definition()){
 const proposal=proposeRule(data,{definition:input});
 return reviewRuleProposal(data,proposal.id,{version:proposal.version,accept:true});
}
test('typed rules normalize scope and spacing without permitting fixed product invariants or extra executable fields',()=>{
 const rule=normalizeRuleDefinition(definition());assert.equal(rule.effect.value,1.5);assert.equal(rule.scope.targetLanguage,'de');
 assert.equal(ruleFingerprint(rule),ruleFingerprint(normalizeRuleDefinition(definition({scope:{targetLanguage:'German'},effect:{kind:'layout',key:'lineHeight',value:1.5}}))));
 for(const effect of [{kind:'layout',key:'font',value:'Arial'},{kind:'layout',key:'includeOriginals',value:false},{kind:'layout',key:'lineHeight',value:0},{kind:'layout',key:'lineHeight',value:'1,5pt'},{kind:'layout',key:'__proto__',value:1},{kind:'style',text:'Fictional style',command:'execute'}])assert.throws(()=>normalizeRuleDefinition(definition({effect})),{code:'ERR_RULE_VALIDATION'});
});
test('proposal approval is explicit, version checked and idempotent; repeated evidence cannot reactivate rules',()=>{
 const data=library(),proposal=proposeRule(data,{definition:definition()});assert.equal(data.personalRules.length,0);
 assert.throws(()=>reviewRuleProposal(data,proposal.id,{version:1}),{code:'ERR_RULE_VALIDATION'});
 assert.throws(()=>reviewRuleProposal(data,proposal.id,{version:2,accept:true}),{code:'ERR_RULE_STALE'});
 const first=reviewRuleProposal(data,proposal.id,{version:1,accept:true});
 assert.equal(reviewRuleProposal(data,proposal.id,{version:1,accept:true}).replayed,true);assert.equal(data.personalRules.length,1);
 const disable=proposeRule(data,{operation:'disable',targetId:first.rule.id,targetVersion:1});reviewRuleProposal(data,disable.id,{version:1,accept:true});
 const duplicate=approve(data,definition({origins:[{kind:'sample',id:'fictional-sample',version:1,pages:[2],method:'observed'}]}));
 assert.equal(data.personalRules.length,1);assert.equal(duplicate.rule.id,first.rule.id);assert.equal(duplicate.rule.status,'inactive');assert.equal(duplicate.rule.origins.length,2);
 assert.equal(validateRuleLibrary(data),data);
});
test('stale replacement and rejected drafts cannot change the rule library',()=>{
 const data=library(),first=approve(data).rule;
 const replace=proposeRule(data,{operation:'replace',targetId:first.id,targetVersion:first.version,definition:definition({effect:{kind:'layout',key:'lineHeight',value:1.2}})});
 const disable=proposeRule(data,{operation:'disable',targetId:first.id,targetVersion:first.version});reviewRuleProposal(data,disable.id,{version:1,accept:true});
 const before=structuredClone(data);assert.throws(()=>reviewRuleProposal(data,replace.id,{version:1,accept:true}),{code:'ERR_RULE_STALE'});assert.deepEqual(data,before);
 reviewRuleProposal(data,replace.id,{version:1,accept:false});assert.throws(()=>reviewRuleProposal(data,replace.id,{version:1,accept:true}),{code:'ERR_RULE_STALE'});assert.equal(data.personalRules[0].effect.value,1.5);
});
test('oversized or malformed libraries are rejected before mutation',()=>{
 const data=library(),before=structuredClone(data);
 assert.throws(()=>proposeRule(data,{definition:definition({scope:{script:'arbitrary'}})}),{code:'ERR_RULE_VALIDATION'});assert.deepEqual(data,before);
 assert.throws(()=>validateWorkspaceData({schema:5,personalRules:[{id:'invalid'}]}),{code:'ERR_RULE_VALIDATION'});
 assert.throws(()=>validateRuleLibrary({personalRules:Array(1001).fill({})}),{code:'ERR_RULE_VALIDATION'});
});
test('schema-4 migration, restart and encrypted backup retain approved rules and existing learning without touching the key',async t=>{
 const root=await mkdtemp(join(tmpdir(),'foliquo-fictional-rules-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const directory=join(root,'original'),workspace=await new Workspace(directory).init();
 const profile={id:'fictional-profile',name:'Fictional sample',version:2,status:'active',active:true,rules:['Keep fictional headings concise.'],analysis:{profileVersion:2,approvedAt:1,observations:[{id:'fictional-observation',text:'Fictional rejected observation',approved:false}]}};
 workspace.data.learning=[profile];await workspace.save();const key=await readFile(join(directory,'workspace.key'));
 const old=structuredClone(workspace.data);old.schema=4;delete old.personalRules;delete old.ruleProposals;delete old.ruleLibraryVersion;
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),bytes=Buffer.concat([Buffer.from('TOCR1'),iv,cipher.update(JSON.stringify(old)),cipher.final(),cipher.getAuthTag()]);await writeFile(join(directory,'workspace.enc'),bytes);
 const migrated=await new Workspace(directory).init();assert.equal(migrated.data.schema,WORKSPACE_SCHEMA);assert.deepEqual(migrated.data.learning,[profile]);assert.deepEqual(migrated.data.personalRules,[]);
 const backupName=(await readdir(directory)).find(name=>name.startsWith(`workspace.enc.pre-schema-${WORKSPACE_SCHEMA}-`));assert.ok(backupName);assert.deepEqual(await readFile(join(directory,backupName)),bytes);
 const result=approve(migrated.data);await migrated.save();
 const reopened=await new Workspace(directory).init();assert.deepEqual(reopened.data.personalRules,[result.rule]);assert.deepEqual(await readFile(join(directory,'workspace.key')),key);
 const encrypted=await readFile(join(directory,'workspace.enc'));assert.equal(encrypted.includes(Buffer.from(result.rule.title)),false);
 const target=await new Workspace(join(root,'restored')).init();target.restore(reopened.backup('fictional-backup-password'),'fictional-backup-password');await target.save();
 const restored=await new Workspace(target.directory).init();assert.deepEqual(restored.data.personalRules,reopened.data.personalRules);assert.deepEqual(restored.data.ruleProposals,reopened.data.ruleProposals);assert.deepEqual(restored.data.learning,[profile]);
 const chunks=[];for await(const chunk of reopened.backupStream('fictional-stream-password'))chunks.push(chunk);
 const streamed=await new Workspace(join(root,'stream-restored')).init();await streamed.restoreStream(Readable.from(chunks),'fictional-stream-password');await streamed.save();
 const streamReload=await new Workspace(streamed.directory).init();assert.deepEqual(streamReload.data.personalRules,reopened.data.personalRules);assert.deepEqual(streamReload.data.learning,[profile]);
 const committed=await readFile(join(directory,'workspace.enc'));
 reopened.data.personalRules[0].effect.value=0;assert.throws(()=>reopened.save(),{code:'ERR_RULE_VALIDATION'});assert.deepEqual(await readFile(join(directory,'workspace.enc')),committed);
 reopened.data.personalRules[0].effect.value=1.2;reopened.writeMetadata=async()=>{throw Object.assign(new Error('Fictional disk full'),{code:'ENOSPC'});};await assert.rejects(()=>reopened.save(),{code:'ENOSPC'});
 assert.deepEqual(await readFile(join(directory,'workspace.enc')),committed);assert.deepEqual((await new Workspace(directory).init()).data.personalRules,[result.rule]);
});
