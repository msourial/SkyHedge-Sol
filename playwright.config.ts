import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:5002",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "VITE_MAP_PROVIDER=maptiler VITE_MAPTILER_KEY=playwright-maptiler-key npm run build:site && cd client && npx vite preview --host 127.0.0.1 --port 5002 --strictPort --outDir ../dist",
    url: "http://127.0.0.1:5002",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
