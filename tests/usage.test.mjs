import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {estimateRequestCost,mergeUsageRequest,newUsageRequest,pruneUsage,usageSummary} from '../lib/usage.mjs';

test('provider-reported usage is tallied once and priced from the dated model table',()=>{
 const now=Date.UTC(2026,9,29),entries=[newUsageRequest({provider:'openai',model:'gpt-6.1-sol',operation:'translation',jobId:'job-a'},now)];
 mergeUsageRequest(entries,entries[0].id,{inputTokens:120,outputTokens:30,cachedInputTokens:20,reasoningTokens:10},{complete:true,responseId:'resp_123'},now+1000);
 const summary=usageSummary(entries,{days:30,now:now+2000,timeZone:'Europe/Vienna'});
 assert.equal(summary.totals.requests,1);assert.equal(summary.totals.completeRequests,1);assert.equal(summary.totals.inputTokens,120);assert.equal(summary.totals.outputTokens,30);assert.equal(summary.totals.totalTokens,150);assert.equal(summary.totals.unknownRequests,0);assert.equal(summary.totals.estimatedCostUSDLow,0.000502);assert.equal(summary.totals.estimatedCostUSDHigh,0.000552);assert.equal(summary.operationsByProvider[0].operation,'translation');assert.equal(summary.daily.length,1);assert.match(summary.daily[0].date,/2026/);assert.equal(summary.timeZone,'Europe/Vienna');
});

test('API pricing keeps cache-write and long-context uncertainty visible',()=>{
 const now=Date.UTC(2026,9,29),entries=[newUsageRequest({provider:'openai',model:'gpt-6.1-sol',operation:'translation'},now),newUsageRequest({provider:'openai',model:'gpt-6.1-sol',operation:'translation'},now+1),newUsageRequest({provider:'anthropic',model:'claude-sonnet-4-5',operation:'translation'},now+2)];
 mergeUsageRequest(entries,entries[0].id,{inputTokens:200,outputTokens:10,cacheWrite5mTokens:100},{complete:true},now+3);
 mergeUsageRequest(entries,entries[1].id,{inputTokens:300000,outputTokens:10},{complete:true},now+4);
 mergeUsageRequest(entries,entries[2].id,{inputTokens:100,outputTokens:10,cacheWriteTokens:20},{complete:true},now+5);
 assert.ok(entries[0].estimatedCost.high>entries[0].estimatedCost.low);assert.ok(entries[1].estimatedCost.high>entries[1].estimatedCost.low);assert.ok(entries[1].estimatedCost.low>0.004);assert.equal(entries[2].estimatedCost,null);
});

test('OpenAI long-context rates use the verified full-request output multipliers',()=>{
 const now=Date.UTC(2026,9,29),entries=[newUsageRequest({provider:'openai',model:'gpt-6.1-sol',operation:'translation'},now),newUsageRequest({provider:'openai',model:'gpt-6-luna',operation:'translation'},now+1)];
 mergeUsageRequest(entries,entries[0].id,{inputTokens:300000,outputTokens:1000},{complete:true},now+2);
 mergeUsageRequest(entries,entries[1].id,{inputTokens:300000,outputTokens:1000},{complete:true},now+3);
 assert.deepEqual(entries[0].estimatedCost,{low:1.215,high:1.515});assert.deepEqual(entries[1].estimatedCost,{low:.06075,high:.07575});
});

test('preflight estimates text, images, and PDF pages without sending document contents',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage();pdf.addPage();const data=Buffer.from(await pdf.save()).toString('base64');
 const estimate=await estimateRequestCost('openai','gpt-6.1-sol',{input:[{content:[{type:'input_text',text:'x'.repeat(300)},{type:'input_image',image_url:'data:image/png;base64,private'},{type:'input_file',file_data:`data:application/pdf;base64,${data}`}]}]});
 assert.equal(estimate.pages,3);assert.equal(estimate.inputTokens,100+20000+50000);assert.ok(estimate.high>=estimate.low);assert.equal(await estimateRequestCost('openai','unlisted-model',{input:[]}),null);assert.equal(await estimateRequestCost('openai','gpt-6.1-sol',{input:[{content:[{type:'input_file',file_data:'private'}]}]}),null);
});

