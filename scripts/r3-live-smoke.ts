/** Read-only smoke: npx tsx scripts/r3-live-smoke.ts. Uses optional existing env, never loads .env files. */
import { readCoverProgress } from "../server/services/cover-progress.js";
import { readForecastExceedance } from "../server/services/forecast-exceedance.js";
import { cityToday, weatherWindowFromAccount } from "../server/services/market-weather-window.js";
import { BorshCoder, type Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { perilCityHashHex } from "../shared/perils.js";
import idl from "../shared/idl/skyhedge_protection.json" with { type: "json" };
import { callWithRpcFailover, prepareRpcUrls } from "../server/services/rpc-failover.js";

const now = new Date();
const today = cityToday("new-york", now);
const add = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const report = async (label: string, read: () => Promise<unknown>) => {
  try { console.log(JSON.stringify({ label, result: await read() }, null, 2)); }
  catch { console.log(JSON.stringify({ label, error: "Live source could not be read" }, null, 2)); }
};
console.log(JSON.stringify({ now: now.toISOString(), dateConvention: "Half-open [start,end); past sample includes Oct 1 through Oct 28." }));
await report("New York rain 2026-10-01 through 2026-10-28", () => readCoverProgress({ city: "new-york", peril: "rain", start: "2026-10-01", end: "2026-10-29" }));
await report("New York rain current window", () => readCoverProgress({ city: "new-york", peril: "rain", start: add(today, -3), end: add(today, 4) }));
await report("New York rain upcoming window", () => readCoverProgress({ city: "new-york", peril: "rain", start: add(today, 1), end: add(today, 8) }));
await report("New York rain >= 2 mm next 7 days starting tomorrow", () => readForecastExceedance({ city: "new-york", peril: "rain", start: add(today, 1), end: add(today, 8), trigger: 2 }));
try {
  const program = new PublicKey(process.env.SKYHEDGE_PROGRAM_ID ?? idl.address);
  // Include started/ended covers, which the selling-market catalogue omits.
  const markets = await callWithRpcFailover(prepareRpcUrls(), async (url) => {
    const connection = new Connection(url, { commitment: "confirmed", disableRetryOnRateLimit: true,
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8_000) }),
    });
    // One program scan avoids the public RPC's low getProgramAccounts rate limit.
    return connection.getProgramAccounts(program, { commitment: "confirmed", filters: [{ memcmp: new BorshCoder(idl as unknown as Idl).accounts.memcmp("Market") }] });
  });
  for (const peril of ["snow", "wind"] as const) {
    const hash = perilCityHashHex("chicago", peril);
    const accounts = markets.filter((account) => account.account.data.subarray(80, 112).toString("hex") === hash);
    if (!accounts.length) { console.log(JSON.stringify({ label: `Chicago ${peril}`, result: "No market found" })); continue; }
    const coder = new BorshCoder(idl as unknown as Idl);
    const candidates = accounts.map((account) => ({ address: account.pubkey.toBase58(), terms: weatherWindowFromAccount(coder.accounts.decode("Market", account.account.data)) }));
    const relevant = candidates.filter((candidate) => candidate.terms.end > today).sort((a, b) => a.terms.start.localeCompare(b.terms.start));
    const { address, terms } = relevant[0] ?? candidates.sort((a, b) => b.terms.end.localeCompare(a.terms.end))[0];
    // Reuse the live account snapshot rather than issue redundant RPC reads.
    await report(`Chicago ${peril} market ${address}`, async () => ({
      window: terms, progress: await readCoverProgress(terms), forecast: await readForecastExceedance(terms),
    }));
  }
} catch {
  console.log(JSON.stringify({ label: "Chicago snow/wind market discovery", error: "Devnet RPC unavailable; market existence could not be verified" }));
}

// RPC failover bounds the result but web3.js can leave failed transports alive.
// This standalone diagnostic has completed all reads; do not wait on those sockets.
process.exit(0);
