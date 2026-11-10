// Project only existing searchable text and its saved provenance. Binary originals,
// exports, provider conversations and revision proposals are never hydrated here.
const TEXT_KEYS=new Set(['sourceText','targetText','source','translated','text']);
const META_KEYS=new Set(['id','version','createdAt','fileIndex','page','box','coordinateSpace','extractionMethod','coverageStatus','targetNodeIds','sourceRefs','sourceLocation','location','locations','label','name','type','reason']);
export function projectSearchMaterial(path,first){
 if(!path.length)return;
 const [root,second]=path;
 if(path.length===1)return ['id','owner','status','names'].includes(root)?'value':['result','review'].includes(root)?undefined:'skip';
 if(root==='review'){
  if(path.length===2)return second==='version'?'value':second==='versions'?undefined:'skip';
  if(second!=='versions')return 'skip';
  if(path.length===3)return;
 }
 const offset=root==='review'?3:1,key=path[offset];
 if(path.length===offset+1){
  if(key==='text')return first===34?'text':'value';
  if(key==='document')return 'value';
  if(['sourceInventory','fields','regions'].includes(key))return;
  if(['version','createdAt'].includes(key))return 'value';
  if(key==='context')return;
  return 'skip';
 }
 if(key==='context')return path[offset+1]==='scanCorrections'?'value':'skip';
 if(key==='sourceInventory'){
  const inventoryKey=path[offset+1];
  if(path.length===offset+2)return inventoryKey==='items'?undefined:['schema','truncated','ocrIncomplete','summary'].includes(inventoryKey)?'value':'skip';
  if(inventoryKey!=='items')return 'skip';
  if(path.length===offset+3)return;
  const leaf=path[offset+3];
  if(TEXT_KEYS.has(leaf))return first===34?'text':'value';
  return META_KEYS.has(leaf)?'value':'skip';
 }
 // Inventory/field arrays have one row level; nested provenance is bounded by
 // the reader's value limit rather than recursively loading arbitrary content.
 if(path.length===offset+2)return;
 const leaf=path[offset+2];
 if(TEXT_KEYS.has(leaf))return first===34?'text':'value';
 return META_KEYS.has(leaf)?'value':'skip';
}
