import "dotenv/config";
import { Connection, PublicKey } from "@solana/web3.js";
import { loadDeployer, loadProgram, protocolPda } from "./lib/chain";

const LOCAL_RPC = "http://127.0.0.1:8899";

async function main(): Promise<void> {
  const connection = new Connection(LOCAL_RPC, "confirmed");
  const admin = loadDeployer();
  const program = await loadProgram(connection, admin);
  const [protocolAddress] = protocolPda();
  const protocol = await program.account.protocolConfig.fetch(protocolAddress);
  const nextMarketId = protocol.nextMarketId.toNumber();
  const lastMarketId = nextMarketId - 1;

  const allMarketAddresses = await program.account.market.all();
  for (const market of allMarketAddresses) {
    const status = JSON.stringify(market.account.status);
    if (status === JSON.stringify({ draft: {} })) {
      const marketAddress = market.publicKey;
      console.log(`Opening market ${marketAddress.toBase58()} (status: draft)`);
      const sig = await program.methods
        .openMarket()
        .accounts({ admin: admin.publicKey, market: marketAddress })
        .signers([admin])
        .rpc();
      console.log(`  Tx: ${sig}`);
      const updated = await program.account.market.fetch(marketAddress);
      console.log(`  New status: ${JSON.stringify(updated.status)}`);
    }
  }

  console.log(`\nAll draft markets opened. Last market ID was: ${lastMarketId}`);
}

void main().catch((error) => { console.error("FAILED:", error.message); process.exitCode = 1; });
