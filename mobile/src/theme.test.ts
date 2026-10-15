import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accentGlow, brandMark, C, F, glass, motion, statusGlow, type as typeScale, MIN_FONT, MIN_TOUCH, radius } from "./theme.ts";

describe("Storm Glass theme", () => {
  it("exposes the shared semantic weather and status tokens", () => {
    assert.equal(C.canvas, "#0B1220");
    assert.equal(C.surface, "#141B28");
    assert.equal(C.surfaceRaised, "#1C2433");
    assert.equal(C.rain, "#7CC4FF");
    assert.equal(C.rainBright, "#A8D9FF");
    assert.equal(C.mint, "#34D399");
    assert.equal(C.amber, "#FFB020");
    assert.equal(C.payout, "#F5B841");
    assert.notEqual(C.amber, C.payout);
    assert.equal(C.coral, "#F2787D");
  });

  it("exposes isometric umbrella BrandMark colors shared with web", () => {
    assert.equal(brandMark.panel1, "#7BC3F0");
    assert.equal(brandMark.tip, "#F5B342");
    assert.equal(brandMark.tile, "#12151A");
    assert.equal(brandMark.viewBox, "236 190 552 590");
  });

  it("exposes frosted-pane recipes for Markets glass surfaces", () => {
    assert.match(glass.fill, /^rgba\(/);
    assert.match(glass.border, /^rgba\(/);
    assert.equal(glass.radius, 24);
    assert.equal(glass.sheen.length, 3);
    assert.equal(statusGlow(C.mint, true), "none");
    assert.match(statusGlow(C.mint), /12px/);
    assert.match(accentGlow(C.rain), /26px/);
  });

  it("keeps display, interface, and technical typography roles distinct", () => {
    assert.match(F.heading, /InterTight/);
    assert.match(F.body, /Inter/);
    assert.match(F.mono, /mono/i);
  });

  it("uses Markets card enter motion (opacity + rise, staggered)", () => {
    assert.equal(motion.slow, 700);
    assert.equal(motion.stagger, 90);
    assert.equal(motion.enterOffset, 22);
  });
});

describe("Enterprise tokens", () => {
  it("never sets readable text below the minimum size", () => {
    for (const style of Object.values(typeScale)) assert.ok(style.fontSize >= MIN_FONT);
  });
  it("keeps touch targets and radii in a restrained range", () => {
    assert.ok(MIN_TOUCH >= 48);
    assert.ok(radius.lg <= 16);
    assert.equal(radius.glass, glass.radius);
  });
});
