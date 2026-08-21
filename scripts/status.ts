import "dotenv/config";
import { Connection } from "@solana/web3.js";
import { RPC_URL, PROGRAM_ID, loadProgram, protocolPda, marketPda, feeVaultPda, vaultPda, log } from "./lib/chain";

async function main(): Promise<void> {
  const connection = new Connection(RPC_URL, "confirmed");
  const program = await loadProgram(connection);

  const [protocolAddress] = protocolPda();
  const protocolInfo = await connection.getAccountInfo(protocolAddress);
  if (!protocolInfo) {
    console.log("Protocol is not initialized on this cluster.");
    return;
  }
  const protocol = await program.account.protocolConfig.fetch(protocolAddress);
  const [feeVault] = feeVaultPda(protocolAddress);
  log("protocol", {
    address: protocolAddress.toBase58(),
    admin: protocol.admin.toBase58(),
    settlementAuthority: protocol.settlementAuthority.toBase58(),
    collateralMint: protocol.collateralMint.toBase58(),
    nextMarketId: protocol.nextMarketId.toString(),
    paused: protocol.paused,
    feeVault: feeVault.toBase58(),
  });

  for (let id = 0n; id < protocol.nextMarketId; id++) {
    const [marketAddress] = marketPda(protocolAddress, id);
    const market = await program.account.market.fetch(marketAddress);
    const [vault] = vaultPda(marketAddress);
    log(`market ${id}`, {
      address: marketAddress.toBase58(),
      cityHash: Buffer.from(market.cityHash).toString("hex").slice(0, 16) + "…",
      operator: JSON.stringify(market.operator),
      thresholdMmX100: market.thresholdMmX100.toString(),
      status: JSON.stringify(market.status),
      result: JSON.stringify(market.result),
      premiumRateBps: market.premiumRateBps,
      totalShares: market.totalShares.toString(),
      reservedExposure: market.reservedExposure.toString(),
      premiumBalance: market.premiumBalance.toString(),
      salesCloseAt: market.salesCloseAt.toNumber(),
      observationStart: market.observationStart.toNumber(),
      observationEnd: market.observationEnd.toNumber(),
      dataDeadline: market.dataDeadline.toNumber(),
      claimDeadline: market.claimDeadline.toNumber(),
      vault: vault.toBase58(),
    });
  }
}

void main().catch((error) => { console.error((error as Error).stack ?? error); process.exitCode = 1; });