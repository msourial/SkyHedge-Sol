import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { liquidGlassRecipe } from "./liquid-glass-config.ts";

describe("liquid glass platform policy", () => {
  it("uses native blur only on Android 12 and later", () => {
    assert.equal(liquidGlassRecipe(31, false).usesNativeBlur, true);
    assert.equal(liquidGlassRecipe(30, false).usesNativeBlur, false);
  });

  it("keeps motion off when reduced motion is requested", () => {
    assert.equal(liquidGlassRecipe(35, true).animateAmbient, false);
    assert.equal(liquidGlassRecipe(35, false).animateAmbient, true);
  });
});
