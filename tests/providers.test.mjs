import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {ProviderManager} from '../lib/providers.mjs';

const responseStream=text=>new Response(`data: ${JSON.stringify({type:'response.output_text.delta',delta:text})}\n\ndata: ${JSON.stringify({type:'response.completed'})}\n\n`);
const anthropicStream=text=>new Response(`event: content_block_delta\ndata: ${JSON.stringify({type:'content_block_delta',delta:{type:'text_delta',text}})}\n\nevent: message_stop\ndata: ${JSON.stringify({type:'message_stop'})}\n\n`);
function setup(fetcher){const workspace={data:{settings:{provider:'chatgpt',apiProviders:{}}}};const connection={status:()=>({connected:true,planEnabled:true}),models:async()=>[{id:'chatgpt-model',name:'ChatGPT model'}],accessToken:async()=> 'temporary'};return {workspace,manager:new ProviderManager(connection,workspace,fetcher)};}

test('provider summaries and public workspace never reveal API keys; OpenAI API uses fixed endpoint and model',async()=>{
 const calls=[];const {workspace,manager}=setup(async(url,options={})=>{calls.push({url:String(url),options});if(String(url).endsWith('/models'))return Response.json({data:[{id:'gpt-6.1-sol'},{id:'gpt-4o'}]});return responseStream('{"status":"ready"}');});
 manager.setKey('openai','sk-test-secret-key-123');assert.equal(JSON.stringify(manager.summaries()).includes('sk-test'),false);assert.equal(JSON.stringify({settings:{apiProviders:workspace.data.settings.apiProviders}}).includes('sk-test'),true);
 const models=await manager.models('openai');assert.ok(models.some(m=>m.id==='gpt-6.1-sol'));assert.ok(models.some(m=>m.id==='gpt-4o'));await manager.select('openai');const output=await manager.respond({model:'gpt-6.1-sol',instructions:'test',input:[{role:'user',content:[{type:'input_text',text:'fictional'}]}]});assert.match(output,/ready/);const request=calls.find(c=>c.url.endsWith('/responses'));assert.equal(request.url,'https://api.openai.com/v1/responses');assert.equal(request.options.headers.Authorization,'Bearer sk-test-secret-key-123');assert.equal(request.options.model,undefined);assert.ok(!request.options.body.includes('sk-test-secret-key-123'));
});

test('Claude model catalog and PDF request use Anthropic Messages format',async()=>{
 const calls=[];const {manager}=setup(async(url,options={})=>{calls.push({url:String(url),options});if(String(url).includes('/models?'))return Response.json({data:[{id:'claude-sonnet-4-5',display_name:'Claude Sonnet'}],has_more:false});return anthropicStream('translated');});manager.setKey('anthropic','sk-ant-test-secret-key');await manager.select('anthropic');assert.equal((await manager.models())[0].id,'claude-sonnet-4-5');const bytes=Buffer.from('%PDF fake data');const output=await manager.respond({model:'claude-sonnet-4-5',instructions:'system rules',input:[{role:'user',content:[{type:'input_text',text:'translate'},{type:'input_file',filename:'fiction.pdf',file_data:`data:application/pdf;base64,${bytes.toString('base64')}`}]}]});assert.equal(output,'translated');const call=calls.find(c=>c.url.endsWith('/messages'));const body=JSON.parse(call.options.body);assert.equal(call.options.headers['x-api-key'],'sk-ant-test-secret-key');assert.equal(body.system,'system rules');assert.equal(body.messages[0].content[1].type,'document');assert.equal(body.messages[0].content[1].source.media_type,'application/pdf');
});

test('DeepSeek vision adapter locally renders PDF pages and sends them as image input',async()=>{
 let submitted;const {manager}=setup(async(url,options={})=>{if(String(url).endsWith('/models'))return Response.json({data:[{id:'deepseek-flash'}]});if(String(url).endsWith('/responses')){submitted=JSON.parse(options.body);return responseStream('{"status":"ready"}');}throw new Error('Unexpected network request');});manager.setKey('deepseek','sk-deepseek-test-key');await manager.select('deepseek');const pdf=await PDFDocument.create();pdf.addPage([250,160]);const bytes=Buffer.from(await pdf.save());await manager.respond({model:'deepseek-flash',instructions:'read page',input:[{role:'user',content:[{type:'input_text',text:'translate'},{type:'input_file',filename:'fiction.pdf',file_data:`data:application/pdf;base64,${bytes.toString('base64')}`}]}]});assert.equal(submitted.model,'deepseek-flash');const image=submitted.input[0].content.find(c=>c.type==='input_image');assert.ok(image?.image_url.startsWith('data:image/jpeg;base64,'));
});

