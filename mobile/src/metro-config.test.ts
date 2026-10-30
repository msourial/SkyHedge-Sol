import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { it } from "node:test";

const require = createRequire(import.meta.url);

it("resolves shared readers' bare imports through mobile/node_modules", () => {
  const config = require("../metro.config.js");
  const mobileNodeModules = fileURLToPath(new URL("../node_modules", import.meta.url));

  assert.ok(config.resolver.nodeModulesPaths.includes(mobileNodeModules));
});
