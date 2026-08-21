import { chromium } from "playwright";
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 375, height: 812 } });
await p.goto("http://127.0.0.1:5001/portfolio", { waitUntil: "networkidle" });
await p.waitForTimeout(800);
const wide = await p.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.right > document.documentElement.clientWidth + 1) {
      out.push({ tag: el.tagName, cls: (el.className + "").slice(0, 70), right: Math.round(r.right), left: Math.round(r.left), w: Math.round(r.width) });
    }
  }
  return out.slice(0, 12);
});
console.log(JSON.stringify(wide, null, 1));
await b.close();