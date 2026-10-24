import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../shared/ui-tokens.ts", import.meta.url), "utf8");
const tokens = Object.fromEntries([...source.matchAll(/(\w+): "(#[0-9A-Fa-f]{6})"/g)].map((match) => [match[1], match[2]]));

function channel(hex, index) {
  const value = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
function luminance(hex) {
  const [r, g, b] = [0, 1, 2].map((index) => channel(hex, index));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (hi + 0.05) / (lo + 0.05);
}

const pairs = [
  ["fg on bg", tokens.fg, tokens.bg],
  ["fg on surface1", tokens.fg, tokens.surface1],
  ["fg2 on surface1", tokens.fg2, tokens.surface1],
  ["dryText on bg", tokens.dryText, tokens.bg],
  ["dryText on surface2", tokens.dryText, tokens.surface2],
  ["tick on bg", tokens.tick, tokens.bg],
  ["glacier on bg", tokens.glacier, tokens.bg],
  ["onGlacier on glacier", tokens.onGlacier, tokens.glacier],
  ["slicker on bg", tokens.slicker, tokens.bg],
  ["snow on bg", tokens.snow, tokens.bg],
  ["wind on bg", tokens.wind, tokens.bg],
  ["heat on bg", tokens.heat, tokens.bg],
  ["cold on bg", tokens.cold, tokens.bg],
];

for (const [name, fg, bg] of pairs) {
  const ratio = contrast(fg, bg);
  const pass = name === "dryText on surface2" || name === "tick on bg" ? ratio >= 3 : ratio >= 4.5;
  console.log(`${pass ? "pass" : "FAIL"}  ${ratio.toFixed(2)}  ${name}  ${fg} on ${bg}`);
}
