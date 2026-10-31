const TYPES=new Set(['heading','paragraph','table','stamp','list','pageBreak']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fail=()=>{throw new Error('Dokumentstruktur ist ungültig. Der gespeicherte Text bleibt unverändert.');};
const text=(value,max)=>typeof value==='string'&&value.length<=max&&!value.includes('\0');
const onlyKeys=(value,allowed)=>{if(Object.keys(value).some(key=>!allowed.has(key)))fail();};
function simpleObject(value,maxEntries,maxText){if(!plain(value)||Object.keys(value).length>maxEntries)fail();for(const [key,item]of Object.entries(value)){if(!/^[A-Za-z][A-Za-z0-9_-]{0,49}$/.test(key)||!(typeof item==='boolean'||typeof item==='number'&&Number.isFinite(item)||typeof item==='string'&&text(item,maxText)))fail();}}

function validateRefs(refs){
 if(!Array.isArray(refs)||refs.length>20000)fail();const ids=new Set();
 for(const ref of refs){if(!plain(ref))fail();onlyKeys(ref,new Set(['id','fileIndex','page','box','hash']));if(!text(ref.id,100)||ids.has(ref.id)||!Number.isInteger(ref.fileIndex)||ref.fileIndex<0||ref.fileIndex>9||!Number.isInteger(ref.page)||ref.page<1||ref.page>10000)fail();ids.add(ref.id);
  if(ref.box!==null&&ref.box!==undefined&&(!Array.isArray(ref.box)||ref.box.length!==4||!ref.box.every(n=>Number.isFinite(n)&&n>=0&&n<=1)||ref.box[2]<=0||ref.box[3]<=0||ref.box[0]+ref.box[2]>1||ref.box[1]+ref.box[3]>1))fail();
  if(ref.hash!==undefined&&!/^[a-f0-9]{64}$/.test(ref.hash))fail();
 }
}
function validateBlock(block,ids){
 if(!plain(block)||!text(block.id,100)||ids.has(block.id)||!TYPES.has(block.type))fail();
 const common=['id','type','sourceBlockIds','properties'],shape=block.type==='table'?['rows','relativeColumnWidths','rowDelimiters','keepRows']:block.type==='list'?['items']:block.type==='pageBreak'?[]:['content'];onlyKeys(block,new Set([...common,...shape]));ids.add(block.id);
 if(block.sourceBlockIds!==undefined&&(!Array.isArray(block.sourceBlockIds)||block.sourceBlockIds.length>200||block.sourceBlockIds.some(id=>!text(id,100))))fail();
 if(block.type==='table'){
  if(!Array.isArray(block.rows)||block.rows.length<1||block.rows.length>1000||!Array.isArray(block.relativeColumnWidths)||block.relativeColumnWidths.length<1||block.relativeColumnWidths.length>20||!block.relativeColumnWidths.every(width=>Number.isFinite(width)&&width>0&&width<=100)||Math.abs(block.relativeColumnWidths.reduce((a,b)=>a+b,0)-100)>0.1)fail();
  for(const row of block.rows){if(!Array.isArray(row)||row.length<1||row.length>block.relativeColumnWidths.length)fail();for(const cell of row){if(!plain(cell))fail();onlyKeys(cell,new Set(['id','text','sourceBlockIds']));if(!text(cell.id,100)||ids.has(cell.id)||!text(cell.text,1000000)||cell.text.includes('\n'))fail();ids.add(cell.id);if(cell.sourceBlockIds!==undefined&&(!Array.isArray(cell.sourceBlockIds)||cell.sourceBlockIds.length>200||cell.sourceBlockIds.some(id=>!text(id,100))))fail();}}
  if(block.rowDelimiters!==undefined&&(!Array.isArray(block.rowDelimiters)||block.rowDelimiters.length!==block.rows.length||block.rowDelimiters.some(delimiter=>delimiter!==' | '&&delimiter!=='\t')))fail();
  if(block.keepRows!==undefined&&typeof block.keepRows!=='boolean')fail();
 }else if(block.type==='list'){
  if(!Array.isArray(block.items)||block.items.length<1||block.items.length>1000||block.items.some(item=>!text(item,1000000)))fail();
 }else if(block.type==='pageBreak'){
  if(block.content!==undefined&&block.content!=='')fail();
 }else if(!text(block.content,1000000))fail();
 if(block.properties!==undefined)simpleObject(block.properties,20,500);
 if(block.type==='stamp'&&block.properties?.marker!==undefined&&(!text(block.properties.marker,100)||!/^(?:\s*(?:Stempel|Stamp|ختم)\s*:\s*)$/iu.test(block.properties.marker)))fail();
}

export function validateDocumentModel(value){
 if(!plain(value))fail();onlyKeys(value,new Set(['schema','language','direction','blocks','layout','sourceRefs','legacy']));if(value.schema!==1||!text(value.language,50)||!['ltr','rtl','auto'].includes(value.direction)||!Array.isArray(value.blocks)||value.blocks.length>20000)fail();
 if(value.layout!==undefined&&value.layout!==null)simpleObject(value.layout,40,1000);
 if(value.legacy!==undefined){if(!plain(value.legacy))fail();onlyKeys(value.legacy,new Set(['trailingNewline']));if(typeof value.legacy.trailingNewline!=='boolean')fail();}
 validateRefs(value.sourceRefs===undefined?[]:value.sourceRefs);const ids=new Set();let contentLength=0;for(const block of value.blocks){validateBlock(block,ids);if(block.type==='table')contentLength+=block.rows.reduce((total,row)=>total+row.reduce((sum,cell)=>sum+cell.text.length,0),0);else if(block.type==='list')contentLength+=block.items.reduce((sum,item)=>sum+item.length,0);else if(block.type!=='pageBreak')contentLength+=block.content.length;if(contentLength>1000000)fail();}
 return value;
}

export function createDocumentModel({language='Deutsch',direction='auto',blocks=[],layout=null,sourceRefs=[],legacy={trailingNewline:false}}={}){
 return validateDocumentModel({schema:1,language,direction,blocks,layout,sourceRefs,legacy});
}
