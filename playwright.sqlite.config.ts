import {defineConfig, devices} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser', testMatch:'sqlite.spec.ts', timeout:45000,
  fullyParallel:false, workers:1,
  use:{baseURL:'http://127.0.0.1:3001',trace:'retain-on-failure'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
  webServer:{command:'bun scripts/build-sqlite.ts --tests && bun scripts/serve-sqlite.ts',url:'http://127.0.0.1:3001',reuseExistingServer:false,timeout:30000},
});
