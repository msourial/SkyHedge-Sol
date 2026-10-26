/** Grep the shared copy output, then enumerate string literals in the built app. */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { copySamples, forbiddenHits } from "../../shared/ui-copy.ts";
const copy = copySamples().join("\n");
const copyHits = forbiddenHits(copy);
assert.deepEqual(copyHits, []);
const sourceFiles = ["shared/ui-copy.ts", ...execFileSync("rg", ["--files", "client/src/components/line", "mobile/src/line"], { encoding: "utf8" }).trim().split("\n").filter((f) => /\.(tsx?|jsx?)$/.test(f))];
const sourceHits: { file: string; text: string; patterns: string[] }[] = [];
for (const file of sourceFiles) {
  const text = readFileSync(file, "utf8");
  const scanned = file === "shared/ui-copy.ts" ? text.slice(0, text.indexOf("const FORBIDDEN =")) : text;
  const patterns = forbiddenHits(scanned);
  if (patterns.length) sourceHits.push({ file, text: text.slice(0, 500), patterns });
}
assert.deepEqual(sourceHits, [], `Forbidden UI source copy: ${JSON.stringify(sourceHits)}`);
const literals: string[] = [];
const hits: { file: string; text: string; patterns: string[] }[] = [];
for (const file of readdirSync("dist/assets").filter((name) => name.endsWith(".js"))) {
  const source = ts.createSourceFile(file, readFileSync(join("dist/assets", file), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function walk(node: ts.Node) {
    if (ts.isStringLiteralLike(node)) {
      literals.push(node.text);
      const patterns = forbiddenHits(node.text);
      if (patterns.length) hits.push({ file, text: node.text, patterns });
    }
    ts.forEachChild(node, walk);
  }
  walk(source);
}
writeFileSync("/tmp/pr2-bundle-strings.txt", literals.join("\n"));
writeFileSync("/tmp/pr2-copy-output.txt", copy + "\n");
writeFileSync("/tmp/pr2-bundle-string-hits.json", JSON.stringify(hits, null, 2));
console.log(`Shared copy: ${copySamples().length} samples; ${copyHits.length} forbidden hits.`);
console.log(`Built bundle: ${hits.length} raw string-literal hits; inspect /tmp/pr2-bundle-string-hits.json to separate library/protocol identifiers from visible copy.`);
for (const hit of hits) console.log(`${hit.file}: ${JSON.stringify(hit.text).slice(0, 220)}`);
