import "dotenv/config";
import { Connection, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { RPC_URL, SKYT_DECIMALS, loadDeployer, log } from "./lib/chain";

const MINT = process.env.SKYT_MINT;
const RECIPIENT = process.argv[2];
const AMOUNT_SKYT = Number(process.argv[3] ?? 1_000);

async function main(): Promise<void> {
  if (!MINT) throw new Error("SKYT_MINT env var is required (see scripts/create-skyt-mint.ts)");
  if (!RECIPIENT) throw new Error("usage: npm run skyt:faucet -- <wallet-pubkey> [amount-SKYT]");
  const connection = new Connection(RPC_URL, "confirmed");
  const deployer = loadDeployer();
  const mint = new PublicKey(MINT);
  const recipient = new PublicKey(RECIPIENT);
  const ata = await getOrCreateAssociatedTokenAccount(connection, deployer, mint, recipient);
  const amount = BigInt(Math.round(AMOUNT_SKYT * 10 ** SKYT_DECIMALS));
  const sig = await mintTo(connection, deployer, mint, ata.address, deployer, amount);
  log("fauceted", `${AMOUNT_SKYT} SKYT -> ${recipient.toBase58()}`);
  log("ata", ata.address.toBase58());
  log("signature", sig);
}

void main().catch((error) => { console.error(error.message); process.exitCode = 1; });