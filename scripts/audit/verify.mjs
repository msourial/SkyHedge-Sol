import { chromium } from "playwright";

const BASE = process.env.AUDIT_BASE ?? "http://127.0.0.1:50010";
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1440, height: 900 },
];

const ROUTES = (process.env.AUDIT_ROUTES ?? "/,/staking,/flow-ai,/?tab=portfolio,/?tab=community,/?tab=ai-assistant").split(",");

let failures = 0;
const report = [];

function fail(route, vp, msg) {
  failures += 1;
  report.push(`FAIL  ${route} @${vp} — ${msg}`);
}

async function checkPage(browser, route, vp) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  try {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(600);

    const overflow = await page.evaluate(() => ({
      h: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    if (overflow.h) fail(route, vp.name, `horizontal overflow ${overflow.sw}px > ${overflow.cw}px`);

    const h1 = await page.locator("h1").count();
    if (!h1) fail(route, vp.name, "no h1 rendered");
    if (consoleErrors.length) fail(route, vp.name, `console errors: ${consoleErrors.slice(0, 3).join(" | ")}`);
    if (pageErrors.length) fail(route, vp.name, `page errors: ${pageErrors.slice(0, 2).join(" | ")}`);

    await page.screenshot({ path: `/tmp/audit-${vp.name}-${route.replaceAll("/", "_").slice(0, 40) || "root"}.png`, fullPage: false });
    return { consoleErrors, pageErrors };
  } catch (e) {
    fail(route, vp.name, `load failed: ${String(e).slice(0, 200)}`);
    return { consoleErrors: [], pageErrors: [] };
  } finally {
    await page.close();
  }
}

async function checkFlows(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  try {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(600);

    const disconnectBtn = page.locator("button:has-text('Disconnect')").first();
    if (await disconnectBtn.count()) {
      await disconnectBtn.click();
      await page.waitForTimeout(500);
    }
    const connectBtn = page.locator("[aria-haspopup='menu'], button:has-text('Connect')").first();
    if (await connectBtn.count()) {
      await connectBtn.click();
      await page.waitForTimeout(500);
      const menuItems = await page.locator("body").innerText();
      const hasPhantom = /phantom/i.test(menuItems);
      const hasSolflare = /solflare/i.test(menuItems);
      const hasDemo = /demo|not configured/i.test(menuItems);
      if (!hasPhantom || !hasSolflare || !hasDemo) fail("/flows", "desktop", `wallet menu entries (phantom=${hasPhantom} solflare=${hasSolflare} demo=${hasDemo})`);
      await page.keyboard.press("Escape");
    } else {
      fail("/flows", "desktop", "no connect control after disconnect");
    }

    const openIndex = page.locator("input[aria-label='Search cities']").first();
    if (await openIndex.count()) {
      await openIndex.fill("mumbai");
      await page.waitForTimeout(600);
      const result = page.locator("button:has-text('Mumbai')").first();
      if (!(await result.count())) {
        fail("/flows", "desktop", "city search returned no result");
      } else {
        await result.click();
        await page.waitForTimeout(1200);
        const rows = await page.locator("tbody tr").count();
        if (!rows) fail("/flows", "desktop", "chain table has no rows");
        const openTicket = page.locator("button:has-text('Open')").first();
        if (await openTicket.count()) {
          await openTicket.click();
          await page.waitForTimeout(400);
          const ticket = await page.locator("body").innerText();
          if (!/protect|premium|quantity/i.test(ticket)) fail("/flows", "desktop", "trade ticket did not open");
        }
      }
    } else {
      fail("/flows", "desktop", "no city search input");
    }

    const aiTab = page.locator("button:has-text('AI Assistant')").first();
    if (await aiTab.count()) {
      await aiTab.click();
      await page.waitForTimeout(800);
      const aiBody = await page.locator("body").innerText();
      if (!/describe an exposure|protection plan|accuracy/i.test(aiBody)) fail("/flows", "desktop", "AI tab did not render content");
    } else {
      fail("/flows", "desktop", "no AI Assistant tab");
    }

    if (consoleErrors.length) fail("/flows", "desktop", `console errors: ${consoleErrors.slice(0, 3).join(" | ")}`);
  } catch (e) {
    fail("/flows", "desktop", `flow walk failed: ${String(e).slice(0, 200)}`);
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({ headless: true });
for (const route of ROUTES) {
  for (const vp of VIEWPORTS) {
    await checkPage(browser, route, vp);
  }
}
await checkFlows(browser);
await browser.close();

console.log(report.length ? report.join("\n") : "ALL CHECKS PASSED");
process.exit(failures ? 1 : 0);