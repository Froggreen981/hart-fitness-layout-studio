import {defineConfig,devices} from '@playwright/test';
import {existsSync} from 'node:fs';

export default defineConfig({
  testDir:'./tests/browser',
  fullyParallel:false,
  workers:1,
  forbidOnly:!!process.env.CI,
  retries:0,
  timeout:30_000,
  expect:{timeout:8_000},
  reporter:process.env.CI?'github':'list',
  use:{
    baseURL:'http://127.0.0.1:4189',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||
      (existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined)}
  },
  projects:[
    {name:'desktop-chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},
    {name:'mobile-chromium',use:{...devices['Pixel 7']}}
  ],
  webServer:{
    command:'node scripts/browser-test-server.mjs',
    env:{PORT:'4189'},
    url:'http://127.0.0.1:4189/workspace.html',
    reuseExistingServer:false,
    timeout:30_000,
    gracefulShutdown:{signal:'SIGINT',timeout:5_000}
  }
});
