import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { canvasFadeColor, fadeBandAlphas, foldNudge, scrollFadeKind, SCROLL_FADE_HEIGHT, SCROLL_FADE_START } from "./scroll-fade.ts";

describe("native scroll fade", () => {
  it("paints Android with view bands and other platforms with a gradient", () => {
    assert.equal(scrollFadeKind("android"), "bands");
    assert.equal(scrollFadeKind("ios"), "gradient");
    assert.equal(scrollFadeKind("web"), "gradient");
    const android = readFileSync(new URL("./scroll-edge-fade.android.tsx", import.meta.url), "utf8");
    const other = readFileSync(new URL("./scroll-edge-fade.tsx", import.meta.url), "utf8");
    assert.equal(android.includes("expo-linear-gradient"), false);
    assert.match(android, /fadeBandAlphas/);
    assert.match(android, /protect-scroll-fade-bands/);
    assert.match(other, /expo-linear-gradient/);
    assert.match(other, /protect-scroll-fade-gradient/);
    const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    assert.equal(app.includes("stickyHeight + tabHeight"), false);
    assert.match(app, /top:\s*-\s*SCROLL_FADE_HEIGHT/);
  });

  it("eases from 18% canvas to solid graphite at the panel edge", () => {
    const alphas = fadeBandAlphas();
    assert.equal(alphas.length, SCROLL_FADE_HEIGHT);
    assert.equal(alphas[0], SCROLL_FADE_START);
    assert.ok(SCROLL_FADE_START >= 0.15 && SCROLL_FADE_START <= 0.2);
    assert.equal(alphas[alphas.length - 1], 1);
    for (let i = 1; i < alphas.length; i++) assert.ok(alphas[i] >= alphas[i - 1]);
    assert.ok(alphas[Math.floor(alphas.length / 2)] > 0.5);
    assert.equal(canvasFadeColor(0), "rgba(11,18,32,0)");
    assert.equal(canvasFadeColor(1), "rgba(11,18,32,1)");
    assert.equal(canvasFadeColor(SCROLL_FADE_START), "rgba(11,18,32,0.18)");
  });

  it("clears a peeking card on an 800dp viewport and leaves a real card alone", () => {
    assert.equal(foldNudge(780, 800), 28);
    assert.equal(foldNudge(600, 800), 0);
    assert.equal(foldNudge(808, 800), 0);
    assert.equal(foldNudge(0, 0), 0);
  });
});
