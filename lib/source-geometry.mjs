const clamp=value=>Math.round(Math.max(0,Math.min(1,value))*1_000_000)/1_000_000;

function unrotateBox(box,degrees){
 const [x,y,width,height]=box;
 if(degrees===90)return [y,1-x-width,height,width];
 if(degrees===180)return [1-x-width,1-y-height,width,height];
 if(degrees===270)return [1-y-height,x,height,width];
 return [...box];
}

function expandCrop(box,crop){
 if(!crop)return box;
 return [crop[0]+box[0]*crop[2],crop[1]+box[1]*crop[3],box[2]*crop[2],box[3]*crop[3]];
}

/** Convert extracted locations on a corrected working copy back to original file pages and normalized boxes. */
export function locationsOnOriginal(entries=[],corrections=[],fileTypes=[]){
 if(!Array.isArray(entries)||!Array.isArray(corrections)||!Array.isArray(fileTypes))throw new Error('Quellpositionen sind ungültig.');
 const byFile=new Map(corrections.filter(item=>item&&Number.isInteger(item.fileIndex)).map(item=>[item.fileIndex,item]));
 return entries.map(entry=>{
  if(!entry||!Number.isInteger(entry.fileIndex)||!Number.isInteger(entry.page))return entry;
  const correction=byFile.get(entry.fileIndex);if(!correction)return {...entry};
  const workingPage=entry.page,originalPage=Array.isArray(correction.pageOrder)?correction.pageOrder[workingPage-1]:workingPage;
  if(!Number.isInteger(originalPage)||originalPage<1)return {...entry,box:null};
  let box=Array.isArray(entry.box)&&entry.box.length===4?entry.box.map(clamp):null;
  if(box){
   box=unrotateBox(box,correction.rotation||0);
   const isPdf=fileTypes[entry.fileIndex]==='application/pdf';
   const crop=isPdf?correction.crops?.[workingPage]:workingPage===1?correction.crop:null;
   if(Array.isArray(crop)&&crop.length===4)box=expandCrop(box,crop).map(clamp);
  }
  return {...entry,page:originalPage,box};
 });
}
