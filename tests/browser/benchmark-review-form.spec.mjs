import {test,expect} from '@playwright/test';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const benchmarkScript=fileURLToPath(new URL('../../scripts/benchmark.mjs',import.meta.url));

test('local expert review form safely collects ratings offline and exports its rubric',async({page})=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-review-form-'));
 try{
  const fixturePath=join(directory,'fixtures.json'),resultsPath=join(directory,'results.json'),output=join(directory,'benchmark');
  await writeFile(fixturePath,JSON.stringify([{id:'fictional-01',name:'Fictional certificate',documentType:'certificate',sourceLanguage:'English',targetLanguage:'German',source:'<script>window.neverRun=true</script> source',expected:{names:['Alex Beispiel'],dates:[],numbers:[],content:[],regions:0}}]));
  await writeFile(resultsPath,JSON.stringify([{id:'fictional-01',text:'<img src=x onerror=alert(1)> translation'}]));
  const run=spawnSync(process.execPath,[benchmarkScript,'--fixtures',fixturePath,'--fixture-set-version','review-fixture-v1','--mode','provided-results','--results',resultsPath,'--review-form','--include-source-text','--output',output],{encoding:'utf8'});
  expect(run.status,run.stderr).toBe(0);
  await page.goto(pathToFileURL(join(output,'human-review-form.html')).href);
  await expect(page.getByRole('heading',{name:'Local expert translation review'})).toBeVisible();
  await expect(page.locator('.case textarea').nth(0)).toHaveValue('<script>window.neverRun=true</script> source');
  await expect(page.locator('.case textarea').nth(1)).toHaveValue('<img src=x onerror=alert(1)> translation');
  expect(await page.evaluate(()=>window.neverRun)).toBeUndefined();
  await page.getByLabel(/I am qualified to assess/).check();await page.getByLabel(/I have not used these acceptance cases/).check();
  for(const input of await page.locator('input[type="radio"][value="4"]').all())await input.check();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download local ratings JSON'}).click();const download=await downloadPromise;await download.saveAs(join(directory,'ratings.json'));
  const ratings=JSON.parse(await readFile(join(directory,'ratings.json'),'utf8'));
  expect(ratings.qualificationSelfAttested).toBe(true);expect(ratings.independenceSelfAttested).toBe(true);expect(ratings.fixtureSetVersion).toBe('review-fixture-v1');expect(ratings.cases).toHaveLength(1);expect(ratings.cases[0].caseCode).toBe('R-001');expect(ratings.cases[0].ratings.meaning).toBe(4);expect(ratings.cases[0].ratings.criticalFactErrors).toBe(0);expect(ratings.cases[0].ratings.reworkMinutes).toBe(0);expect(ratings.cases[0].fixtureId).toBeUndefined();
 }finally{await rm(directory,{recursive:true,force:true});}
});
