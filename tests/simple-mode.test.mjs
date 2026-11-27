import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {limitQuestions,automaticAnswer,resolvedAsUnreadable,SIMPLE_QUESTION_LIMIT} from '../lib/studio.mjs';

const question=(id,kind,extra={})=>({id,kind,question:`Fictional question ${id}`,context:`Fictional context ${id}`,fileIndex:0,page:1,box:null,...extra});

test('Simple mode asks at most three questions and decides the rest without guessing',()=>{
 const questions=[question('n1','name',{suggestion:'Ali Hasan'}),question('n2','name'),question('u1','unreadable'),question('m1',undefined),question('u2','unreadable')];
 const meta={clarifications:[]},kept=limitQuestions(questions,meta,{mode:'simple'});
 assert.equal(SIMPLE_QUESTION_LIMIT,3);
 assert.deepEqual(kept.map(item=>item.id),['u1','m1','u2']);
 assert.deepEqual(meta.clarifications.map(item=>item.questionId),['n1','n2']);
 assert.ok(meta.clarifications.every(item=>item.automatic===true&&item.unreadable===undefined));
 assert.match(meta.clarifications[0].answer,/„Ali Hasan“/);
 assert.match(meta.clarifications[1].answer,/Transliteration/);
});

test('Professional mode keeps every question, and answered questions use up the simple budget',()=>{
 const questions=[question('u1','unreadable'),question('u2','unreadable')];
 const pro={clarifications:[]};assert.equal(limitQuestions(questions,pro,{mode:'pro'}).length,2);assert.equal(pro.clarifications.length,0);
 const later={clarifications:[{questionId:'a'},{questionId:'b'},{questionId:'c'},{questionId:'x',automatic:true}]};
 assert.equal(limitQuestions(questions,later,{mode:'simple'}).length,0);
 assert.ok(questions.every(item=>resolvedAsUnreadable(item,later.clarifications)),'unclear places are marked, not guessed');
});

test('Automatic answers for unclear places request an illegible note',()=>{
 const answer=automaticAnswer(question('u1','unreadable'));
 assert.equal(answer.unreadable,true);assert.equal(answer.automatic,true);assert.match(answer.answer,/Unleserlich-Vermerk/);
});

test('Simple and professional navigation is declared in the page and the mode script is served',async()=>{
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 for(const section of ['style','rules','terms','dossiers'])assert.match(html,new RegExp(`data-section="${section}"`));
 assert.match(html,/id="ui-mode-pro"/);assert.match(html,/ui-mode\.js/);assert.match(html,/my-style\.js/);assert.match(html,/remember-spelling\.js/);assert.match(html,/modern\.css/);assert.match(html,/layout-refresh\.js/);
 const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 for(const asset of ['ui-mode.js','my-style.js','remember-spelling.js','layout-refresh.js','modern.css'])assert.match(server,new RegExp(`'/${asset.replace('.','\\.')}':'${asset.replace('.','\\.')}'`));
 const css=await readFile(new URL('../dist/modern.css',import.meta.url),'utf8');
 assert.match(css,/html\[data-ui-mode=simple\] \[data-pro-only\]\{display:none!important\}/);
});
