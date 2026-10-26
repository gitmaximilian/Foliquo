import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFile(join(root, path), 'utf8');

test('Foliquo Community branding is used by the application and package metadata', async () => {
  const [html, demo, packageJson, lock] = await Promise.all([
    read('dist/index.html'), read('dist/demo/index.html'), read('package.json'), read('package-lock.json'),
  ]);
  assert.match(html, /<title>Foliquo/);
  assert.match(html, /Foliquo Community/);
  assert.doesNotMatch(html.replace(/https:\/\/github\.com\/gitmaximilian\/TranslateOCR[^\"']*/g, ''), /TranslateOCR/);
  assert.match(demo, /Foliquo/);
  assert.doesNotMatch(demo, /TranslateOCR/);
  assert.equal(JSON.parse(packageJson).name, 'foliquo');
  assert.equal(JSON.parse(lock).name, 'foliquo');
});

test('both approved brand editions are shipped and the workspace selects Community', async () => {
  const [html, logo, standard, community, cover] = await Promise.all([
    read('dist/index.html'), read('dist/brand/foliquo-logo.js'),
    read('dist/brand/standard/svg/icon-color.svg'), read('dist/brand/community/svg/icon-color.svg'),
    read('docs/images/cover.svg'),
  ]);
  assert.match(html, /data-brand-edition="community"/);
  assert.match(logo, /standard/);
  assert.match(logo, /community/);
  assert.match(standard, /<svg/);
  assert.match(community, /<svg/);
  assert.match(cover, /foliquo/);
  assert.doesNotMatch(cover, /Foliquo/);
});