test('DeepSeek cost is a peak/off-peak estimate; missing or partial usage stays unknown',()=>{
 const now=Date.UTC(2026,9,29),entries=[newUsageRequest({provider:'deepseek',model:'deepseek-flash',operation:'translation'},now),newUsageRequest({provider:'chatgpt',model:'model-a',operation:'learning_analysis'},now+1)];
 mergeUsageRequest(entries,entries[0].id,{inputTokens:1000,outputTokens:200,cachedInputTokens:400},{complete:true},now+2);
 mergeUsageRequest(entries,entries[1].id,{inputTokens:80},{complete:false},now+3);
 const summary=usageSummary(entries,{now:now+10});assert.equal(summary.totals.requests,2);assert.equal(summary.totals.inputTokens,1080);assert.equal(summary.totals.outputTokens,200);assert.equal(summary.totals.unknownRequests,1);assert.equal(summary.totals.tokenTotalsPartial,true);assert.ok(Math.abs(summary.providers.find(x=>x.provider==='deepseek').estimatedCostUSDLow-0.0002112)<1e-12);assert.ok(Math.abs(summary.providers.find(x=>x.provider==='deepseek').estimatedCostUSDHigh-0.0004224)<1e-12);assert.equal(summary.providers.find(x=>x.provider==='chatgpt').estimatedCostUSDHigh,0);assert.equal(summary.operationsByProvider.find(x=>x.provider==='chatgpt').operation,'learning_analysis');
});

test('usage summaries omit arbitrary payload data and retention caps old records',()=>{
 const now=Date.UTC(2026,9,29),entry={...newUsageRequest({provider:'anthropic',model:'claude-sonnet-4-5',operation:'translation'},now),apiKey:'sk-never-return',documentText:'private source'};
 mergeUsageRequest([entry],entry.id,{inputTokens:100,outputTokens:50,cacheWriteTokens:20},{complete:true},now+1);
 assert.equal(entry.estimatedCost,null,'generic cache creation has no safe price estimate');
 const summary=usageSummary([entry],{now:now+2});assert.equal(JSON.stringify(summary).includes('sk-never-return'),false);assert.equal(JSON.stringify(summary).includes('private source'),false);assert.equal(summary.totals.unpricedRequests,1);
 const rows=Array.from({length:5},(_,i)=>newUsageRequest({provider:'chatgpt',model:'m',operation:'translation'},now-i*86400000));assert.equal(pruneUsage(rows,{now,retentionDays:2,maxEntries:1}).length,1);
});

test('usage reservation estimates survive retention normalization and provider response ids deduplicate',()=>{
 const now=Date.UTC(2026,9,29),first=newUsageRequest({provider:'openai',model:'gpt-6.1-sol',operation:'translation',accountScope:'a'.repeat(16)},now),second=newUsageRequest({provider:'openai',model:'gpt-6.1-sol',operation:'translation',accountScope:'a'.repeat(16)},now+1);
 first.preflightCostEstimate={low:.001,high:.002};const entries=pruneUsage([first,second],{now:now+2});assert.deepEqual(entries[0].preflightCostEstimate,{low:.001,high:.002});
 mergeUsageRequest(entries,entries[0].id,{inputTokens:100,outputTokens:30},{complete:true,responseId:'provider-response-1'},now+3);
 mergeUsageRequest(entries,entries[1].id,{inputTokens:100,outputTokens:30},{complete:true,responseId:'provider-response-1'},now+4);
 assert.equal(entries[1].duplicateOf,entries[0].id);const summary=usageSummary(entries,{now:now+5});assert.equal(summary.totals.requests,1);assert.equal(summary.totals.inputTokens,100);assert.equal(summary.records.length,1);
});
