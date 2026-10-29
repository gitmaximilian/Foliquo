let workerPromise;
async function localOcr(canvas){
 if(!workerPromise)workerPromise=(async()=>{const {createWorker}=await import('/vendor/tesseract/tesseract.esm.min.js');return createWorker(['ara','deu','eng'],1,{workerPath:'/vendor/tesseract/worker.min.js',corePath:'/vendor/tesseract/core',langPath:'/vendor/tesseract/lang/',cacheMethod:'write',logger:()=>{}})})();
 const worker=await workerPromise;const {data}=await worker.recognize(canvas,{}, {blocks:true});
 const words=[];for(const block of data.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[])for(const word of line.words||[])if(word.text?.trim())words.push({text:word.text,x:word.bbox.x0,y:word.bbox.y0,w:word.bbox.x1-word.bbox.x0,h:word.bbox.y1-word.bbox.y0});
 return {text:data.text||'',words};
}
window.FoliquoSourceText={localOcr};
