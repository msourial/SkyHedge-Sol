import "dotenv/config";
import { Connection, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { RPC_URL, USDC_DECIMALS, loadDeployer, log } from "./lib/chain";

const MINT = process.env.USDC_MINT;
const RECIPIENT = process.argv[2];
const AMOUNT_USDC = Number(process.argv[3] ?? 1_000);

async function main(): Promise<void> {
  if (!MINT) throw new Error("USDC_MINT env var is required (see scripts/create-usdc-mint.ts)");
  if (!RECIPIENT) throw new Error("usage: npm run usdc:faucet -- <wallet-pubkey> [amount-USDC]");
  const connection = new Connection(RPC_URL, "confirmed");
  const deployer = loadDeployer();
  const mint = new PublicKey(MINT);
  const recipient = new PublicKey(RECIPIENT);
  const ata = await getOrCreateAssociatedTokenAccount(connection, deployer, mint, recipient);
  const amount = BigInt(Math.round(AMOUNT_USDC * 10 ** USDC_DECIMALS));
  const sig = await mintTo(connection, deployer, mint, ata.address, deployer, amount);
  log("fauceted", `${AMOUNT_USDC} USDC -> ${recipient.toBase58()}`);
  log("ata", ata.address.toBase58());
  log("signature", sig);
}

void main().catch((error) => { console.error(error.message); process.exitCode = 1; });