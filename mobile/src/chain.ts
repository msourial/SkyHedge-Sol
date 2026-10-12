import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

export const DEVNET_RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
/** Direct Solana RPC endpoints, tried in order; none depend on the SkyHedge (Vercel) host. */
export const DEVNET_RPC_URLS = Array.from(new Set([DEVNET_RPC_URL, "https://api.devnet.solana.com", "https://solana-devnet.api.onfinality.io/public"]));

/** Try each RPC endpoint (each with its own timeout) before giving up. */
export async function readFinalizedWalletStateAnyRpc(walletAddress: string, deps: { urls?: string[]; read?: (address: string, url: string) => Promise<FinalizedWalletState>; timeoutMs?: number } = {}): Promise<FinalizedWalletState> {
  const urls = deps.urls ?? DEVNET_RPC_URLS;
  const read = deps.read ?? ((a: string, url: string) => readFinalizedWalletState(a, new Connection(url, "finalized")));
  let last: unknown;
  for (const url of urls) {
    try {
      return await new Promise<FinalizedWalletState>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Devnet RPC timed out")), deps.timeoutMs ?? 6_000);
        read(walletAddress, url).then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
      });
    } catch (error) { last = error; }
  }
  throw last instanceof Error ? last : new Error("All Devnet RPC endpoints failed");
}
export const SKYT_MINT = process.env.EXPO_PUBLIC_SKYT_MINT ?? "3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g";

export type FinalizedWalletState = {
  sol: number;
  skytBaseUnits: string;
  skytDecimals: number;
  slot: number;
};

type BalanceConnection = Pick<Connection, "getBalance" | "getParsedTokenAccountsByOwner" | "getSlot">;

/** Reads a user's Devnet balances at finalized commitment; no values are estimated or cached as zero. */
export async function readFinalizedWalletState(walletAddress: string, connection?: BalanceConnection): Promise<FinalizedWalletState> {
  const rpc = connection ?? new Connection(DEVNET_RPC_URL, "finalized");
  const owner = new PublicKey(walletAddress);
  const mint = new PublicKey(SKYT_MINT);
  const [lamports, tokenAccounts, slot] = await Promise.all([
    rpc.getBalance(owner, "finalized"),
    rpc.getParsedTokenAccountsByOwner(owner, { mint }, "finalized"),
    rpc.getSlot("finalized"),
  ]);
  const skytBaseUnits = tokenAccounts.value.reduce((total, account) => {
    const amount = account.account.data.parsed.info.tokenAmount.amount;
    if (typeof amount !== "string" || !/^\d+$/.test(amount)) throw new Error("Devnet returned a malformed SKYT balance.");
    return total + BigInt(amount);
  }, 0n);
  const decimals = tokenAccounts.value[0]?.account.data.parsed.info.tokenAmount.decimals;
  if (decimals !== undefined && decimals !== 6) throw new Error("The configured Devnet SKYT mint did not report six decimals.");
  return {
    sol: lamports / LAMPORTS_PER_SOL,
    skytBaseUnits: skytBaseUnits.toString(),
    skytDecimals: decimals ?? 6,
    slot,
  };
}

/** Direct finalized RPC read with a timeout, falling back to the SkyHedge server read (avoids phone-side public RPC limits). */
export async function readWalletStateWithFallback(
  walletAddress: string,
  deps: { direct: (address: string) => Promise<FinalizedWalletState>; server: (address: string) => Promise<FinalizedWalletState>; timeoutMs?: number },
): Promise<FinalizedWalletState> {
  const timeoutMs = deps.timeoutMs ?? 8_000;
  try {
    return await new Promise<FinalizedWalletState>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Devnet RPC timed out")), timeoutMs);
      deps.direct(walletAddress).then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
    });
  } catch {
    const state = await deps.server(walletAddress);
    if (!state || typeof state.skytBaseUnits !== "string" || !/^\d+$/.test(state.skytBaseUnits)) throw new Error("Finalized SKYT balance is unavailable.");
    return state;
  }
}
