import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/web",
  timeout: 30_000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5002", viewport: { width: 390, height: 844 }, trace: "retain-on-failure" },
  webServer: { command: "node --import tsx scripts/web-preview.ts", url: "http://127.0.0.1:5002", reuseExistingServer: true },
});
