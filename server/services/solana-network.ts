import { Connection, PublicKey } from "@solana/web3.js";

export const DEVNET_RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export type ProgramDeployment = "DEPLOYED" | "UNDEPLOYED" | "RPC_UNAVAILABLE";

export type NetworkIdentity = {
  network: "devnet";
  programId: string;
  programDeployment: ProgramDeployment;
  idlRegistered: false;
  transactionsAvailable: false;
};

/**
 * This is the truth boundary for the API. Transaction preparation must never be
 * enabled merely because a configured public key parses successfully.
 */
export async function resolveNetworkIdentity(programId: string): Promise<NetworkIdentity> {
  try {
    const connection = new Connection(DEVNET_RPC_URL, "finalized");
    const account = await connection.getAccountInfo(new PublicKey(programId), "finalized");
    return {
      network: "devnet",
      programId,
      programDeployment: account?.executable ? "DEPLOYED" : "UNDEPLOYED",
      // The generated IDL must be registered as a release artifact before this
      // becomes true. Keeping it false prevents synthetic unsigned transactions.
      idlRegistered: false,
      transactionsAvailable: false,
    };
  } catch {
    return { network: "devnet", programId, programDeployment: "RPC_UNAVAILABLE", idlRegistered: false, transactionsAvailable: false };
  }
}

export function protocolPda(programId: string): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("protocol")], new PublicKey(programId))[0];
}
