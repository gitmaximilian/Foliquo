import {defineConfig} from '@playwright/test';

export default defineConfig({
 testDir:'./tests/browser',
 fullyParallel:false,
 workers:1,
 reporter:'list',
 timeout:30000,
 use:{browserName:'chromium',headless:true,trace:'retain-on-failure',screenshot:'only-on-failure'},
});
