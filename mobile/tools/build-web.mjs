import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const output = args.indexOf("--output-dir");
const outputDirectory = output < 0 ? "../dist/app" : args[output + 1];
const result = spawnSync(process.execPath, [require.resolve("expo/bin/cli"), "export", "--platform", "web", "--output-dir", outputDirectory], {
  stdio: "inherit",
  env: {
    ...process.env,
    EXPO_NO_DOTENV: "1",
    EXPO_WEB_BUILD: "1",
    // Keep direct reads and signed browser transactions pinned to Devnet.
    EXPO_PUBLIC_SOLANA_RPC_URL: "https://api.devnet.solana.com",
  },
});
process.exit(result.status ?? 1);
