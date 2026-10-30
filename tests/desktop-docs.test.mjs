import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=new URL('../',import.meta.url);
test('desktop feature and setup documentation point to current packages and source branch',async()=>{
 const features=await readFile(fileURLToPath(new URL('FEATURES.md',root)),'utf8'),guide=await readFile(fileURLToPath(new URL('docs/DESKTOP-APPS.md',root)),'utf8');
 assert.match(features,/docs\/DESKTOP-APPS\.md/);assert.doesNotMatch(features,/DESKTOP-PREVIEW\.md|Preview downloads are retained for 30 days/);
 assert.match(guide,/tree\/main/);assert.doesNotMatch(guide,/tree\/codex\/native-desktop/);
});
