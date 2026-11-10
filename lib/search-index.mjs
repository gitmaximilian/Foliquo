import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {lstat,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {translationProvenance,searchHitLocation} from './search-provenance.mjs';
import {SecureStore} from './secure-store.mjs';
import {foldSearchText,searchGrams,parseSearchQuery,findSearchMatch,searchSnippet} from './search-text.mjs';
import {searchTextUnits,streamSearchChunks,SEARCH_CHUNK_CHARS} from './search-chunks.mjs';
const ROOT='search-root-000000000000000000000000';
const JOURNAL='search-pending-0000000000000000000000';
const INDEX_VERSION=3;
const MAX_OBJECT=8*1024*1024,MAX_GRAMS=4096,MAX_CHUNKS=12000;
const QUERY_BYTES=64*1024*1024,QUERY_TEXT=8*1024*1024;
const objectId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{16,80}$/.test(value);
const fault=(message='The local search index needs rebuilding.')=>Object.assign(new Error(message),{code:'ERR_SEARCH_INDEX'});
function ownerRequired(owner){if(typeof owner!=='string'||!owner||owner.length>256)throw new Error('Search requires an owner.');}
function emptyRoot(owner){return {schema:1,indexVersion:INDEX_VERSION,owner,epoch:randomUUID(),enabled:false,paused:true,docs:{},buckets:{},gc:false};}
function validateRoot(root,owner){if(!root||root.schema!==1||root.owner!==owner||typeof root.epoch!=='string'||!root.docs||!root.buckets||Array.isArray(root.docs)||Array.isArray(root.buckets)||Object.keys(root.docs).length>10000)throw fault();return root;}
/** A derived owner-isolated encrypted index. It is never a source of job truth. */
export class SearchIndex {
 constructor(directory,key,jobStore,{bucketBytes=MAX_OBJECT-64,documentLimit=10000}={}){if(!Number.isInteger(documentLimit)||documentLimit<1||documentLimit>10000)throw new Error('Invalid search document bound.');this.documentLimit=documentLimit;if(!Number.isSafeInteger(bucketBytes)||bucketBytes<1024||bucketBytes>MAX_OBJECT-64)throw new Error('Invalid search bucket bound.');this.bucketBytes=bucketBytes;this.pendingOwners=new Set();this.initializedOwners=new Set();this.directory=join(directory,'search-index');this.key=createHmac('sha256',key).update('foliquo.local-search.v1').digest();this.jobStore=jobStore;this.tail=Promise.resolve();this.errors=new Map();this.owners=new Set();this.controllers=new Map();this.worker=null;this.closed=false;}
 digest(value){return createHmac('sha256',this.key).update(value).digest('hex');}
 store(owner){return new SecureStore(join(this.directory,this.digest(`owner:${owner}`)),this.key);}
 run(owner,work,{reset=false}={}){ownerRequired(owner);this.owners.add(owner);const result=this.tail.catch(()=>{}).then(async()=>{const store=this.store(owner);if(!this.initializedOwners.has(owner)){await store.cleanupInterruptedWrites();this.initializedOwners.add(owner);}const pending=reset?false:await this.recover(store,owner);return work(store,pending);});this.tail=result.catch(()=>{});return result.catch(error=>{if(error.name!=='AbortError'&&error.code==='ERR_SEARCH_INDEX')this.errors.set(owner,true);throw error;});}
 async recover(store,owner,{limit=128}={}){
  try{await lstat(store.path(JOURNAL,'recovery'));}catch(error){if(error.code==='ENOENT'){this.pendingOwners.delete(owner);return false;}throw fault();}
  const journal=await this.read(store,JOURNAL,'recovery');if(journal?.schema!==1)throw fault();
  if(!Array.isArray(journal.cleanup)){const root=await this.root(store,owner);journal.cleanup=root.epoch===journal.nextEpoch?journal.obsolete:journal.created;}
  if(!Array.isArray(journal.cleanup)||journal.cleanup.length>100000||journal.cleanup.some(item=>!item||!objectId(item.id)||item.id===ROOT||!['record','working'].includes(item.type)))throw fault();
  // Persist the decision before cleanup; a later pause/configuration cannot
  // change which immutable objects belong to the committed root.
  await this.write(store,JOURNAL,{schema:1,cleanup:journal.cleanup},'recovery');
  const count=Math.min(limit,journal.cleanup.length);for(let index=0;index<count;index++)await store.remove(journal.cleanup[index].id,journal.cleanup[index].type);
  const remaining=journal.cleanup.slice(count);if(remaining.length){await this.write(store,JOURNAL,{schema:1,cleanup:remaining},'recovery');this.pendingOwners.add(owner);return true;}
  await store.remove(JOURNAL,'recovery');this.pendingOwners.delete(owner);return false;
 }
 async read(store,id,type='record',budget){
  if(!objectId(id))throw fault();
  try{const info=await lstat(store.path(id,type));if(!info.isFile()||info.isSymbolicLink()||info.size>MAX_OBJECT)throw fault();if(budget){if(info.size>budget.left)throw Object.assign(new Error('Search read budget reached.'),{code:'ERR_SEARCH_BUDGET'});budget.left-=info.size;}return JSON.parse((await store.read(id,type)).toString('utf8'));}
  catch(error){if(error.code==='ERR_SEARCH_BUDGET')throw error;throw fault();}
 }
 async root(store,owner){try{await lstat(store.path(ROOT,'record'));}catch(error){if(error.code==='ENOENT')return emptyRoot(owner);throw fault();}const root=validateRoot(await this.read(store,ROOT),owner);if(root.indexVersion!==INDEX_VERSION){const rebuilt={...emptyRoot(owner),enabled:root.enabled===true,paused:root.paused===true,gc:true};await this.write(store,ROOT,rebuilt);return rebuilt;}return root;}
 async write(store,id,value,type='record'){const bytes=Buffer.from(JSON.stringify(value));if(bytes.length>MAX_OBJECT-64)throw fault('The local search index exceeds its object limit.');await store.write(id,type,bytes);}
 catalog(owner){return new Map(this.jobStore.searchCatalog({owner}).map(entry=>[this.digest(`job:${owner}:${entry.id}`),entry]));}
 snapshot(root,catalog){let complete=0,partial=0,missingSource=0,limited=0;for(const [token,entry]of catalog){const doc=root.docs[token];if(!doc||doc.stamp!==entry.stamp)continue;if(doc.complete)complete++;else partial++;if(doc.complete&&!doc.sourceAvailable)missingSource++;if(doc.sourceLimited||doc.limited)limited++;}return {enabled:root.enabled===true,paused:root.paused===true,phase:root.gc||this.pendingOwners.has(root.owner)?'cleaning':root.paused?'paused':complete===catalog.size?'ready':complete>=this.documentLimit?'limited':'building',total:catalog.size,documentLimit:this.documentLimit,documentLimitReached:catalog.size>this.documentLimit,complete,partial,pending:catalog.size-complete,missingSource,limited,incomplete:complete<catalog.size||root.gc===true||this.pendingOwners.has(root.owner)};}
 status(owner){return this.run(owner,async store=>{try{return {...this.snapshot(await this.root(store,owner),this.catalog(owner)),error:this.errors.has(owner)};}catch(error){if(error.code!=='ERR_SEARCH_INDEX')throw error;return {enabled:false,paused:true,phase:'error',total:this.catalog(owner).size,complete:0,partial:0,pending:this.catalog(owner).size,incomplete:true,error:true};}});}
 configure(owner,{rebuild=false,paused=false}={}){ownerRequired(owner);if(typeof rebuild!=='boolean'||typeof paused!=='boolean')throw new Error('Invalid search configuration.');if(paused||rebuild)this.controllers.get(owner)?.abort();return this.run(owner,async store=>{const root=rebuild?emptyRoot(owner):await this.root(store,owner);root.enabled=true;root.paused=paused;if(rebuild)root.gc=true;await this.write(store,ROOT,root);if(rebuild){await store.remove(JOURNAL,'recovery');this.pendingOwners.delete(owner);}this.errors.delete(owner);return this.snapshot(root,this.catalog(owner));},{reset:rebuild});}
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
 async publish(store,root,updates,stage,transaction){
  const changes=new Map();
  const change=hash=>{const prefix=hash.slice(0,2);if(!changes.has(prefix))changes.set(prefix,new Map());const bucket=changes.get(prefix);if(!bucket.has(hash))bucket.set(hash,{remove:new Set(),add:new Set()});return bucket.get(hash);};
  for(const {token,oldManifest,newManifest}of updates){for(const hash of oldManifest?.grams||[])change(hash).remove.add(token);for(const hash of newManifest?.grams||[])change(hash).add.add(token);}
  // Only one bounded posting bucket is hydrated at a time, even when an update
  // affects every prefix. High-entropy archives cannot accumulate 256 buckets.
  for(const [prefix,actions]of changes){
   const oldId=root.buckets[prefix],value=oldId?await this.read(store,oldId):{};if(!value||typeof value!=='object'||Array.isArray(value))throw fault();
   for(const [hash,action]of actions){const list=value[hash]||[];if(!Array.isArray(list))throw fault();const keep=list.filter(token=>!action.remove.has(token));if(keep.length)value[hash]=keep;else delete value[hash];}
   let size=Buffer.byteLength(JSON.stringify(value)),keys=Object.keys(value).length;const entrySize=(hash,list)=>Buffer.byteLength(JSON.stringify({[hash]:list}))-2;
   for(const [hash,action]of actions)for(const token of action.add){
    const previous=value[hash];if(previous?.includes(token))continue;const list=[...(previous||[]),token],nextSize=size+entrySize(hash,list)-(previous?entrySize(hash,previous):0)+(!previous&&keys>0?1:0);
    if(nextSize>this.bucketBytes){if(root.docs[token])root.docs[token].broad=true;continue;}
    value[hash]=list;size=nextSize;if(!previous)keys++;
   }
   if(keys){const id=randomUUID();await stage(id,value);root.buckets[prefix]=id;}else delete root.buckets[prefix];if(oldId)transaction.obsolete.push({id:oldId,type:'record'});
  }
  root.epoch=transaction.nextEpoch;await this.write(store,JOURNAL,transaction,'recovery');await this.write(store,ROOT,root);
 }
 step(owner,{signal,maxJobs=8,maxChars=4*1024*1024}={}){return this.run(owner,async(store,pending)=>{
  if(!Number.isInteger(maxJobs)||maxJobs<1||maxJobs>8||!Number.isInteger(maxChars)||maxChars<SEARCH_CHUNK_CHARS||maxChars>4*1024*1024)throw new Error('Invalid search work limits.');
  signal?.throwIfAborted();const root=await this.root(store,owner),catalog=this.catalog(owner);if(!root.enabled||pending)return this.snapshot(root,catalog);
  if(root.gc){await this.collectGarbage(store,root);signal?.throwIfAborted();await this.write(store,ROOT,root);return this.snapshot(root,catalog);}
  const created=[],obsolete=[],updates=[],transaction={schema:1,nextEpoch:randomUUID(),created,obsolete};let started=false,settled=false,worked=0,chars=0;
  const stage=async(id,value,type='record')=>{created.push({id,type});started=true;await this.write(store,JOURNAL,transaction,'recovery');await this.write(store,id,value,type);};
  try{
   // Stale entries cannot be returned by query even before this bounded cleanup.
   for(const [token,doc]of Object.entries(root.docs)){if(worked>=maxJobs)break;const entry=catalog.get(token);if(entry&&entry.stamp===doc.stamp)continue;const old=await this.manifest(store,doc);updates.push({token,oldManifest:old});obsolete.push({id:doc.manifestId,type:'record'},...old.chunks.map(chunk=>({id:chunk.id,type:'working'})));delete root.docs[token];worked++;}
   let documentCount=Object.keys(root.docs).length;
   for(const [token,entry]of catalog){
    if(root.paused)break;signal?.throwIfAborted();if(worked>=maxJobs||maxChars-chars<SEARCH_CHUNK_CHARS)break;
    const previous=root.docs[token];if(previous&&previous.stamp!==entry.stamp)continue;if(previous?.complete||!previous&&documentCount>=this.documentLimit)continue;
    const old=previous?await this.manifest(store,previous):null,manifest=old?structuredClone(old):{chunks:[],grams:[],cursor:{unit:0,offset:0},broad:false,limited:false};manifest.broad||=previous?.broad===true;const grams=new Set(manifest.grams);let complete=false,sourceAvailable=previous?.sourceAvailable===true,sourceLimited=true;
    const valid=await this.jobStore.withSearchMaterial(entry.id,owner,entry.stamp,async(material,withText)=>{
     const units=searchTextUnits(material);sourceLimited=units.sourceLimited;
     for(let unitIndex=manifest.cursor.unit;unitIndex<units.units.length;unitIndex++){
      signal?.throwIfAborted();if(maxChars-chars<SEARCH_CHUNK_CHARS)return true;
      const unit=units.units[unitIndex];
      if(manifest.chunks.length>=MAX_CHUNKS){manifest.limited=true;complete=true;return true;}
      const provenance=translationProvenance(unit),textHash=provenance?createHash('sha256'):null,readText=provenance?(value,path,consume)=>withText(value,path,source=>consume((async function*(){for await(const bytes of source){textHash.update(bytes);yield bytes;}})())):withText;
      const state=await streamSearchChunks(readText,unit.value,unit.path,async chunk=>{
       if(manifest.chunks.length>=MAX_CHUNKS)throw Object.assign(new Error('Search chunk limit.'),{code:'ERR_SEARCH_CHUNKS'});
       if(unit.kind==='source'&&!unit.historical&&/\S/u.test(chunk.text))sourceAvailable=true;
       const id=randomUUID(),stored={...chunk,unit:unitIndex,kind:unit.kind,version:unit.version,historical:unit.historical,sourceId:unit.sourceId||null,location:unit.location};
       await stage(id,stored,'working');manifest.chunks.push({id,unit:unitIndex,offset:chunk.offset,bytes:Buffer.byteLength(chunk.text),kind:unit.kind,version:unit.version,historical:unit.historical});chars+=chunk.text.length;
       if(!manifest.broad)for(const gram of searchGrams(foldSearchText(chunk.text))){grams.add(this.digest(`gram:${gram}`));if(grams.size>=MAX_GRAMS){manifest.broad=true;break;}}
      },{signal,startOffset:manifest.cursor.offset,maxChars:Math.max(SEARCH_CHUNK_CHARS,maxChars-chars)}).catch(error=>{if(error.code!=='ERR_SEARCH_CHUNKS')throw error;return {done:false,limited:true,nextOffset:manifest.cursor.offset};});
      if(state.done&&provenance&&textHash.digest('hex')===provenance.digest){const maps={...(manifest.maps||{}),[unitIndex]:provenance.spans};if(Buffer.byteLength(JSON.stringify(maps))<=2*1024*1024)manifest.maps=maps;else manifest.mappingLimited=true;}
      manifest.limited||=state.limited;manifest.cursor=state.done||state.limited?{unit:unitIndex+1,offset:0}:{unit:unitIndex,offset:state.nextOffset};if(!state.done&&!state.limited)return true;
     }
     complete=true;return true;
    },{signal});
    if(!valid){for(const chunk of manifest.chunks.slice(old?.chunks.length||0)){await store.remove(chunk.id,'working').catch(()=>{});}continue;}
    manifest.grams=[...grams];const manifestId=randomUUID();await stage(manifestId,manifest);if(previous)obsolete.push({id:previous.manifestId,type:'record'});
    if(!previous)documentCount++;root.docs[token]={id:entry.id,stamp:entry.stamp,manifestId,complete,sourceAvailable,sourceLimited,limited:manifest.limited,broad:manifest.broad};updates.push({token,oldManifest:old,newManifest:manifest});worked++;
   }
   signal?.throwIfAborted();if(updates.length){started=true;await this.write(store,JOURNAL,transaction,'recovery');await this.publish(store,root,updates,stage,transaction);}if(started)await this.recover(store,owner);settled=true;this.errors.delete(owner);return {...this.snapshot(root,this.catalog(owner)),worked,characters:chars};
  }finally{if(started&&!settled)await this.recover(store,owner).catch(()=>{this.errors.set(owner,true);});}
 });}
 sign(owner,value){const payload=Buffer.from(JSON.stringify(value)).toString('base64url'),signature=this.digest(`token:${owner}:${payload}`);return `${payload}.${signature}`;}
 verify(owner,token){if(typeof token!=='string'||token.length>4096)throw new Error('Invalid search token.');const [payload,signature,...rest]=token.split('.'),expected=this.digest(`token:${owner}:${payload}`);if(rest.length||!signature||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))throw new Error('Invalid search token.');try{return JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));}catch{throw new Error('Invalid search token.');}}
 query(owner,{query,history=false,cursor=null,limit=25}={}){return this.run(owner,async store=>{
  const parsed=parseSearchQuery(query);if(typeof history!=='boolean'||!Number.isInteger(limit)||limit<1||limit>25)throw new Error('Invalid search options.');const root=await this.root(store,owner),catalog=this.catalog(owner),status=this.snapshot(root,catalog);if(!root.enabled||root.gc)return {hits:[],cursor:null,status};
  const catalogStamp=this.digest(JSON.stringify([...catalog].map(([token,entry])=>[token,entry.stamp]).sort((a,b)=>a[0].localeCompare(b[0])))),digest=this.digest(`query:${JSON.stringify([parsed.folded,parsed.numeric,history])}`),position=cursor?this.verify(owner,cursor):{doc:0,chunk:0,from:0};if(cursor&&(position.query!==digest||position.epoch!==root.epoch||position.catalog!==catalogStamp))throw Object.assign(new Error('The search changed. Please search again.'),{code:'ERR_SEARCH_CURSOR'});
  if(![position.doc,position.chunk,position.from].every(value=>Number.isSafeInteger(value)&&value>=0))throw new Error('Invalid search cursor.');
  const budget={left:QUERY_BYTES},selected=[...new Set([parsed.grams[0],parsed.grams[Math.floor(parsed.grams.length/2)],parsed.grams.at(-1)])],cache=new Map();let candidates=null;
  for(const gram of selected){const hash=this.digest(`gram:${gram}`),prefix=hash.slice(0,2),id=root.buckets[prefix];let postings=[];if(id){if(!cache.has(prefix))cache.set(prefix,await this.read(store,id,'record',budget));postings=cache.get(prefix)[hash]||[];if(!Array.isArray(postings))throw fault();}const set=new Set(postings);candidates=candidates===null?set:new Set([...candidates].filter(token=>set.has(token)));}
  for(const [token,doc]of Object.entries(root.docs))if(doc.broad)candidates.add(token);
  const ordered=[...candidates].filter(token=>catalog.has(token)&&root.docs[token]?.stamp===catalog.get(token).stamp).sort(),hits=[];let textRead=0,scanned=0,continuation=null;
  const next=(doc,chunk,from)=>this.sign(owner,{epoch:root.epoch,catalog:catalogStamp,query:digest,doc,chunk,from});
  outer:for(let di=position.doc;di<ordered.length;di++){
   if(scanned++>=64){continuation=next(di,0,0);break;}const token=ordered[di],doc=root.docs[token],entry=catalog.get(token);let manifest;
   try{manifest=await this.manifest(store,doc,budget);}catch(error){if(error.code==='ERR_SEARCH_BUDGET'){continuation=next(di,di===position.doc?position.chunk:0,di===position.doc?position.from:0);break;}throw error;}
   for(let ci=di===position.doc?position.chunk:0;ci<manifest.chunks.length;ci++){
    const descriptor=manifest.chunks[ci];if(!history&&descriptor.historical)continue;
    if(textRead+(descriptor.bytes??3*SEARCH_CHUNK_CHARS)>QUERY_TEXT){continuation=next(di,ci,0);break outer;}let chunk;try{chunk=await this.read(store,descriptor.id,'working',budget);}catch(error){if(error.code==='ERR_SEARCH_BUDGET'){continuation=next(di,ci,0);break outer;}throw error;}
    if(typeof chunk.text!=='string'||chunk.text.length>SEARCH_CHUNK_CHARS||chunk.offset!==descriptor.offset||chunk.version!==descriptor.version||descriptor.bytes!==Buffer.byteLength(chunk.text))throw fault();textRead+=descriptor.bytes;
    let from=di===position.doc&&ci===position.chunk?position.from:0;
    for(;;){const match=findSearchMatch(chunk.text,parsed,{from});if(!match)break;from=match.end;
     // Ownership of overlap belongs to the following chunk. Non-terminal
     // numeric boundaries are unknown and must not manufacture complete numbers.
     const following=manifest.chunks[ci+1],endOwned=following?.unit===descriptor.unit?following.offset-chunk.offset:chunk.text.length;
     if(match.start>=endOwned||parsed.numeric&&(!chunk.terminal&&match.end===chunk.text.length||chunk.offset>0&&match.start===0))continue;
     const hitToken=this.sign(owner,{job:token,stamp:doc.stamp,chunk:descriptor.id,start:match.start,end:match.end});hits.push({jobId:entry.id,names:entry.names,version:chunk.version,historical:chunk.historical,kind:chunk.kind,location:searchHitLocation(manifest,chunk,match),sourceId:chunk.sourceId,snippet:searchSnippet(chunk.text,match),token:hitToken});
     if(hits.length>=limit){continuation=next(di,ci,from);break outer;}
    }
   }
  }
  // Check primary truth again after all asynchronous index reads.
  const current=this.catalog(owner);return {hits:hits.filter(hit=>{const token=this.digest(`job:${owner}:${hit.jobId}`);return current.get(token)?.stamp===catalog.get(token)?.stamp;}),cursor:continuation,status,readBytes:QUERY_BYTES-budget.left,textBytes:textRead};
 });}
 open(owner,token){return this.run(owner,async store=>{
  const hit=this.verify(owner,token),root=await this.root(store,owner),catalog=this.catalog(owner),entry=catalog.get(hit.job),doc=root.docs[hit.job];if(!entry||!doc||entry.stamp!==hit.stamp||doc.stamp!==hit.stamp)throw Object.assign(new Error('This search result is no longer current.'),{code:'ERR_SEARCH_STALE'});
  const manifest=await this.manifest(store,doc),chunkIndex=manifest.chunks.findIndex(item=>item.id===hit.chunk),descriptor=manifest.chunks[chunkIndex];if(!descriptor)throw Object.assign(new Error('This search result is no longer available.'),{code:'ERR_SEARCH_STALE'});const chunk=await this.read(store,hit.chunk,'working');if(typeof chunk.text!=='string'||!Number.isInteger(hit.start)||!Number.isInteger(hit.end)||hit.start<0||(!hit.browse&&hit.end<=hit.start)||(hit.browse&&(hit.start!==0||hit.end!==0))||hit.end>chunk.text.length)throw new Error('Invalid search result.');
  if(this.catalog(owner).get(hit.job)?.stamp!==hit.stamp)throw Object.assign(new Error('This search result is no longer current.'),{code:'ERR_SEARCH_STALE'});
  const navigationToken=descriptor=>descriptor&&descriptor.unit===chunk.unit?this.sign(owner,{job:hit.job,stamp:hit.stamp,chunk:descriptor.id,start:0,end:0,browse:true}):null;
  const following=manifest.chunks[chunkIndex+1],ownedEnd=following?.unit===chunk.unit?following.offset-chunk.offset:chunk.text.length,text=hit.browse?chunk.text.slice(0,ownedEnd):chunk.text;
  return {jobId:entry.id,names:entry.names,version:chunk.version,historical:chunk.historical,kind:chunk.kind,location:searchHitLocation(manifest,chunk,hit.browse?{start:0,end:text.length}:hit),sourceId:chunk.sourceId,offset:chunk.offset,text,highlights:hit.browse?[]:[{start:hit.start,end:hit.end}],excerpt:true,tailUnavailable:following?.unit!==chunk.unit&&!chunk.terminal,navigation:{first:navigationToken(manifest.chunks.find(item=>item.unit===chunk.unit)),previous:navigationToken(manifest.chunks[chunkIndex-1]),next:navigationToken(following)}};
 });}
}
