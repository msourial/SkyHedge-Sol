import assert from "node:assert/strict";
import { lineTokens as C } from "../../shared/ui-tokens.ts";
function luminance(hex: string) {
  const rgb = [1,3,5].map((offset) => parseInt(hex.slice(offset, offset + 2),16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
const pairs = [
  ...["bg", "surface1", "surface2", "bgRaised"].flatMap((bg) => ["fg", "fg2"].map((fg) => [fg, bg])),
  ["dryText", "bg"], ["glacier", "bg"], ["slicker", "bg"], ["onGlacier", "glacier"],
] as Array<[keyof typeof C, keyof typeof C]>;
for (const [fg, bg] of pairs) {
  const a = luminance(C[fg]), b = luminance(C[bg]);
  const ratio = (Math.max(a,b) + .05) / (Math.min(a,b) + .05);
  console.log(`${fg} on ${bg}: ${ratio.toFixed(2)}:1 ${ratio >= 4.5 ? "PASS" : "FAIL"}`);
  assert(ratio >= 4.5, `${fg} on ${bg} must meet AA for 13px text`);
}
