// Provider adapters keep credentials in the local runtime. Exports and storage are provider-independent.
import {RESOURCE,readResponseStream,publicError} from './chatgpt.mjs';
import {networkFetch} from './diagnostics.mjs';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas,DOMMatrix,ImageData,Path2D} from '@napi-rs/canvas';

export const PROVIDERS={
 chatgpt:{label:'ChatGPT-Konto',kind:'chatgpt',help:'Mit ChatGPT anmelden und Foliquo ausdrücklich die Plan-Nutzung erlauben.'},
 openai:{label:'OpenAI API',kind:'api',help:'API-Schlüssel im OpenAI API-Dashboard erstellen. API-Nutzung wird getrennt vom ChatGPT-Abo abgerechnet.'},
 anthropic:{label:'Claude API',kind:'api',help:'Anthropic API-Schlüssel verwenden. PDF- und Bildseiten werden direkt an Claude gesendet.'},
 deepseek:{label:'DeepSeek API',kind:'api',help:'DeepSeek API-Schlüssel verwenden. Dokumentseiten werden für das visionfähige Modell in Bilder umgewandelt.'},
};
const API_ENDPOINTS={openai:'https://api.openai.com/v1',anthropic:'https://api.anthropic.com/v1',deepseek:'https://api.deepseek.com'};
const SAFE_MODEL_ID=/^[a-zA-Z0-9._:-]{1,180}$/;
const IMAGE_TYPES=new Set(['image/jpeg','image/png','image/gif','image/webp']);
function retryDelay(value,now=Date.now()){if(typeof value!=='string'||!value.trim())return null;const seconds=Number(value),millis=Number.isFinite(seconds)&&seconds>=0?seconds*1000:Date.parse(value)-now;return Number.isFinite(millis)&&millis>0?Math.min(86400000,millis):null;}

