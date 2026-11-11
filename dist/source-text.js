let workerPromise;
async function localOcr(canvas){
 if(!workerPromise)workerPromise=(async()=>{const module=await import('/vendor/tesseract/tesseract.esm.min.js'),createWorker=module.createWorker||module.default?.createWorker;if(typeof createWorker!=='function')throw new Error('Local text recognition is unavailable.');return createWorker(['ara','deu','eng'],1,{workerPath:new URL('/vendor/tesseract/worker.min.js',location.href).href,corePath:new URL('/vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js',location.href).href,langPath:new URL('/vendor/tesseract/lang/',location.href).href,cacheMethod:'write',logger:()=>{}})})();
 const worker=await workerPromise;const {data}=await worker.recognize(canvas,{}, {blocks:true});
 const words=[];for(const block of data.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[])for(const word of line.words||[])if(word.text?.trim())words.push({text:word.text,x:word.bbox.x0,y:word.bbox.y0,w:word.bbox.x1-word.bbox.x0,h:word.bbox.y1-word.bbox.y0});
 return {text:data.text||'',words};
}
window.FoliquoSourceText={localOcr};
