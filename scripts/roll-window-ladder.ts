/**
 * Dry-run the Devnet window ladder. Pass --sign only after KEEPER_SIGN=yes
 * and an explicit confirmation. This script does not create a keypair.
 */
import { runWindowKeeper } from "../server/services/window-keeper-run.ts";

const sign = process.argv.includes("--sign");
if (sign && process.env.KEEPER_SIGN !== "yes") {
  console.error("Refusing to sign. Confirm the Devnet protocol-admin key, then set KEEPER_SIGN=yes.");
  process.exit(2);
}

const result = await runWindowKeeper({ sign });
console.log(JSON.stringify(result, null, 2));