function statusError(provider,response,body){
 const status=response.status,code=body?.error?.type||body?.error?.code||body?.type||'';
 const messages={openai:'OpenAI API hat die Anfrage abgelehnt. API-Schlüssel, Projektzugriff und API-Abrechnung prüfen.',anthropic:'Anthropic hat die Anfrage abgelehnt. Claude API-Schlüssel und Kontozugriff prüfen.',deepseek:'DeepSeek hat die Anfrage abgelehnt. API-Schlüssel und verfügbares API-Guthaben prüfen.'};
 const error=new Error(status===429?'Das Nutzungslimit dieses Anbieters ist erreicht. Bitte später erneut versuchen.':status===401||status===403?messages[provider]:status>=500?`${PROVIDERS[provider].label} ist vorübergehend nicht verfügbar.`:messages[provider]);
 error.code=String(code||`HTTP_${status}`).slice(0,100);error.pauseQueue=[401,403,429].includes(status)||/usage_limit|rate_limit/.test(String(code));error.retryAfterMs=retryDelay(response.headers.get('retry-after'));error.context={stage:'translation_request',host:new URL(API_ENDPOINTS[provider]).hostname,httpStatus:status,requestId:response.headers.get('request-id')||response.headers.get('x-request-id')};return error;
}
async function responseError(provider,response){let data={};try{data=await response.json();}catch{}return statusError(provider,response,data);}
function parseDataUrl(value){const m=String(value||'').match(/^data:(image\/(?:jpeg|png|gif|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);if(!m)throw new Error('Datei kann für diesen Anbieter nicht vorbereitet werden.');return {type:m[1],data:m[2]};}
function contentText(content){return (content||[]).filter(c=>c.type==='input_text').map(c=>c.text).join('\n');}

async function pdfAsImages(file,signal){
 globalThis.DOMMatrix??=DOMMatrix;globalThis.ImageData??=ImageData;globalThis.Path2D??=Path2D;
 let document,loadingTask;try{loadingTask=getDocument({data:new Uint8Array(file.bytes),isEvalSupported:false,useWorkerFetch:false});document=await loadingTask.promise;}catch{throw new Error('DeepSeek konnte ein PDF nicht in lesbare Seitenbilder umwandeln. Bitte eine unverschlüsselte PDF verwenden.');}
 if(document.numPages>100)throw new Error('Für DeepSeek sind höchstens 100 PDF-Seiten je Auftrag zulässig. Bitte das Dokument aufteilen.');
 const result=[];
 try{for(let n=1;n<=document.numPages;n++){
  signal?.throwIfAborted();const page=await document.getPage(n),base=page.getViewport({scale:1}),scale=Math.min(2,1800/Math.max(base.width,base.height)),viewport=page.getViewport({scale}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),context=canvas.getContext('2d');
  context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);await page.render({canvas,canvasContext:context,viewport}).promise;
  const bytes=canvas.toBuffer('image/jpeg',84);result.push({name:`${file.name} · Seite ${n}`,type:'image/jpeg',data:bytes.toString('base64')});
  if(result.reduce((sum,x)=>sum+Buffer.byteLength(x.data,'base64'),0)>32*1024*1024)throw new Error('Die Bildseiten überschreiten das DeepSeek-Limit für eine Anfrage. Bitte weniger Seiten auf einmal verarbeiten.');
 }}finally{await loadingTask.destroy();}
 return result;
}

function deepSeekRequest(request,model,documents){
 const content=[];
 for(const item of request.input||[]){for(const part of item.content||[]){
  if(part.type==='input_text')content.push({type:'input_text',text:part.text});
  else if(part.type==='input_image'){const image=parseDataUrl(part.image_url);if(!IMAGE_TYPES.has(image.type))throw new Error('DeepSeek unterstützt in diesem Ablauf nur JPG, PNG, GIF und WebP.');content.push({type:'input_image',image_url:`data:${image.type};base64,${image.data}`,detail:'high'});}
  else if(part.type==='input_file')throw new Error('DeepSeek-PDF-Seiten wurden nicht vorbereitet. Bitte erneut versuchen.');
 }}
 return {model,store:false,stream:true,instructions:request.instructions,input:[{role:'user',content}]};
}
function anthropicRequest(request,model){
 const messages=[];
 for(const message of request.input||[]){const content=[];for(const part of message.content||[]){
  if(part.type==='input_text')content.push({type:'text',text:part.text});
  else if(part.type==='input_image'){const image=parseDataUrl(part.image_url);if(!IMAGE_TYPES.has(image.type))throw new Error('Claude unterstützt in diesem Ablauf nur JPG, PNG, GIF und WebP.');content.push({type:'image',source:{type:'base64',media_type:image.type,data:image.data}});}
  else if(part.type==='input_file'){const file=parseDataUrl(part.file_data);if(file.type!=='application/pdf')throw new Error('Claude erwartet PDF-Dateien im PDF-Format.');content.push({type:'document',source:{type:'base64',media_type:'application/pdf',data:file.data},title:part.filename});}
 }
 if(content.length)messages.push({role:message.role==='assistant'?'assistant':'user',content});}
 const body={model,max_tokens:32768,stream:true,messages};if(request.instructions)body.system=request.instructions;
 if(Buffer.byteLength(JSON.stringify(body))>31*1024*1024)throw new Error('Diese Anfrage überschreitet das 32-MB-Limit der Claude API. Bitte weniger Seiten auf einmal verarbeiten.');
 return body;
}
function normalizeAnthropicUsage(usage){
 if(!usage||typeof usage!=='object')return null;
 const input=usage.input_tokens,cacheRead=usage.cache_read_input_tokens,cacheWrite=usage.cache_creation_input_tokens,output=usage.output_tokens;
 const detail5=usage.cache_creation?.ephemeral_5m_input_tokens,detail1h=usage.cache_creation?.ephemeral_1h_input_tokens;
 const detailed=Number.isSafeInteger(detail5)&&Number.isSafeInteger(detail1h)&&Number.isSafeInteger(cacheWrite)&&detail5+detail1h===cacheWrite;
 return {
  ...(Number.isSafeInteger(input)&&input>=0||Number.isSafeInteger(cacheRead)&&cacheRead>=0||Number.isSafeInteger(cacheWrite)&&cacheWrite>=0?{inputTokens:(input||0)+(cacheRead||0)+(cacheWrite||0)}:{}),
  ...(Number.isSafeInteger(output)&&output>=0?{outputTokens:output}:{}),
  ...(Number.isSafeInteger(cacheRead)&&cacheRead>=0?{cachedInputTokens:cacheRead}:{}),
  ...(Number.isSafeInteger(cacheWrite)&&cacheWrite>=0&&!detailed?{cacheWriteTokens:cacheWrite}:{}),
  ...(detailed?{cacheWrite5mTokens:detail5,cacheWrite1hTokens:detail1h}:{}),
 };
}
async function readAnthropicStream(body,onProgress=()=>{},onUsage=()=>{},responseMeta={}){
 const decoder=new TextDecoder();let buffer='',text='',completed=false,responseId=responseMeta.requestId||null;
 function event(block){const data=block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!data)return;const item=JSON.parse(data);
  if(item.type==='message_start'){responseId=item.message?.id||responseId;const usage=normalizeAnthropicUsage(item.message?.usage);if(usage)onUsage(usage,{responseId});}
  if(item.type==='message_delta'){const usage=normalizeAnthropicUsage(item.usage);if(usage)onUsage(usage,{responseId});}
  if(item.type==='content_block_delta'&&item.delta?.type==='text_delta'){text+=item.delta.text||'';onProgress(text.length);}
  if(item.type==='message_delta'&&item.delta?.stop_reason==='max_tokens')throw new Error('Claude hat die maximale Antwortlänge erreicht. Bitte weniger Seiten auf einmal verarbeiten.');
  if(item.type==='error'){const error=new Error('Claude konnte die Anfrage nicht abschließen. API-Zugriff und Nutzungslimit prüfen.');error.code=item.error?.type||item.error?.code;error.pauseQueue=/rate_limit|overloaded/.test(String(error.code||''));error.retryAfterMs=responseMeta.retryAfterMs||null;throw error;}
  if(item.type==='message_stop'){completed=true;onUsage(normalizeAnthropicUsage(item.usage),{complete:true,responseId});}
 }
 for await(const chunk of body){buffer+=decoder.decode(chunk,{stream:true}).replace(/\r\n/g,'\n');let end;while((end=buffer.indexOf('\n\n'))!==-1){event(buffer.slice(0,end));buffer=buffer.slice(end+2);}if(text.length>1500000||buffer.length>3000000)throw new Error('Die Antwort ist zu groß. Bitte weniger Seiten auf einmal übersetzen.');}
 buffer+=decoder.decode();if(buffer.trim())event(buffer);if(!completed||!text.trim())throw new Error('Die Claude-Antwort ist nicht vollständig angekommen. Bitte erneut versuchen.');return text;
}

