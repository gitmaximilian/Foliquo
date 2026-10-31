import {defineConfig} from '@playwright/test';

export default defineConfig({
 testDir:'./tests/browser',
 fullyParallel:false,
 workers:1,
 reporter:'list',
 timeout:30000,
 projects:[
  {name:'chromium',use:{browserName:'chromium'}},
  {name:'firefox',use:{browserName:'firefox'}},
  {name:'webkit',use:{browserName:'webkit'}},
 ],
 use:{headless:true,trace:'retain-on-failure',screenshot:'only-on-failure'},
});
