import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { C, F } from "./theme.ts";

describe("Instrument theme", () => {
  it("exposes the shared semantic weather and status tokens", () => {
    assert.equal(C.canvas, "#0A0E13");
    assert.equal(C.surface, "#11161D");
    assert.equal(C.surfaceRaised, "#171D26");
    assert.equal(C.rain, "#5CC8FF");
    assert.equal(C.mint, "#3DDC97");
    assert.equal(C.amber, "#E8B04B");
    assert.equal(C.payout, "#E8B04B");
    assert.equal(C.coral, "#F2787D");
  });

  it("keeps display, interface, and technical typography roles distinct", () => {
    assert.match(F.heading, /Inter/); // single family; weight carries hierarchy
    assert.match(F.body, /Inter/);
    assert.match(F.mono, /mono/i);
  });
});

import { type as typeScale, MIN_FONT, MIN_TOUCH, radius } from "./theme.ts";
describe("Enterprise tokens", () => {
  it("never sets readable text below the minimum size", () => {
    for (const style of Object.values(typeScale)) assert.ok(style.fontSize >= MIN_FONT);
  });
  it("keeps touch targets and radii in a restrained range", () => {
    assert.ok(MIN_TOUCH >= 48);
    assert.ok(radius.lg <= 16);
  });
});
