// Pure geometry shared by the original viewers and their regression tests.
function sourceZoomAnchor(oldScale,newScale,scrollLeft,scrollTop,x,y,oldOffset=0,newOffset=0){
 return {left:(scrollLeft+x-oldOffset)/oldScale*newScale+newOffset-x,top:(scrollTop+y)/oldScale*newScale-y};
}
function sourceRegionScale(width,height,viewportWidth,viewportHeight,box,minScale,maxScale=8){
 if(!Array.isArray(box)||box.length!==4||!box.every(Number.isFinite)||box[2]<=0||box[3]<=0)return minScale;
 return Math.max(minScale,Math.min(maxScale,viewportWidth*.8/(width*box[2]),viewportHeight*.8/(height*box[3])));
}
