export type SolanaNetwork = "localnet" | "devnet" | "mainnet-beta";

export interface ServerEnv {
  port: number;
  nodeEnv: "development" | "production";
  network: SolanaNetwork;
  solanaRpcUrl: string;
  programId: string;
  databaseUrl: string;
  usdcMint: string | null;
  settlementKeypairPath: string | null;
  noaaToken: string | null;
}

const NETWORKS: readonly SolanaNetwork[] = ["localnet", "devnet", "mainnet-beta"];

/**
 * Validate the environment at startup so misconfiguration fails loudly (prod)
 * or warns early (dev) instead of surfacing weirdly later. Side-effect import.
 */
export function loadEnv(): ServerEnv {
  const network = (process.env.SOLANA_NETWORK ?? "devnet") as string;
  if (!(NETWORKS as readonly string[]).includes(network)) {
    throw new Error(`SOLANA_NETWORK="${network}" is invalid; expected one of: ${NETWORKS.join(", ")}`);
  }

  const port = Number(process.env.PORT ?? 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT="${process.env.PORT ?? ""}" is not a valid TCP port`);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required — set it in .env (see .env.example)");
  }

  const nodeEnv = process.env.NODE_ENV === "production" ? "production" : "development";

  const production = nodeEnv === "production";

  if (production) {
    const chainRequired = [
      ["SOLANA_RPC_URL", process.env.SOLANA_RPC_URL],
      ["USDC_MINT", process.env.USDC_MINT],
      ["SETTLEMENT_AUTHORITY_KEYPAIR", process.env.SETTLEMENT_AUTHORITY_KEYPAIR],
    ] as const;
    const missing = chainRequired.filter(([, value]) => !value).map(([key]) => key);
    if (missing.length > 0) {
      throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
    }
  } else {
    if (!process.env.SOLANA_RPC_URL) console.warn("[env] SOLANA_RPC_URL not set; defaulting to public devnet (rate limits apply)");
    if (!process.env.USDC_MINT) console.warn("[env] USDC_MINT not set; position/quote flow assumes the default demo mint");
  }

  if (!process.env.NOAA_TOKEN) console.warn("[env] NOAA_TOKEN not set; weather endpoints will return DATA_UNAVAILABLE");

  return {
    port,
    nodeEnv,
    network: network as SolanaNetwork,
    solanaRpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    programId: process.env.SKYHEDGE_PROGRAM_ID ?? "7thTyPBaVCEBL2z28ojTxfmrbNMydXV3EAgbYgrz7GKr",
    databaseUrl,
    usdcMint: process.env.USDC_MINT ?? null,
    settlementKeypairPath: process.env.SETTLEMENT_AUTHORITY_KEYPAIR ?? null,
    noaaToken: process.env.NOAA_TOKEN ?? null,
  };
}