class ApiKeyProvider{
 constructor(id,workspace,fetcher=fetch){this.id=id;this.workspace=workspace;this.fetcher=fetcher;this.cache=null;}
 get key(){return this.workspace?.data.settings.apiProviders?.[this.id]?.apiKey||'';}
 status(){return {connected:Boolean(this.key),planEnabled:Boolean(this.key),provider:this.id,email:null};}
 async fetch(url,options,stage='model_catalog'){
  const {model,...requestOptions}=options;const response=await networkFetch(url,{...requestOptions,signal:options.signal||AbortSignal.timeout(30000)},{stage,model},this.fetcher);
  if(!response.ok)throw await responseError(this.id,response);return response;
 }
 async models(){
  if(!this.key)throw new Error(`Zuerst einen ${PROVIDERS[this.id].label}-Schlüssel speichern.`);
  if(this.cache?.until>Date.now())return this.cache.models;
  const headers=this.id==='anthropic'?{'x-api-key':this.key,'anthropic-version':'2023-06-01'}:{Authorization:`Bearer ${this.key}`};
  let data=[];
  if(this.id==='deepseek'){
   const response=await this.fetch(`${API_ENDPOINTS.deepseek}/models`,{headers});data=((await response.json()).data||[]).filter(m=>m.id==='deepseek-flash');
  }else if(this.id==='openai'){
   const response=await this.fetch(`${API_ENDPOINTS.openai}/models`,{headers});data=(await response.json()).data||[];
   data=data.filter(m=>!/(?:audio|realtime|transcribe|tts|instruct|search|codex|image|chat-latest)|^o3-mini/i.test(m.id||'')).filter(m=>/^gpt-(?:4o|4\.1|5(?:\.[0-9]+)?|6(?:\.[0-9]+)?)(?:-|$)|^(?:o3|o4)(?:-|$)/i.test(m.id||''));
  }else{
   let after;
   for(let i=0;i<5;i++){const query=new URLSearchParams({limit:'1000'});if(after)query.set('after_id',after);const response=await this.fetch(`${API_ENDPOINTS.anthropic}/models?${query}`,{headers}),page=await response.json();data.push(...(page.data||[]));if(!page.has_more||!page.last_id)break;after=page.last_id;}
   data=data.filter(m=>/^claude-/i.test(m.id||'')&&m.lifecycle!=='retired'&&m.capabilities?.image_input?.supported!==false&&m.capabilities?.pdf_input?.supported!==false);
   this.modelLimits=new Map(data.map(m=>[m.id,Number.isInteger(m.max_tokens)&&m.max_tokens>0?Math.min(32768,m.max_tokens):4096]));
  }
  const models=data.map(m=>({id:m.id,name:m.display_name||m.name||m.id})).filter(m=>m.id&&m.name&&SAFE_MODEL_ID.test(m.id)).slice(0,200);
  if(!models.length)throw new Error(`Für ${PROVIDERS[this.id].label} wurden keine unterstützten Modelle gefunden.`);
  this.cache={until:Date.now()+60000,models};return models;
 }
 async respond(request,signal,onCharacters=()=>{},onUsage=()=>{}){
  if(!this.key)throw new Error(`Zuerst einen ${PROVIDERS[this.id].label}-Schlüssel speichern.`);
  const available=await this.models();if(!available.some(m=>m.id===request.model))throw new Error('Dieses Modell ist für den ausgewählten Anbieter nicht verfügbar.');
  if(this.id==='deepseek'){
   const content=[];for(const item of request.input||[]){for(const part of item.content||[]){if(part.type==='input_text')content.push({type:'input_text',text:part.text});else if(part.type==='input_file'){const file=parseDataUrl(part.file_data);if(file.type!=='application/pdf')throw new Error('DeepSeek benötigt PDF-Originalseiten.');const images=await pdfAsImages({name:part.filename,bytes:Buffer.from(file.data,'base64')},signal);content.push(...images.map(x=>({type:'input_image',image_url:`data:${x.type};base64,${x.data}`,detail:'high'})));}else if(part.type==='input_image'){const image=parseDataUrl(part.image_url);content.push({type:'input_image',image_url:`data:${image.type};base64,${image.data}`,detail:'high'});}}}
   const body={model:request.model,store:false,stream:true,instructions:request.instructions,input:[{role:'user',content}]};
   if(Buffer.byteLength(JSON.stringify(body))>46*1024*1024)throw new Error('Die vorbereiteten Seiten überschreiten das DeepSeek-Limit für eine Anfrage. Bitte weniger Seiten auf einmal verarbeiten.');
   const response=await this.fetch(`${API_ENDPOINTS.deepseek}/responses`,{method:'POST',headers:{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal,model:request.model},'translation_request');return readResponseStream(response.body,onCharacters,onUsage,{requestId:response.headers.get('x-request-id'),retryAfterMs:retryDelay(response.headers.get('retry-after'))});
  }
  if(this.id==='anthropic'){
   const body=anthropicRequest(request,request.model);body.max_tokens=this.modelLimits?.get(request.model)||4096;const response=await this.fetch(`${API_ENDPOINTS.anthropic}/messages`,{method:'POST',headers:{'x-api-key':this.key,'anthropic-version':'2023-06-01','Content-Type':'application/json'},body:JSON.stringify(body),signal,model:request.model},'translation_request');return readAnthropicStream(response.body,onCharacters,onUsage,{requestId:response.headers.get('request-id'),retryAfterMs:retryDelay(response.headers.get('retry-after'))});
  }
  const response=await this.fetch(`${API_ENDPOINTS.openai}/responses`,{method:'POST',headers:{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'},body:JSON.stringify(request),signal,model:request.model},'translation_request');return readResponseStream(response.body,onCharacters,onUsage,{requestId:response.headers.get('x-request-id'),retryAfterMs:retryDelay(response.headers.get('retry-after'))});
 }
}

export class ProviderManager{
 constructor(connection,workspace,fetcher=fetch){this.connection=connection;this.workspace=workspace;this.fetcher=fetcher;this.adapters={chatgpt:new ChatGPTProvider(connection,fetcher),openai:new ApiKeyProvider('openai',workspace,fetcher),anthropic:new ApiKeyProvider('anthropic',workspace,fetcher),deepseek:new ApiKeyProvider('deepseek',workspace,fetcher)};}
 get selected(){return this.workspace?.data.settings.provider||'chatgpt';}
 providerFor(id=this.selected){if(!PROVIDERS[id])throw new Error('Unbekannter KI-Anbieter.');return this.adapters[id];}
 status(id=this.selected){const adapter=this.providerFor(id),status=adapter.status();return {...status,provider:id,providerLabel:PROVIDERS[id].label,help:PROVIDERS[id].help};}
 summaries(){return Object.entries(PROVIDERS).map(([id,p])=>({id,label:p.label,kind:p.kind,help:p.help,configured:Boolean(this.adapters[id].status().connected)}));}
 async select(id){if(!PROVIDERS[id])throw new Error('Unbekannter KI-Anbieter.');if(id!=='chatgpt'&&!this.adapters[id].status().connected)throw new Error(`Zuerst einen ${PROVIDERS[id].label}-Schlüssel speichern.`);this.workspace.data.settings.provider=id;return this.status(id);}
 setKey(id,key){if(!['openai','anthropic','deepseek'].includes(id))throw new Error('API-Schlüssel werden für diesen Anbieter nicht verwendet.');if(typeof key!=='string'||key.trim()!==key||key.length<8||key.length>4096||/[\r\n\0]/.test(key))throw new Error('Der API-Schlüssel ist ungültig. Bitte den Schlüssel ohne Leerzeichen oder Zeilenumbruch einfügen.');this.workspace.data.settings.apiProviders||={};this.workspace.data.settings.apiProviders[id]={apiKey:key};this.adapters[id].cache=null;return this.status(id);}
 clearKey(id){if(!['openai','anthropic','deepseek'].includes(id))throw new Error('API-Schlüssel werden für diesen Anbieter nicht verwendet.');delete this.workspace.data.settings.apiProviders?.[id];this.adapters[id].cache=null;if(this.selected===id)this.workspace.data.settings.provider='chatgpt';return this.status(this.selected);}
 models(id=this.selected,{refresh=false}={}){const adapter=this.providerFor(id);if(refresh){adapter.cache=null;if(id==='chatgpt')this.connection.modelCache=null;}return adapter.models();}
 async respond(request,signal,onProgress,onUsage){return this.providerFor().respond(request,signal,onProgress,onUsage);}
}
export class ChatGPTProvider {
 constructor(connection,fetcher=fetch){this.connection=connection;this.fetcher=fetcher;this.id='chatgpt';}
 status(){return this.connection.status();}
 models(){return this.connection.models();}
 async respond(request,signal,onCharacters=()=>{},onUsage=()=>{}){const token=await this.connection.accessToken();const response=await networkFetch(`${RESOURCE}/responses`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(request),signal},{stage:'translation_request',model:request.model},this.fetcher);if(!response.ok){let body;try{body=await response.json();}catch{}const error=new Error(publicError(body?.error||{code:response.status===401?'unauthorized':''}));error.pauseQueue=[401,403,429].includes(response.status)||/usage_limit|rate_limit/.test(String(body?.error?.code||''));error.code=body?.error?.code;error.retryAfterMs=retryDelay(response.headers.get('retry-after'));error.context={stage:'translation_request',host:'api.openai.com',httpStatus:response.status,requestId:response.headers.get('x-request-id')};throw error;}return readResponseStream(response.body,onCharacters,onUsage,{requestId:response.headers.get('x-request-id'),retryAfterMs:retryDelay(response.headers.get('retry-after'))});}
}
export class DemoProvider {
 constructor(){this.id='demo';}
 status(){return {connected:true,planEnabled:true};}
 async models(){return [{id:'demo',name:'Demo · fiktive Daten, keine KI-Anfrage'}];}
 async respond(request,signal){signal?.throwIfAborted();const context=request.input?.[0]?.content.find(c=>c.type==='input_text')?.text||'';if(context.includes('refine-field'))return JSON.stringify({translated:'Alex Muster'});let name='Alex Example';if(context.includes('Alex Muster'))name='Alex Muster';return JSON.stringify({status:'ready',sourceLanguage:'Englisch',documentType:'Fiktiver Führerschein',questions:[],text:`Vorderseite\nFIKTIVES DEMODOKUMENT\nName | ${name}\nGeburtsdatum | 07.03.1998\nDokumentnummer | DEMO-12345\nMerkmale | keine besonderen Merkmale\n[Stempel: Fiktive Demo-Behörde]`,regions:[{label:"Demo-Stempel",kind:"stamp",source:"Fictional demo authority",translated:"[Stempel: Fiktive Demo-Behörde]",fileIndex:0,page:1,box:[.1,.43,.8,.07]}],fields:[{label:'Name',kind:'name',source:'Alex Example',translated:name,fileIndex:0,page:1,box:[.1,.18,.75,.06]},{label:'Geburtsdatum',kind:'date',source:'7 March 1998',translated:'07.03.1998',fileIndex:0,page:1,box:[.1,.27,.75,.06]}]});}
}
