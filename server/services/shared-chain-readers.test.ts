import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";
import ts from "typescript";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const mobileRoot = join(repoRoot, "mobile");
const config = ts.readConfigFile(join(repoRoot, "tsconfig.json"), ts.sys.readFile);
assert.equal(config.error, undefined);
const { options, errors } = ts.convertCompilerOptionsFromJson(config.config.compilerOptions, repoRoot);
assert.deepEqual(errors, []);

function isInsideMobile(path: string): boolean {
  const fromMobile = relative(mobileRoot, path);
  return fromMobile === "" || (!isAbsolute(fromMobile) && fromMobile !== ".." && !fromMobile.startsWith(`..${sep}`));
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  }));
  return nested.flat();
}

function importPaths(source: ts.SourceFile, includeTypes = false): string[] {
  const paths: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      if (!includeTypes && ts.isImportDeclaration(node) && node.importClause) {
        const clause = node.importClause;
        if (clause.isTypeOnly) return;
        const bindings = clause.namedBindings;
        if (!clause.name && bindings && ts.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every((element) => element.isTypeOnly)) return;
      }
      if (!includeTypes && ts.isExportDeclaration(node)) {
        if (node.isTypeOnly) return;
        if (node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.length > 0 && node.exportClause.elements.every((element) => element.isTypeOnly)) return;
      }
      paths.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
      const specifier = node.arguments[0];
      if (specifier && ts.isStringLiteralLike(specifier)) paths.push(specifier.text);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
      if (includeTypes || !node.isTypeOnly) paths.push(node.moduleReference.expression.text);
    } else if (includeTypes && ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) {
      paths.push(node.argument.literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return paths;
}

function resolveRelativeImport(file: string, specifier: string): string {
  return ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule?.resolvedFileName
    ?? resolve(dirname(file), specifier);
}

/** Follow source files as Vercel does, including lazy imports and re-exports. */
async function runtimeGraph(entryFiles: string[]) {
  const files = new Map<string, string>();
  const edges: Array<{ file: string; specifier: string; target: string }> = [];
  const pending = [...entryFiles];
  while (pending.length) {
    const file = pending.pop()!;
    if (files.has(file)) continue;
    const contents = await readFile(file, "utf8");
    files.set(file, contents);
    if (file.endsWith(".json")) continue;
    const source = ts.createSourceFile(file, contents, ts.ScriptTarget.Latest, true);
    for (const specifier of importPaths(source)) {
      if (!specifier.startsWith(".")) continue;
      const target = resolveRelativeImport(file, specifier);
      edges.push({ file, specifier, target });
      pending.push(target);
    }
  }
  return { files, edges };
}

describe("server chain reader boundaries", () => {
  it("recognizes runtime imports and re-exports while excluding type-only dependencies", () => {
    const source = ts.createSourceFile("imports.ts", `
      import "./side-effect.js";
      import { value, type Shape } from "./static.js";
      export { value } from "./export.js";
      export * from "./star.js";
      const lazy = () => import("./dynamic.js");
      import type { Shape } from "./type.ts";
      import { type OtherShape } from "./named-type.ts";
      export type { Shape } from "./export-type.ts";
      export { type OtherShape } from "./named-export-type.ts";
      type LazyShape = import("./import-type.ts").Shape;
    `, ts.ScriptTarget.Latest, true);
    assert.deepEqual(importPaths(source), ["./side-effect.js", "./static.js", "./export.js", "./star.js", "./dynamic.js"]);
  });

  it("keeps the transitive runtime graph of every API entry compatible with Vercel Node ESM", async () => {
    const { edges } = await runtimeGraph(await sourceFiles(join(repoRoot, "api")));
    const violations = edges
      .filter(({ specifier, target }) => specifier.endsWith(".ts") || isInsideMobile(target))
      .map(({ file, specifier }) => `${relative(repoRoot, file)} -> ${specifier}`);
    assert.deepEqual(violations, [], "API runtime imports must use compiled .js paths and stay outside mobile/");
  });

  it("keeps every API and server source import outside mobile/", async () => {
    const files = (await Promise.all([sourceFiles(join(repoRoot, "api")), sourceFiles(join(repoRoot, "server"))])).flat();
    const violations: string[] = [];
    for (const file of files) {
      const source = ts.createSourceFile(file, await readFile(file, "utf8"), ts.ScriptTarget.Latest, true);
      for (const specifier of importPaths(source, true)) {
        const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule?.resolvedFileName;
        const target = resolved ?? ((specifier.startsWith(".") || isAbsolute(specifier)) ? resolve(dirname(file), specifier) : undefined);
        if (target && isInsideMobile(target)) violations.push(`${relative(repoRoot, file)} -> ${specifier}`);
      }
    }
    assert.deepEqual(violations, [], "Server functions must use shared modules instead of mobile package files");
  });

  it("loads per-file transpiled readers and mobile API in plain Node, without bundling", async function () {
    this.timeout(20_000);
    // Under the repo so external packages resolve without copying node_modules.
    const outdir = await mkdtemp(join(repoRoot, ".chain-readers-"));
    try {
      const entries = ["shared/positions-reader.ts", "shared/wallet-reader.ts", "server/services/mobile-api.ts"];
      const { files } = await runtimeGraph(entries.map((file) => join(repoRoot, file)));
      await writeFile(join(outdir, "package.json"), JSON.stringify({ type: "module" }));
      for (const [file, source] of files) {
        const output = join(outdir, relative(repoRoot, file).replace(/\.ts$/, ".js"));
        await mkdir(dirname(output), { recursive: true });
        // Like @vercel/node: emit each file independently, preserving specifiers.
        const contents = file.endsWith(".ts") ? ts.transpileModule(source, {
          fileName: file,
          compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
        }).outputText : source;
        await writeFile(output, contents);
      }
      const urls = entries.map((file) => pathToFileURL(join(outdir, file.replace(/\.ts$/, ".js"))).href);
      await promisify(execFile)(process.execPath, ["--input-type=module", "--eval", `
        import assert from "node:assert/strict";
        globalThis.fetch = () => { throw new Error("Smoke test must not access the network"); };
        assert.equal(typeof (await import(${JSON.stringify(urls[0])})).readFinalizedProtections, "function");
        assert.equal(typeof (await import(${JSON.stringify(urls[1])})).readFinalizedWalletState, "function");
        assert.equal(typeof (await import(${JSON.stringify(urls[2])})).createMobileApiHandler, "function");
      `], { cwd: outdir, timeout: 15_000, env: { ...process.env, NODE_OPTIONS: "" } });
    } finally {
      await rm(outdir, { recursive: true, force: true });
    }
  });

  it("imports the compiled shared readers in plain Node without mobile or Expo", async () => {
    // Keep external packages resolvable, and use the root ESM package scope as on Vercel.
    const outdir = await mkdtemp(join(repoRoot, ".chain-readers-"));
    try {
      const result = await build({
        absWorkingDir: repoRoot,
        entryPoints: ["shared/positions-reader.ts", "shared/wallet-reader.ts"],
        outdir,
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        metafile: true,
        logLevel: "silent",
      });
      assert.equal(Object.keys(result.metafile.inputs).some((file) => isInsideMobile(resolve(repoRoot, file))), false);
      const positions = pathToFileURL(join(outdir, "positions-reader.js")).href;
      const wallet = pathToFileURL(join(outdir, "wallet-reader.js")).href;
      await promisify(execFile)(process.execPath, ["--input-type=module", "--eval", `
        import assert from "node:assert/strict";
        assert.equal(typeof (await import(${JSON.stringify(positions)})).readFinalizedProtections, "function");
        assert.equal(typeof (await import(${JSON.stringify(wallet)})).readFinalizedWalletState, "function");
      `], { cwd: repoRoot, timeout: 15_000 });
    } finally {
      await rm(outdir, { recursive: true, force: true });
    }
  });
});