test('HTTP provider management keeps keys private and allows explicit local API selection',async t=>{
 const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {Workspace}=await import('../lib/workspace.mjs');const {createApp}=await import('../server.mjs');
 const dir=await mkdtemp(join(tmpdir(),'translateocr-provider-'));t.after(()=>rm(dir,{recursive:true,force:true}));const workspace=await new Workspace(dir).init();const connection={status:()=>({connected:false,planEnabled:false})};const fetcher=async(url)=>String(url).endsWith('/models')?Response.json({data:[{id:'gpt-4o'}]}):responseStream('{"status":"ready"}');const provider=new ProviderManager(connection,workspace,fetcher),port=47000+Math.floor(Math.random()*1000),origin=`http://127.0.0.1:${port}`,server=createApp({connection,workspace,provider,port});await new Promise((resolve,reject)=>server.once('error',reject).listen(port,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const page=await fetch(origin),cookie=page.headers.get('set-cookie').split(';')[0],session=await fetch(origin+'/api/session',{headers:{cookie}}).then(r=>r.json()),headers={cookie,origin,'content-type':'application/json','x-translateocr-csrf':session.csrf};const post=(path,data)=>fetch(origin+path,{method:'POST',headers,body:JSON.stringify(data)});
 assert.equal((await post('/api/providers/key',{provider:'openai',apiKey:'sk-private-route-test-key'})).status,200);assert.equal((await post('/api/providers/select',{provider:'openai'})).status,200);const [status,catalog,library]=await Promise.all([fetch(origin+'/api/session',{headers:{cookie}}).then(r=>r.json()),fetch(origin+'/api/providers',{headers:{cookie}}).then(r=>r.json()),fetch(origin+'/api/library',{headers:{cookie}}).then(r=>r.json())]);assert.equal(status.provider,'openai');assert.ok(catalog.providers.find(p=>p.id==='openai').configured);assert.equal(JSON.stringify({status,catalog,library}).includes('sk-private-route-test-key'),false);
});


test('DeepSeek authenticates the real model catalog and rejects invalid keys',async()=>{
 const calls=[];const {manager}=setup(async(url,options)=>{calls.push({url:String(url),headers:options.headers});return Response.json({error:{code:'invalid_api_key'}},{status:401});});
 manager.setKey('deepseek','sk-invalid-fixture');await assert.rejects(manager.models('deepseek'),/API-Schlüssel/);assert.equal(calls[0].url,'https://api.deepseek.com/models');assert.equal(calls[0].headers.Authorization,'Bearer sk-invalid-fixture');
});
test('Specialized OpenAI models are excluded and refreshing bypasses a cached catalog',async()=>{
 let calls=0;const {manager}=setup(async()=>{calls++;return Response.json({data:[{id:'gpt-4o'},{id:'gpt-4o-audio-preview'},{id:'gpt-5-codex'},{id:'gpt-4o-realtime-preview'},{id:'o3-mini'},{id:'gpt-5.1-chat-latest'}]});});
 manager.setKey('openai','sk-model-fixture');assert.deepEqual((await manager.models('openai')).map(m=>m.id),['gpt-4o']);await manager.models('openai');assert.equal(calls,1);await manager.models('openai',{refresh:true});assert.equal(calls,2);
});
test('Claude respects returned model output limits',async()=>{
 let submitted;const {manager}=setup(async(url,options={})=>String(url).includes('/models?')?Response.json({data:[{id:'claude-fixture',max_tokens:8192}],has_more:false}):(submitted=JSON.parse(options.body),anthropicStream('complete')));
 manager.setKey('anthropic','sk-ant-fixture');await manager.select('anthropic');await manager.respond({model:'claude-fixture',input:[{role:'user',content:[{type:'input_text',text:'fictional'}]}]});assert.equal(submitted.max_tokens,8192);
});

test('OpenAI Responses usage events expose provider token details without changing the text result',async()=>{
 const {manager}=setup(async(url)=>String(url).endsWith('/models')?Response.json({data:[{id:'gpt-6.1-sol'}]}):new Response(`data: ${JSON.stringify({type:'response.output_text.delta',delta:'ready'})}\n\ndata: ${JSON.stringify({type:'response.completed',response:{id:'resp_fictional',usage:{input_tokens:120,output_tokens:35,total_tokens:155,input_tokens_details:{cached_tokens:20},output_tokens_details:{reasoning_tokens:7}}}})}\n\n`));
 manager.setKey('openai','sk-openai-test-key');await manager.select('openai');const reports=[];const text=await manager.respond({model:'gpt-6.1-sol',input:[{role:'user',content:[{type:'input_text',text:'fictional'}]}]},AbortSignal.timeout(1000),()=>{},(usage,meta)=>reports.push({usage,meta}));assert.equal(text,'ready');assert.deepEqual(reports.at(-1),{usage:{inputTokens:120,outputTokens:35,cachedInputTokens:20,reasoningTokens:7},meta:{complete:true,responseId:'resp_fictional'}});
});

test('Anthropic usage includes cached input and priced cache-write breakdowns',async()=>{
 const first={type:'message_start',message:{id:'msg_fictional',usage:{input_tokens:40,cache_read_input_tokens:10,cache_creation_input_tokens:5,cache_creation:{ephemeral_5m_input_tokens:5,ephemeral_1h_input_tokens:0}}}};
 const events=[first,{type:'content_block_delta',delta:{type:'text_delta',text:'translated'}},{type:'message_delta',usage:{output_tokens:12}},{type:'message_stop'}];
 const {manager}=setup(async(url)=>String(url).includes('/models?')?Response.json({data:[{id:'claude-sonnet-4-5'}],has_more:false}):new Response(events.map(event=>`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')));
 manager.setKey('anthropic','sk-ant-test-key');await manager.select('anthropic');const reports=[];const text=await manager.respond({model:'claude-sonnet-4-5',input:[{role:'user',content:[{type:'input_text',text:'fictional'}]}]},AbortSignal.timeout(1000),()=>{},(usage,meta)=>reports.push({usage,meta}));assert.equal(text,'translated');assert.deepEqual(reports[0].usage,{inputTokens:55,cachedInputTokens:10,cacheWrite5mTokens:5,cacheWrite1hTokens:0});assert.equal(reports.at(-1).meta.complete,true);assert.equal(reports.at(-1).meta.responseId,'msg_fictional');
});
