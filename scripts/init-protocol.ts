import "dotenv/config";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import * as fs from "node:fs";
import * as path from "node:path";
import { RPC_URL, ROOT, PROGRAM_ID, loadDeployer, loadSettlementAuthority, protocolPda, feeVaultPda, log } from "./lib/chain";

async function main(): Promise<void> {
  const connection = new Connection(RPC_URL, "confirmed");
  const admin = loadDeployer();
  const settlement = loadSettlementAuthority();

  const idl = JSON.parse(fs.readFileSync(path.join(ROOT, "shared/idl/skyhedge_protection.json"), "utf8"));
  const provider = new AnchorProvider(connection, new Wallet(admin) as never, { commitment: "confirmed" });
  const program = new Program(idl, provider);

  const [protocolAddress] = protocolPda();
  const existing = await connection.getAccountInfo(protocolAddress);
  if (existing) {
    const protocol = await program.account.protocolConfig.fetch(protocolAddress);
    log("protocol already initialized", {
      address: protocolAddress.toBase58(),
      admin: protocol.admin.toBase58(),
      settlementAuthority: protocol.settlementAuthority.toBase58(),
      collateralMint: protocol.collateralMint.toBase58(),
      nextMarketId: protocol.nextMarketId.toString(),
      paused: protocol.paused,
    });
    return;
  }

  const mintEnv = process.env.SKYT_MINT;
  if (!mintEnv) throw new Error("SKYT_MINT env var is required (run scripts/create-skyt-mint.ts first)");
  const collateralMint = new PublicKey(mintEnv);

  const balance = await connection.getBalance(admin.publicKey);
  log("admin", admin.publicKey.toBase58());
  log("balance SOL", (balance / 1e9).toFixed(3));
  log("settlement authority", settlement.publicKey.toBase58());
  log("collateral mint", collateralMint.toBase58());

  const sig = await program.methods
    .initializeProtocol(settlement.publicKey)
    .accounts({ admin: admin.publicKey, collateralMint, tokenProgram: TOKEN_PROGRAM_ID })
    .signers([admin])
    .rpc();
  log("initialize_protocol signature", sig);
  await connection.confirmTransaction(sig, "confirmed");

  const [feeVault] = feeVaultPda(protocolAddress);
  const vault = await getAccount(connection, feeVault);
  log("fee vault", { address: feeVault.toBase58(), balance: vault.amount.toString() });
  const protocol = await program.account.protocolConfig.fetch(protocolAddress);
  log("protocol state", {
    address: protocolAddress.toBase58(),
    admin: protocol.admin.toBase58(),
    settlementAuthority: protocol.settlementAuthority.toBase58(),
    collateralMint: protocol.collateralMint.toBase58(),
    nextMarketId: protocol.nextMarketId.toString(),
  });
}

void main().catch((error) => { console.error(error.message); process.exitCode = 1; });