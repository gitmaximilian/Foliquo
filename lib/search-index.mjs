import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {lstat,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {SecureStore} from './secure-store.mjs';
import {foldSearchText,searchGrams,parseSearchQuery,findSearchMatch,searchSnippet} from './search-text.mjs';
import {searchTextUnits,streamSearchChunks,SEARCH_CHUNK_CHARS} from './search-chunks.mjs';
const ROOT='search-root-000000000000000000000000';
const MAX_OBJECT=8*1024*1024,MAX_GRAMS=4096,MAX_CHUNKS=12000;
const QUERY_BYTES=64*1024*1024,QUERY_TEXT=8*1024*1024;
const objectId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{16,80}$/.test(value);
const fault=(message='The local search index needs rebuilding.')=>Object.assign(new Error(message),{code:'ERR_SEARCH_INDEX'});
function ownerRequired(owner){if(typeof owner!=='string'||!owner||owner.length>256)throw new Error('Search requires an owner.');}
function emptyRoot(owner){return {schema:1,owner,epoch:randomUUID(),enabled:false,paused:true,docs:{},buckets:{},gc:false};}
function validateRoot(root,owner){if(!root||root.schema!==1||root.owner!==owner||typeof root.epoch!=='string'||!root.docs||!root.buckets||Array.isArray(root.docs)||Array.isArray(root.buckets)||Object.keys(root.docs).length>10000)throw fault();return root;}
/** A derived owner-isolated encrypted index. It is never a source of job truth. */
export class SearchIndex {
 constructor(directory,key,jobStore){this.directory=join(directory,'search-index');this.key=createHmac('sha256',key).update('foliquo.local-search.v1').digest();this.jobStore=jobStore;this.tail=Promise.resolve();this.errors=new Map();this.owners=new Set();this.controllers=new Map();this.worker=null;this.closed=false;}
 digest(value){return createHmac('sha256',this.key).update(value).digest('hex');}
 store(owner){return new SecureStore(join(this.directory,this.digest(`owner:${owner}`)),this.key);}
 run(owner,work){ownerRequired(owner);this.owners.add(owner);const result=this.tail.catch(()=>{}).then(()=>work(this.store(owner)));this.tail=result.catch(()=>{});return result.catch(error=>{if(error.name!=='AbortError'&&error.code==='ERR_SEARCH_INDEX')this.errors.set(owner,true);throw error;});}
 async read(store,id,type='record',budget){
  if(!objectId(id))throw fault();
  try{const info=await lstat(store.path(id,type));if(!info.isFile()||info.isSymbolicLink()||info.size>MAX_OBJECT)throw fault();if(budget){if(info.size>budget.left)throw Object.assign(new Error('Search read budget reached.'),{code:'ERR_SEARCH_BUDGET'});budget.left-=info.size;}return JSON.parse((await store.read(id,type)).toString('utf8'));}
  catch(error){if(error.code==='ERR_SEARCH_BUDGET')throw error;throw fault();}
 }
 async root(store,owner){try{await lstat(store.path(ROOT,'record'));}catch(error){if(error.code==='ENOENT')return emptyRoot(owner);throw fault();}return validateRoot(await this.read(store,ROOT),owner);}
 async write(store,id,value,type='record'){const bytes=Buffer.from(JSON.stringify(value));if(bytes.length>MAX_OBJECT-64)throw fault('The local search index exceeds its object limit.');await store.write(id,type,bytes);}
 catalog(owner){return new Map(this.jobStore.searchCatalog({owner}).map(entry=>[this.digest(`job:${owner}:${entry.id}`),entry]));}
 snapshot(root,catalog){let complete=0,partial=0,missingSource=0,limited=0;for(const [token,entry]of catalog){const doc=root.docs[token];if(!doc||doc.stamp!==entry.stamp)continue;if(doc.complete)complete++;else partial++;if(!doc.sourceAvailable)missingSource++;if(doc.sourceLimited||doc.limited)limited++;}return {enabled:root.enabled===true,paused:root.paused===true,phase:root.gc?'cleaning':root.paused?'paused':complete===catalog.size?'ready':'building',total:catalog.size,complete,partial,pending:catalog.size-complete,missingSource,limited,incomplete:complete<catalog.size||root.gc===true};}
 status(owner){return this.run(owner,async store=>{try{return {...this.snapshot(await this.root(store,owner),this.catalog(owner)),error:this.errors.has(owner)};}catch(error){if(error.code!=='ERR_SEARCH_INDEX')throw error;return {enabled:false,paused:true,phase:'error',total:this.catalog(owner).size,complete:0,partial:0,pending:this.catalog(owner).size,incomplete:true,error:true};}});}
 configure(owner,{rebuild=false,paused=false}={}){ownerRequired(owner);if(paused||rebuild)this.controllers.get(owner)?.abort();return this.run(owner,async store=>{let root=rebuild?emptyRoot(owner):await this.root(store,owner);root.enabled=true;root.paused=Boolean(paused);if(rebuild)root.gc=true;await this.write(store,ROOT,root);this.errors.delete(owner);return this.snapshot(root,this.catalog(owner));});}
 notify(){
  this.wakeGeneration=(this.wakeGeneration||0)+1;if(this.closed||this.worker)return;
  this.worker=new Promise(resolve=>setImmediate(resolve)).then(async()=>{
   let again=true;while(again&&!this.closed){again=false;const generation=this.wakeGeneration;for(const owner of this.owners){
    if(this.closed)break;if(this.errors.has(owner))continue;const controller=new AbortController();this.controllers.set(owner,controller);
    try{const result=await this.step(owner,{signal:controller.signal});if(result.worked>0||result.phase==='cleaning')again=true;}catch(error){if(error.name!=='AbortError')this.errors.set(owner,true);}
    finally{this.controllers.delete(owner);}await new Promise(resolve=>setImmediate(resolve));
   }if(this.wakeGeneration!==generation)again=true;}
  }).finally(()=>{this.worker=null;});
 }
 stop(){this.closed=true;for(const controller of this.controllers.values())controller.abort();}
 async collectGarbage(store,root,{limit=128}={}){
  // Rebuild publishes an empty root before removing only derived objects. The
  // cleanup can be interrupted/restarted, and never touches the primary store.
  let removed=0,more=false;
  for(const type of ['record','working']){let names;try{names=await readdir(join(store.directory,type));}catch(error){if(error.code==='ENOENT')continue;throw error;}for(const name of names){if(!name.endsWith('.enc'))continue;const id=name.slice(0,-4);if(id===ROOT||!objectId(id))continue;if(removed>=limit){more=true;break;}await store.remove(id,type);removed++;}}
  root.gc=more;return removed;
 }
 async manifest(store,doc,budget){const manifest=await this.read(store,doc.manifestId,'record',budget);if(!manifest||!Array.isArray(manifest.chunks)||manifest.chunks.length>MAX_CHUNKS||!Array.isArray(manifest.grams)||manifest.grams.length>MAX_GRAMS||!manifest.cursor)throw fault();return manifest;}
 async publish(store,root,updates,created,obsolete){
  const changed=new Map();
  const bucket=async hash=>{const prefix=hash.slice(0,2);if(!changed.has(prefix)){const oldId=root.buckets[prefix],value=oldId?await this.read(store,oldId):{};if(!value||typeof value!=='object'||Array.isArray(value))throw fault();changed.set(prefix,{oldId,value});}return changed.get(prefix).value;};
  for(const {token,oldManifest,newManifest}of updates){for(const hash of oldManifest?.grams||[]){const value=await bucket(hash),list=value[hash];if(Array.isArray(list)){const remaining=list.filter(item=>item!==token);if(remaining.length)value[hash]=remaining;else delete value[hash];}}
   for(const hash of newManifest?.grams||[]){const value=await bucket(hash);value[hash]=[...(value[hash]||[]).filter(item=>item!==token),token];}}
  for(const [prefix,{oldId,value}]of changed){if(Object.keys(value).length){const id=randomUUID();await this.write(store,id,value);created.push({id,type:'record'});root.buckets[prefix]=id;}else delete root.buckets[prefix];if(oldId)obsolete.push({id:oldId,type:'record'});}
  root.epoch=randomUUID();await this.write(store,ROOT,root);
 }
 step(owner,{signal,maxJobs=8,maxChars=4*1024*1024}={}){return this.run(owner,async store=>{
  if(!Number.isInteger(maxJobs)||maxJobs<1||maxJobs>8||!Number.isInteger(maxChars)||maxChars<SEARCH_CHUNK_CHARS||maxChars>4*1024*1024)throw new Error('Invalid search work limits.');
  signal?.throwIfAborted();const root=await this.root(store,owner),catalog=this.catalog(owner);if(!root.enabled)return this.snapshot(root,catalog);
  if(root.gc){await this.collectGarbage(store,root);signal?.throwIfAborted();await this.write(store,ROOT,root);return this.snapshot(root,catalog);}
  const created=[],obsolete=[],updates=[];let published=false,worked=0,chars=0;
  try{
   // Stale entries cannot be returned by query even before this bounded cleanup.
   for(const [token,doc]of Object.entries(root.docs)){if(worked>=maxJobs)break;const entry=catalog.get(token);if(entry&&entry.stamp===doc.stamp)continue;const old=await this.manifest(store,doc);updates.push({token,oldManifest:old});obsolete.push({id:doc.manifestId,type:'record'},...old.chunks.map(chunk=>({id:chunk.id,type:'working'})));delete root.docs[token];worked++;}
   for(const [token,entry]of catalog){
    if(root.paused)break;signal?.throwIfAborted();if(worked>=maxJobs||maxChars-chars<SEARCH_CHUNK_CHARS)break;
    const previous=root.docs[token];if(previous&&previous.stamp!==entry.stamp)continue;if(previous?.complete)continue;
    const old=previous?await this.manifest(store,previous):null,manifest=old?structuredClone(old):{chunks:[],grams:[],cursor:{unit:0,offset:0},broad:false,limited:false};const grams=new Set(manifest.grams);let complete=false,sourceAvailable=false,sourceLimited=true;
    const valid=await this.jobStore.withSearchMaterial(entry.id,owner,entry.stamp,async(material,withText)=>{
     const units=searchTextUnits(material);sourceAvailable=units.sourceAvailable;sourceLimited=units.sourceLimited;
     for(let unitIndex=manifest.cursor.unit;unitIndex<units.units.length;unitIndex++){
      signal?.throwIfAborted();if(maxChars-chars<SEARCH_CHUNK_CHARS)return true;
      const unit=units.units[unitIndex];
      if(manifest.chunks.length>=MAX_CHUNKS){manifest.limited=true;complete=true;return true;}
      const state=await streamSearchChunks(withText,unit.value,unit.path,async chunk=>{
       if(manifest.chunks.length>=MAX_CHUNKS)throw Object.assign(new Error('Search chunk limit.'),{code:'ERR_SEARCH_CHUNKS'});
       const id=randomUUID(),stored={...chunk,unit:unitIndex,kind:unit.kind,version:unit.version,historical:unit.historical,sourceId:unit.sourceId||null,location:unit.location};
       await this.write(store,id,stored,'working');created.push({id,type:'working'});manifest.chunks.push({id,unit:unitIndex,offset:chunk.offset,kind:unit.kind,version:unit.version,historical:unit.historical});chars+=chunk.text.length;
       if(!manifest.broad)for(const gram of searchGrams(foldSearchText(chunk.text))){grams.add(this.digest(`gram:${gram}`));if(grams.size>=MAX_GRAMS){manifest.broad=true;break;}}
      },{signal,startOffset:manifest.cursor.offset,maxChars:Math.max(SEARCH_CHUNK_CHARS,maxChars-chars)}).catch(error=>{if(error.code!=='ERR_SEARCH_CHUNKS')throw error;return {done:false,limited:true,nextOffset:manifest.cursor.offset};});
      manifest.limited||=state.limited;manifest.cursor=state.done||state.limited?{unit:unitIndex+1,offset:0}:{unit:unitIndex,offset:state.nextOffset};if(!state.done&&!state.limited)return true;
     }
     complete=true;return true;
    },{signal});
    if(!valid){for(const chunk of manifest.chunks.slice(old?.chunks.length||0)){await store.remove(chunk.id,'working').catch(()=>{});}continue;}
    manifest.grams=[...grams];const manifestId=randomUUID();await this.write(store,manifestId,manifest);created.push({id:manifestId,type:'record'});if(previous)obsolete.push({id:previous.manifestId,type:'record'});
    root.docs[token]={id:entry.id,stamp:entry.stamp,manifestId,complete,sourceAvailable,sourceLimited,limited:manifest.limited,broad:manifest.broad};updates.push({token,oldManifest:old,newManifest:manifest});worked++;
   }
   signal?.throwIfAborted();if(updates.length){await this.publish(store,root,updates,created,obsolete);published=true;for(const item of obsolete)await store.remove(item.id,item.type).catch(()=>{});}this.errors.delete(owner);return {...this.snapshot(root,this.catalog(owner)),worked,characters:chars};
  }finally{if(!published)for(const item of created)await store.remove(item.id,item.type).catch(()=>{});}
 });}
 sign(owner,value){const payload=Buffer.from(JSON.stringify(value)).toString('base64url'),signature=this.digest(`token:${owner}:${payload}`);return `${payload}.${signature}`;}
 verify(owner,token){if(typeof token!=='string'||token.length>4096)throw new Error('Invalid search token.');const [payload,signature,...rest]=token.split('.'),expected=this.digest(`token:${owner}:${payload}`);if(rest.length||!signature||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))throw new Error('Invalid search token.');try{return JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));}catch{throw new Error('Invalid search token.');}}
 query(owner,{query,history=false,cursor=null,limit=25}={}){return this.run(owner,async store=>{
  const parsed=parseSearchQuery(query);if(typeof history!=='boolean'||!Number.isInteger(limit)||limit<1||limit>25)throw new Error('Invalid search options.');const root=await this.root(store,owner),catalog=this.catalog(owner),status=this.snapshot(root,catalog);if(!root.enabled||root.gc)return {hits:[],cursor:null,status};
  const digest=this.digest(`query:${JSON.stringify([parsed.folded,parsed.numeric,history])}`),position=cursor?this.verify(owner,cursor):{doc:0,chunk:0,from:0};if(cursor&&(position.query!==digest||position.epoch!==root.epoch))throw Object.assign(new Error('The search changed. Please search again.'),{code:'ERR_SEARCH_CURSOR'});
  if(![position.doc,position.chunk,position.from].every(value=>Number.isSafeInteger(value)&&value>=0))throw new Error('Invalid search cursor.');
  const budget={left:QUERY_BYTES},selected=[...new Set([parsed.grams[0],parsed.grams[Math.floor(parsed.grams.length/2)],parsed.grams.at(-1)])],cache=new Map();let candidates=null;
  for(const gram of selected){const hash=this.digest(`gram:${gram}`),prefix=hash.slice(0,2),id=root.buckets[prefix];let postings=[];if(id){if(!cache.has(prefix))cache.set(prefix,await this.read(store,id,'record',budget));postings=cache.get(prefix)[hash]||[];if(!Array.isArray(postings))throw fault();}const set=new Set(postings);candidates=candidates===null?set:new Set([...candidates].filter(token=>set.has(token)));}
  for(const [token,doc]of Object.entries(root.docs))if(doc.broad)candidates.add(token);
  const ordered=[...candidates].filter(token=>catalog.has(token)&&root.docs[token]?.stamp===catalog.get(token).stamp).sort(),hits=[];let textRead=0,scanned=0,continuation=null;
  const next=(doc,chunk,from)=>this.sign(owner,{epoch:root.epoch,query:digest,doc,chunk,from});
  outer:for(let di=position.doc;di<ordered.length;di++){
   if(scanned++>=64){continuation=next(di,0,0);break;}const token=ordered[di],doc=root.docs[token],entry=catalog.get(token);let manifest;
   try{manifest=await this.manifest(store,doc,budget);}catch(error){if(error.code==='ERR_SEARCH_BUDGET'){continuation=next(di,di===position.doc?position.chunk:0,di===position.doc?position.from:0);break;}throw error;}
   for(let ci=di===position.doc?position.chunk:0;ci<manifest.chunks.length;ci++){
    const descriptor=manifest.chunks[ci];if(!history&&descriptor.historical)continue;
    if(textRead>=QUERY_TEXT){continuation=next(di,ci,0);break outer;}let chunk;try{chunk=await this.read(store,descriptor.id,'working',budget);}catch(error){if(error.code==='ERR_SEARCH_BUDGET'){continuation=next(di,ci,0);break outer;}throw error;}
    if(typeof chunk.text!=='string'||chunk.text.length>SEARCH_CHUNK_CHARS||chunk.offset!==descriptor.offset||chunk.version!==descriptor.version)throw fault();textRead+=Buffer.byteLength(chunk.text);
    let from=di===position.doc&&ci===position.chunk?position.from:0;
    for(;;){const match=findSearchMatch(chunk.text,parsed,{from});if(!match)break;from=match.end;
     // Ownership of overlap belongs to the following chunk. Non-terminal
     // numeric boundaries are unknown and must not manufacture complete numbers.
     const following=manifest.chunks[ci+1],endOwned=following?.unit===descriptor.unit?following.offset-chunk.offset:chunk.text.length;
     if(match.start>=endOwned||parsed.numeric&&(!chunk.terminal&&match.end===chunk.text.length||chunk.offset>0&&match.start===0))continue;
     const hitToken=this.sign(owner,{job:token,stamp:doc.stamp,chunk:descriptor.id,start:match.start,end:match.end});hits.push({jobId:entry.id,names:entry.names,version:chunk.version,historical:chunk.historical,kind:chunk.kind,location:chunk.location,sourceId:chunk.sourceId,snippet:searchSnippet(chunk.text,match),token:hitToken});
     if(hits.length>=limit){continuation=next(di,ci,from);break outer;}
    }
   }
  }
  // Check primary truth again after all asynchronous index reads.
  const current=this.catalog(owner);return {hits:hits.filter(hit=>{const token=this.digest(`job:${owner}:${hit.jobId}`);return current.get(token)?.stamp===catalog.get(token)?.stamp;}),cursor:continuation,status,readBytes:QUERY_BYTES-budget.left,textBytes:textRead};
 });}
 open(owner,token){return this.run(owner,async store=>{
  const hit=this.verify(owner,token),root=await this.root(store,owner),catalog=this.catalog(owner),entry=catalog.get(hit.job),doc=root.docs[hit.job];if(!entry||!doc||entry.stamp!==hit.stamp||doc.stamp!==hit.stamp)throw Object.assign(new Error('This search result is no longer current.'),{code:'ERR_SEARCH_STALE'});
  const manifest=await this.manifest(store,doc),descriptor=manifest.chunks.find(item=>item.id===hit.chunk);if(!descriptor)throw Object.assign(new Error('This search result is no longer available.'),{code:'ERR_SEARCH_STALE'});const chunk=await this.read(store,hit.chunk,'working');if(typeof chunk.text!=='string'||!Number.isInteger(hit.start)||!Number.isInteger(hit.end)||hit.start<0||hit.end<=hit.start||hit.end>chunk.text.length)throw new Error('Invalid search result.');
  if(this.catalog(owner).get(hit.job)?.stamp!==hit.stamp)throw Object.assign(new Error('This search result is no longer current.'),{code:'ERR_SEARCH_STALE'});
  return {jobId:entry.id,names:entry.names,version:chunk.version,historical:chunk.historical,kind:chunk.kind,location:chunk.location,sourceId:chunk.sourceId,offset:chunk.offset,text:chunk.text,highlights:[{start:hit.start,end:hit.end}],excerpt:true};
 });}
}
