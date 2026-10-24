import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const scope=vm.createContext({});
vm.runInContext(await readFile(new URL('../dist/source-geometry.js',import.meta.url),'utf8'),scope);
test('Image zoom keeps the source point under the cursor when enlarging and reducing',()=>{
 const at=scope.sourceZoomAnchor(.5,2,30,40,90,100);
 assert.equal(at.left,390);assert.equal(at.top,460);
 const back=scope.sourceZoomAnchor(2,.5,at.left,at.top,90,100);
 assert.equal(back.left,30);assert.equal(back.top,40);
});
test('Centered fitted images preserve cursor position when becoming wider than the viewport',()=>{
 const at=scope.sourceZoomAnchor(.5,2,0,0,150,100,50,0);
 assert.equal(at.left,250);assert.equal(at.top,300);
});
test('Zoom to a source box fits the highlighted region and respects upper and lower bounds',()=>{
 assert.equal(scope.sourceRegionScale(2000,3000,500,400,[.2,.3,.1,.1],.2),400*.8/300);
 assert.equal(scope.sourceRegionScale(2000,3000,500,400,[0,0,.0001,.0001],.2),8);
 assert.equal(scope.sourceRegionScale(2000,3000,500,400,[0,0,1,1],.2),.2);
 assert.equal(scope.sourceRegionScale(2000,3000,500,400,null,.2),.2);
});
