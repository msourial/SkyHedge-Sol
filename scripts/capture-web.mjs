import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
const base = process.argv[2] ?? "http://127.0.0.1:5002";
const prefix = process.argv[3] ?? "";
const dir = "/workspace/codex-runs/shots";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.name));
  for (const [path, name, viewport] of [["/", "landing", { width: 390, height: 844 }], ["/", "landing-desktop", { width: 1280, height: 800 }], ["/app", "app", { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport);
    const response = await page.goto(new URL(path, base).href, { waitUntil: "load" });
    const protectedDeployment = response?.status() === 401 || /Authentication Required|Log in to Vercel/i.test(await page.title());
    if (!protectedDeployment) {
      if (path === "/app") {
        await page.getByRole("tab", { name: "Markets tab", exact: true }).waitFor({ timeout: 30_000 });
        await page.getByText("Pays out at", { exact: true }).waitFor({ timeout: 20_000 }).catch(() => {});
      } else await page.getByRole("heading", { level: 1 }).waitFor();
      await page.evaluate(() => document.fonts.ready);
    }
    await page.screenshot({ path: `${dir}/${prefix}${name}.png` });
    if (path === "/") await page.screenshot({ path: `${dir}/${prefix}${name}-full.png`, fullPage: true });
    console.log(`${path}: HTTP ${response?.status()}, ${protectedDeployment ? "deployment protection" : "rendered"}, screenshot saved`);
  }
  console.log(`Uncaught browser errors: ${errors.length}`);
} finally { await browser.close(); }
