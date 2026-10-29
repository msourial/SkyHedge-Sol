import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";
import ts from "typescript";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const mobileRoot = join(repoRoot, "mobile");

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

function importPaths(source: ts.SourceFile): string[] {
  const paths: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      paths.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
      const specifier = node.arguments[0];
      if (specifier && ts.isStringLiteralLike(specifier)) paths.push(specifier.text);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
      paths.push(node.moduleReference.expression.text);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) {
      paths.push(node.argument.literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return paths;
}

describe("server chain reader boundaries", () => {
  it("keeps every API and server source import outside mobile/", async () => {
    const config = ts.readConfigFile(join(repoRoot, "tsconfig.json"), ts.sys.readFile);
    assert.equal(config.error, undefined);
    const { options, errors } = ts.convertCompilerOptionsFromJson(config.config.compilerOptions, repoRoot);
    assert.deepEqual(errors, []);
    const files = (await Promise.all([sourceFiles(join(repoRoot, "api")), sourceFiles(join(repoRoot, "server"))])).flat();
    const violations: string[] = [];
    for (const file of files) {
      const source = ts.createSourceFile(file, await readFile(file, "utf8"), ts.ScriptTarget.Latest, true);
      for (const specifier of importPaths(source)) {
        const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule?.resolvedFileName;
        const target = resolved ?? ((specifier.startsWith(".") || isAbsolute(specifier)) ? resolve(dirname(file), specifier) : undefined);
        if (target && isInsideMobile(target)) violations.push(`${relative(repoRoot, file)} -> ${specifier}`);
      }
    }
    assert.deepEqual(violations, [], "Server functions must use shared modules instead of mobile package files");
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
