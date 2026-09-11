export type SolanaNetwork = "localnet" | "devnet" | "mainnet-beta";

export interface ServerEnv {
  port: number;
  nodeEnv: "development" | "production";
  network: SolanaNetwork;
  solanaRpcUrl: string;
  programId: string;
  databaseUrl: string;
  skytMint: string | null;
  settlementKeypairPath: string | null;
  noaaToken: string | null;
  weatherXmApiKey: string | null;
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
      ["SKYT_MINT", process.env.SKYT_MINT],
      ["SETTLEMENT_AUTHORITY_KEYPAIR", process.env.SETTLEMENT_AUTHORITY_KEYPAIR],
    ] as const;
    const missing = chainRequired.filter(([, value]) => !value).map(([key]) => key);
    if (missing.length > 0) {
      throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
    }
  } else {
    if (!process.env.SOLANA_RPC_URL) console.warn("[env] SOLANA_RPC_URL not set; defaulting to public devnet (rate limits apply)");
    if (!process.env.SKYT_MINT) console.warn("[env] SKYT_MINT not set; position/quote flow is unavailable");
  }

  if (!process.env.NOAA_TOKEN) console.warn("[env] NOAA_TOKEN not set; weather endpoints will return DATA_UNAVAILABLE");
  if (!process.env.WEATHERXM_API_KEY) console.warn("[env] WEATHERXM_API_KEY not set; supplemental WeatherXM evidence is unavailable");

  return {
    port,
    nodeEnv,
    network: network as SolanaNetwork,
    solanaRpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    programId: process.env.SKYHEDGE_PROGRAM_ID ?? "5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx",
    databaseUrl,
    skytMint: process.env.SKYT_MINT ?? null,
    settlementKeypairPath: process.env.SETTLEMENT_AUTHORITY_KEYPAIR ?? null,
    noaaToken: process.env.NOAA_TOKEN ?? null,
    weatherXmApiKey: process.env.WEATHERXM_API_KEY ?? null,
  };
}
