import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: ".next/playwright-results",
  use: {
    baseURL: process.env.ADMIN_SMOKE_BASE_URL,
    trace: "retain-on-failure",
  },
});
