/**
 * Dry-run the Devnet window ladder. Does not sign and does not read a key.
 * Missing rungs are signed in Phantom via scripts/sign-ladder-phantom.ts.
 */
import { parseKeeperCity, runWindowKeeper } from "../server/services/window-keeper-run.ts";

if (process.argv.includes("--sign")) {
  console.error("Refusing to sign. The keeper stays a dry run. Use scripts/sign-ladder-phantom.ts and approve each transaction in Phantom.");
  process.exit(2);
}

let city: ReturnType<typeof parseKeeperCity>;
try {
  city = parseKeeperCity(process.argv);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Invalid --city");
  process.exit(2);
}

const result = await runWindowKeeper({ sign: false, city });
console.log(JSON.stringify(result, null, 2));
