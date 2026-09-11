import { Connection, PublicKey } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import { RPC_URL, SKYT_DECIMALS, loadDeployer, log } from "./lib/chain";

async function main(): Promise<void> {
  const connection = new Connection(RPC_URL, "confirmed");
  const deployer = loadDeployer();
  const authority = new PublicKey(process.env.PROTOCOL_ADMIN ?? deployer.publicKey);
  const mint = await createMint(connection, deployer, authority, null, SKYT_DECIMALS);
  log("SKYT mint created", mint.toBase58());
  log("mint authority", authority.toBase58());
  log("decimals", SKYT_DECIMALS);
  log("next", `Set SKYT_MINT=${mint.toBase58()}; the configured mint-authority wallet must approve any SKYT issuance.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
