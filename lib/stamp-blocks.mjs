// A stamp is one bordered block with its source line breaks intact.
// The marker is an editing aid and is not printed inside the export.
export function stampBlocks(text){
 const lines=String(text).split('\n'),blocks=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(!/^\s*(?:Stempel|Stamp|ختم)\s*:\s*$/iu.test(line)){
   blocks.push({type:'line',value:line});
   continue;
  }
  const content=[];
  while(i+1<lines.length&&lines[i+1].trim())content.push(lines[++i].trim());
  if(content.length)blocks.push({type:'stamp',lines:content});
  else blocks.push({type:'line',value:line});
 }
 return blocks;
}
