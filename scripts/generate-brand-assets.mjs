/**
 * Renders the isometric umbrella BrandMark into favicon / app-icon / OG PNGs.
 * Colors and viewBox come only from shared/storm-glass.ts (brandMark + C).
 */
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { brandMark, C } = await import(pathToFileURL(path.join(root, "shared/storm-glass.ts")).href);

function glyphSvg(size, { tile = false, pad = 0 } = {}) {
  const inner = size - pad * 2;
  const glyph = tile ? inner * 0.8 : inner;
  const offset = (size - glyph) / 2;
  const bg = tile
    ? `<rect width="${size}" height="${size}" rx="${size * 0.28}" fill="${brandMark.tile}"/>`
    : `<rect width="${size}" height="${size}" fill="${brandMark.tile}"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg}
  <g transform="translate(${offset} ${offset})">
    <svg width="${glyph}" height="${glyph}" viewBox="${brandMark.viewBox}">
      <path d="M512 230 L262 520 L387 490Z" fill="${brandMark.panel1}"/>
      <path d="M512 230 L387 490 L512 520Z" fill="${brandMark.panel2}"/>
      <path d="M512 230 L512 520 L637 490Z" fill="${brandMark.panel3}"/>
      <path d="M512 230 L637 490 L762 520Z" fill="${brandMark.panel4}"/>
      <path d="M512 520 L512 720 Q512 760 472 760" fill="none" stroke="${brandMark.handle}" stroke-width="40" stroke-linecap="round"/>
      <circle cx="512" cy="225" r="24" fill="${brandMark.tip}"/>
    </svg>
  </g>
</svg>`;
}

function ogSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${C.canvas}"/>
  <rect x="80" y="165" width="300" height="300" rx="84" fill="${brandMark.tile}" stroke="${brandMark.tileBorder}" stroke-width="3"/>
  <svg x="125" y="210" width="210" height="210" viewBox="${brandMark.viewBox}">
    <path d="M512 230 L262 520 L387 490Z" fill="${brandMark.panel1}"/>
    <path d="M512 230 L387 490 L512 520Z" fill="${brandMark.panel2}"/>
    <path d="M512 230 L512 520 L637 490Z" fill="${brandMark.panel3}"/>
    <path d="M512 230 L637 490 L762 520Z" fill="${brandMark.panel4}"/>
    <path d="M512 520 L512 720 Q512 760 472 760" fill="none" stroke="${brandMark.handle}" stroke-width="40" stroke-linecap="round"/>
    <circle cx="512" cy="225" r="24" fill="${brandMark.tip}"/>
  </svg>
  <text x="440" y="300" fill="${C.ink}" font-family="Inter Tight, Inter, system-ui, sans-serif" font-size="72" font-weight="700">SkyHedge</text>
  <text x="440" y="360" fill="${C.muted}" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="500">Parametric weather protection on Solana</text>
  <text x="440" y="410" fill="${C.rain}" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="600">skyhedge.app · Devnet</text>
</svg>`;
}

async function rasterize(browser, svg, outPath, width, height) {
  const page = await browser.newPage({ viewport: { width, height, deviceScaleFactor: 1 } });
  await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent;}</style></head><body>${svg}</body></html>`, { waitUntil: "load" });
  await page.locator("svg").first().screenshot({ path: outPath, omitBackground: false });
  await page.close();
}

async function main() {
  const publicDir = path.join(root, "client/public");
  const brandDir = path.join(root, "mobile/assets/brand");
  const assetsDir = path.join(root, "mobile/assets");
  await mkdir(publicDir, { recursive: true });
  await mkdir(brandDir, { recursive: true });

  const faviconSvg = glyphSvg(64, { tile: true });
  const iconSvg = glyphSvg(1024, { tile: false });
  const foregroundSvg = glyphSvg(1024, { tile: false });
  await writeFile(path.join(publicDir, "favicon.svg"), faviconSvg);
  await writeFile(path.join(brandDir, "icon-v1.svg"), iconSvg);
  await writeFile(path.join(brandDir, "icon-v1-foreground.svg"), foregroundSvg);

  const browser = await chromium.launch();
  const jobs = [
    [glyphSvg(16, { tile: true }), path.join(publicDir, "favicon-16.png"), 16, 16],
    [glyphSvg(32, { tile: true }), path.join(publicDir, "favicon-32.png"), 32, 32],
    [glyphSvg(180, { tile: true }), path.join(publicDir, "apple-touch-icon.png"), 180, 180],
    [glyphSvg(192, { tile: true }), path.join(publicDir, "icon-192.png"), 192, 192],
    [glyphSvg(512, { tile: true }), path.join(publicDir, "icon-512.png"), 512, 512],
    [ogSvg(), path.join(publicDir, "og.png"), 1200, 630],
    [glyphSvg(1024, { tile: false }), path.join(assetsDir, "icon.png"), 1024, 1024],
    [glyphSvg(1024, { tile: false }), path.join(assetsDir, "adaptive-icon.png"), 1024, 1024],
    [`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${brandMark.tile}"/></svg>`, path.join(assetsDir, "adaptive-icon-background.png"), 1024, 1024],
  ];
  for (const [svg, out, w, h] of jobs) {
    await rasterize(browser, svg, out, w, h);
    console.log("wrote", path.relative(root, out));
  }
  await browser.close();

  try {
    await unlink(path.join(publicDir, "og.jpg"));
    console.log("removed client/public/og.jpg");
  } catch {
    /* absent */
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
