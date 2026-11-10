import { defineConfig } from "@playwright/test";
const port = Number(process.env.WEB_PREVIEW_PORT || 5002);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests/web",
  timeout: 30_000,
  workers: 1,
  use: { baseURL, viewport: { width: 390, height: 844 }, trace: "retain-on-failure" },
  webServer: { command: "node --import tsx scripts/web-preview.ts", url: baseURL, reuseExistingServer: false },
});
