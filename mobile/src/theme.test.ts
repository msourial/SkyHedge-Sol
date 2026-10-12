import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { C, F } from "./theme.ts";

describe("Signal Dark theme", () => {
  it("exposes the shared semantic weather and status tokens", () => {
    assert.equal(C.canvas, "#080B14");
    assert.equal(C.surface, "#111827");
    assert.equal(C.surfaceRaised, "#182235");
    assert.equal(C.rain, "#70D6FF");
    assert.equal(C.mint, "#32E6A1");
    assert.equal(C.amber, "#F5C66D");
    assert.equal(C.coral, "#FF8C91");
  });

  it("keeps display, interface, and technical typography roles distinct", () => {
    assert.match(F.heading, /SpaceGrotesk/);
    assert.match(F.body, /Inter/);
    assert.match(F.mono, /mono/i);
  });
});
