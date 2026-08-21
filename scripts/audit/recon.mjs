import { chromium } from "playwright";
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://127.0.0.1:5001/", { waitUntil: "networkidle" });
await p.waitForTimeout(600);
const wb = await p.locator("button").allTextContents();
console.log("BUTTONS:", JSON.stringify(wb.slice(0, 12)));
const links = await p.locator("a[href]").evaluateAll(as => as.map(a => a.getAttribute("href")).slice(0, 15));
console.log("LINKS:", JSON.stringify(links));
const hasMenu = await p.locator("[aria-haspopup='menu']").count();
console.log("aria-haspopup count:", hasMenu);
if (hasMenu) {
  await p.locator("[aria-haspopup='menu']").first().click();
  await p.waitForTimeout(500);
  const body = await p.locator("body").innerText();
  console.log("MENU TEXT:", JSON.stringify(body.slice(0, 600)));
}
await b.close();