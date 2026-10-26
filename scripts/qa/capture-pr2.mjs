/** Run against a local Vite preview after npm run build:site. No external requests. */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { pr2States } from "./pr2-states.mjs";
const origin = process.env.PR2_PREVIEW_ORIGIN ?? "http://127.0.0.1:5002";
const output = resolve(process.env.PR2_SHOTS_DIR ?? "/workspace/pr2-shots-v4");
const browser = await chromium.launch({ headless: true });
try {
  await mkdir(output, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await page.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const manifest = [];
  for (const state of pr2States) {
    await page.goto(`${origin}${state.url}`);
    await page.getByRole("note").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(output, `${state.name}.png`) });
    manifest.push({ ...state, width: 393, height: 852, file: `${state.name}.png` });
    if (state.name.startsWith("receipt-") || state.name === "first-run" || state.name === "wallet-technical") {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.screenshot({ path: resolve(output, `${state.name}-details.png`) });
      manifest.push({ ...state, width: 393, height: 852, file: `${state.name}-details.png`, scroll: "bottom" });
    }
    if (state.name.startsWith("protect-") && await page.locator('section[aria-label="Ticket"]').count() && !await page.getByRole("dialog").count()) {
      await page.locator(".ln-scroll").evaluate((node) => { node.scrollTop = node.scrollHeight; });
      await page.screenshot({ path: resolve(output, `${state.name}-ticket.png`) });
      manifest.push({ ...state, width: 393, height: 852, file: `${state.name}-ticket.png`, scroll: "ticket" });
    }
  }
  await writeFile(resolve(output, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`Captured ${manifest.length} screenshots in ${output}`);
} finally { await browser.close(); }
