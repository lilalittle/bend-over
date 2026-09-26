import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";
const directory=process.env.BEND_RELEASE_DIR;
if(!directory)throw new Error("BEND_RELEASE_DIR must point to an extracted SQLite companion");
export default defineConfig({
  testDir:"./tests/browser",testMatch:"sqlite-release.spec.ts",timeout:45000,workers:1,
  use:{baseURL:"http://127.0.0.1:3002",trace:"retain-on-failure"},
  projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}}],
  webServer:{command:`bun ${JSON.stringify(resolve(directory,"serve.js"))}`,url:"http://127.0.0.1:3002/web/",env:{PORT:"3002"},reuseExistingServer:false,timeout:30000},
});
