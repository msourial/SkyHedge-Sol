import "dotenv/config";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { RPC_URL, loadDeployer, log } from "./lib/chain";

const AMOUNT_SOL = Number(process.argv[2] ?? 2);
const MAX_ATTEMPTS = Number(process.argv[3] ?? 12);
const TARGET_SOL = Number(process.argv[4] ?? 0);

async function main(): Promise<void> {
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = loadDeployer().publicKey;
  log("wallet", wallet.toBase58());
  log("rpc", RPC_URL);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const balance = await connection.getBalance(wallet);
    const sol = balance / LAMPORTS_PER_SOL;
    log(`attempt ${attempt}/${MAX_ATTEMPTS}`, `balance=${sol.toFixed(2)} SOL target=${TARGET_SOL}`);
    if (balance >= TARGET_SOL * LAMPORTS_PER_SOL) {
      console.log("Target balance reached. Done.");
      return;
    }
    try {
      const sig = await connection.requestAirdrop(wallet, AMOUNT_SOL * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
      console.log(`Airdropped ${AMOUNT_SOL} SOL (${sig})`);
    } catch (error) {
      console.log(`Airdrop request failed: ${(error as Error).message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  const final = await connection.getBalance(wallet);
  console.log(`Final balance: ${(final / LAMPORTS_PER_SOL).toFixed(2)} SOL`);
  if (final < TARGET_SOL * LAMPORTS_PER_SOL) {
    console.error("BLOCKED: devnet airdrop rate limit not yet exhausted; run again later or use https://faucet.solana.com / https://solfaucet.com");
    process.exitCode = 1;
  }
}

void main();