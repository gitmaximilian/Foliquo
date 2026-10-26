// Pure geometry shared by the original viewers and their regression tests.
function sourceZoomAnchor(oldScale,newScale,scrollLeft,scrollTop,x,y,oldOffset=0,newOffset=0){
 return {left:(scrollLeft+x-oldOffset)/oldScale*newScale+newOffset-x,top:(scrollTop+y)/oldScale*newScale-y};
}
function sourceRegionScale(width,height,viewportWidth,viewportHeight,box,minScale,maxScale=8){
 if(!Array.isArray(box)||box.length!==4||!box.every(Number.isFinite)||box[2]<=0||box[3]<=0)return minScale;
 return Math.max(minScale,Math.min(maxScale,viewportWidth*.8/(width*box[2]),viewportHeight*.8/(height*box[3])));
}
function adjustCropRect(rect,key,step=.01){
 if(key==='Enter')return rect||[.1,.1,.8,.8];
 if(key==='Delete'||key==='Backspace')return null;
 const resize=key.startsWith('Shift+'),direction=resize?key.slice(6):key;
 if(!rect||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(direction))return rect;
 const [x,y,w,h]=rect,amount=Math.max(.001,Math.min(.1,step));
 if(resize){if(direction==='ArrowLeft')return [x,y,Math.max(.025,w-amount),h];if(direction==='ArrowRight')return [x,y,Math.min(1-x,w+amount),h];if(direction==='ArrowUp')return [x,y,w,Math.max(.025,h-amount)];return [x,y,w,Math.min(1-y,h+amount)];}
 if(direction==='ArrowLeft')return [Math.max(0,x-amount),y,w,h];
 if(direction==='ArrowRight')return [Math.min(1-w,x+amount),y,w,h];
 if(direction==='ArrowUp')return [x,Math.max(0,y-amount),w,h];
 return [x,Math.min(1-h,y+amount),w,h];
}
