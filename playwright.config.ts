import { defineConfig, devices } from "@playwright/test";

// Living Thread - E2E / a11y / visual QA. No conditional skips.
//
//   npm run test:e2e:install    # one-time: playwright + chromium
//   npm run dev                 # app on 127.0.0.1:3000 (another shell)
//   npm run test:e2e            # globalSetup seeds the user; the run fails
//                               # loudly if the seed or the app is down
//
// The report + screenshots are produced by that run (gitignored, not
// committed). This config was authored without a browser harness.

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false, // Seal / activate mutate one seeded account
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "e2e/report/results.json" }],
    ["html", { open: "never", outputFolder: "e2e/report" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    storageState: "e2e/.auth/user.json", // written by globalSetup
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile-320", use: { ...devices["iPhone SE"], viewport: { width: 320, height: 700 } } },
    { name: "mobile-390", use: { ...devices["iPhone 12"], viewport: { width: 390, height: 844 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
