import "dotenv/config";
import { Connection } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import { RPC_URL, USDC_DECIMALS, loadDeployer, log } from "./lib/chain";

async function main(): Promise<void> {
  const connection = new Connection(RPC_URL, "confirmed");
  const deployer = loadDeployer();
  const mint = await createMint(connection, deployer, deployer.publicKey, null, USDC_DECIMALS);
  log("USDC mint created", mint.toBase58());
  log("mint authority", deployer.publicKey.toBase58());
  log("decimals", USDC_DECIMALS);
  log("command", `USDC_MINT=${mint.toBase58()} npm run usdc:faucet -- <wallet> <amount>`);
}

void main();