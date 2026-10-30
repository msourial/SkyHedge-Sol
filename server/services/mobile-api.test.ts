import { expect } from "chai";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMobileApiHandler } from "./mobile-api";
import { readFinalizedWalletState } from "../../shared/wallet-reader.ts";
import { readFinalizedProtections, POSITION_DATA_SIZE } from "../../shared/positions-reader.ts";
import { hazardPresentation, type HazardId } from "../../mobile/src/hazards";

function recorder() {
  let statusCode = 200;
  let body: unknown;
  const headers = new Map<string, string>();
  const response = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { body = value; return this; },
    setHeader(name: string, value: string) { headers.set(name, value); },
  };
  return { response, result: () => ({ statusCode, body, headers }) };
}

describe("mobile read APIs", () => {
  it("returns real city-index states as JSON for the deployed list route", async () => {
    const cities = [{ slug: "des-moines", cumulativeMm: null, weeklyHistoryMm: null }];
    const record = recorder();
    await createMobileApiHandler({ loadCities: async () => cities as never })({ method: "GET", query: { resource: "cities" } } as never, record.response as never);

    expect(record.result().statusCode).to.equal(200);
    expect(record.result().body).to.deep.equal({ cities });
    expect(record.result().headers.get("Cache-Control")).to.include("s-maxage");
  });

  it("keeps the per-city window and completed-week history contract", async () => {
    const city = { slug: "des-moines", noaaStationId: "GHCND:USW00014933" };
    const state = { slug: city.slug, currentWindow: { start: "2026-09-28", end: "2026-10-05" }, cumulativeMm: null };
    const history = [{ week: "2026-09-21", mm: null }];
    const record = recorder();
    await createMobileApiHandler({
      resolveCity: () => city as never,
      readCity: async () => state as never,
      readHistory: async () => history,
    })({ method: "GET", query: { resource: "city", slug: "des-moines" } } as never, record.response as never);

    expect(record.result().statusCode).to.equal(200);
    expect(record.result().body).to.deep.equal({ ...state, weeklyHistoryMm: history });
  });

  it("does not invent mobile markets or evidence validation", async () => {
    const record = recorder();
    await createMobileApiHandler({ now: () => new Date("2026-09-30T00:00:00Z") })({ method: "GET", query: { resource: "agricultural-markets" } } as never, record.response as never);
    const body = record.result().body as { markets: Array<{ evidenceStatus: string; noaaStationId: string | null }>; settlementSource: string };

    expect(body.markets).to.have.length(12);
    expect(body.settlementSource).to.equal("NOAA");
    expect(body.markets.every((market) => market.evidenceStatus === "researching_evidence" && market.noaaStationId === null)).to.equal(true);
  });

  it("returns finalized chain positions instead of an indexer placeholder", async () => {
    const wallet = new PublicKey("DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y").toBase58();
    const protections = [{ market: "market", address: "position", city: "New York", premiumPaid: "24000000", statusLabel: "Active" }];
    const record = recorder();
    await createMobileApiHandler({ readPortfolio: async () => protections })({ method: "GET", query: { resource: "portfolio", wallet } } as never, record.response as never);
    const body = record.result().body as { indexed: boolean; source: string; protections: unknown[]; message?: string };

    expect(record.result().statusCode).to.equal(200);
    expect(body.indexed).to.equal(true);
    expect(body.source).to.equal("finalized-solana-rpc");
    expect(body.protections).to.deep.equal(protections);
    expect(body.message).to.equal(undefined);
  });

  it("rejects malformed wallet addresses at the portfolio boundary", async () => {
    const record = recorder();
    await createMobileApiHandler()({ method: "GET", query: { resource: "portfolio", wallet: "not-a-public-key" } } as never, record.response as never);
    expect(record.result().statusCode).to.equal(400);
    expect(record.result().body).to.have.property("error", "INVALID_WALLET");
  });

  it("returns ISO window and settlement dates from each position's own market account", async () => {
    const wallet = "DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y";
    const position = Buffer.alloc(POSITION_DATA_SIZE);
    Buffer.from([157, 171, 49, 175, 119, 109, 126, 129]).copy(position);
    new PublicKey(wallet).toBuffer().copy(position, 8);
    new PublicKey(wallet).toBuffer().copy(position, 40);
    const market = Buffer.alloc(384);
    market[240] = 1; market[381] = 1;
    market.writeBigInt64LE(6900n, 241);
    market.writeBigInt64LE(BigInt(Date.parse("2026-10-22T00:00:00Z") / 1000), 257);
    market.writeBigInt64LE(BigInt(Date.parse("2026-10-29T00:00:00Z") / 1000), 265);
    const record = recorder();
    await createMobileApiHandler({ readPortfolio: (address) => readFinalizedProtections(address, {
      urls: ["https://rpc.test"], attempts: 1,
      getProgramAccounts: async () => [{ pubkey: new PublicKey(wallet), data: position }],
      getMultipleAccounts: async () => [market],
    }) })({ method: "GET", query: { resource: "portfolio", wallet } } as never, record.response as never);
    expect(record.result().statusCode).to.equal(200);
    const body = JSON.parse(JSON.stringify(record.result().body));
    expect(body.protections[0]).to.include({
      windowStart: "2026-10-22T00:00:00.000Z",
      windowEnd: "2026-10-29T00:00:00.000Z",
      settlementDate: "2026-10-29T00:00:00.000Z",
    });
  });

  it("only dispatches supported read resources and rejects non-GET calls", async () => {
    const unknown = recorder();
    await createMobileApiHandler()({ method: "GET", query: { resource: "transactions" } } as never, unknown.response as never);
    expect(unknown.result().statusCode).to.equal(404);
    expect(unknown.result().body).to.have.property("error", "UNKNOWN_MOBILE_RESOURCE");

    const write = recorder();
    await createMobileApiHandler()({ method: "POST", query: { resource: "cities" } } as never, write.response as never);
    expect(write.result().statusCode).to.equal(405);
    expect(write.result().headers.get("Allow")).to.equal("GET");
  });

  it("sums finalized native and SKYT token balances without estimating", async () => {
    const owner = new PublicKey("DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y");
    const calls: string[] = [];
    const connection = {
      async getBalance(_owner: PublicKey, commitment: string) { calls.push(`sol:${commitment}`); return 1.25 * LAMPORTS_PER_SOL; },
      async getParsedTokenAccountsByOwner(_owner: PublicKey, filter: { mint: PublicKey }, commitment: string) {
        calls.push(`skyt:${filter.mint.toBase58()}:${commitment}`);
        return { value: [
          { account: { data: { parsed: { info: { tokenAmount: { amount: "1250000", decimals: 6 } } } } } },
          { account: { data: { parsed: { info: { tokenAmount: { amount: "750000", decimals: 6 } } } } } },
        ] };
      },
      async getSlot(commitment: string) { calls.push(`slot:${commitment}`); return 123; },
    };

    const balances = await readFinalizedWalletState(owner.toBase58(), connection as never);
    expect(balances).to.deep.equal({ sol: 1.25, skytBaseUnits: "2000000", skytDecimals: 6, slot: 123 });
    expect(calls.every((call) => call.endsWith(":finalized") || call.startsWith("skyt:"))).to.equal(true);
  });

  it("keeps wind and snow as distinct research-only indexes, never quoteable", () => {
    const wind = hazardPresentation("wind-gust" as HazardId);
    const snow = hazardPresentation("snowfall" as HazardId);
    expect(wind).to.include({ metric: "Highest daily peak gust", unit: "mph / km/h", quoteable: false });
    expect(snow).to.include({ metric: "New snowfall accumulation", unit: "in / mm", quoteable: false });
    expect(snow.note).to.include("not snow depth");
  });

  it("serves claim readiness through the combined mobile endpoint as JSON", async () => {
    const market = "9UUNQPXnrzUEDsra8PMMzByp9J9un1yysGdGuaz9JqVJ";
    const wallet = "DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y";
    const readiness = { state: "not_claimable", reason: "No position", action: null };
    const record = recorder();
    let seen: string[] = [];
    await createMobileApiHandler({ readClaimReadiness: async (m, w) => { seen = [m, w]; return readiness as never; } })(
      { method: "GET", query: { resource: "claim-readiness", market, wallet } } as never, record.response as never);
    expect(record.result().statusCode).to.equal(200);
    expect(record.result().body).to.deep.equal(readiness);
    expect(seen).to.deep.equal([market, wallet]);
    expect(record.result().headers.get("Content-Type")).to.include("application/json");
  });

  it("rejects claim readiness with an invalid wallet", async () => {
    const record = recorder();
    await createMobileApiHandler({ readClaimReadiness: async () => { throw new Error("should not read"); } })(
      { method: "GET", query: { resource: "claim-readiness", market: "x", wallet: "y" } } as never, record.response as never);
    expect(record.result().statusCode).to.equal(400);
  });

  it("serves finalized wallet balances from the server RPC", async () => {
    const wallet = "DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y";
    const state = { sol: 1, skytBaseUnits: "500000000", skytDecimals: 6, slot: 9 };
    const record = recorder();
    await createMobileApiHandler({ readWalletState: async (w) => { expect(w).to.equal(wallet); return state; } })(
      { method: "GET", query: { resource: "wallet-balances", wallet } } as never, record.response as never);
    expect(record.result().statusCode).to.equal(200);
    expect(record.result().body).to.deep.equal(state);
    expect(record.result().headers.get("Cache-Control")).to.equal("no-store");
  });

  it("returns 503 rather than zero when the server balance read fails", async () => {
    const record = recorder();
    await createMobileApiHandler({ readWalletState: async () => { throw new Error("rpc down"); } })(
      { method: "GET", query: { resource: "wallet-balances", wallet: "DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y" } } as never, record.response as never);
    expect(record.result().statusCode).to.equal(503);
  });
});

describe("per-market mobile weather resources", () => {
  const a = "DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y";
  const b = "3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g";
  for (const resource of ["cover-progress", "forecast-edge"]) {
    it(`serves ${resource} single and batch requests through the Vercel handler`, async () => {
      const value = resource === "cover-progress" ? { valueNative: null, state: "unavailable" } : { forecast: null, historyProbability: 0.2 };
      for (const query of [{ resource, market: a }, { resource, markets: `${a},${b},${a}` }]) {
        const calls: string[] = [];
        const read = async (address: string) => { calls.push(address); return value as never; };
        const record = recorder();
        await createMobileApiHandler({ readCoverProgress: read, readForecastEdge: read })({ method: "GET", query } as never, record.response as never);
        expect(record.result().statusCode).to.equal(200);
        expect(calls).to.deep.equal("market" in query ? [a] : [a, b]);
        const key = resource === "cover-progress" ? "progress" : "edges";
        expect((record.result().body as Record<string, unknown>)[key]).to.deep.equal(Object.fromEntries(calls.map((address) => [address, value])));
      }
    });
  }
  it("rejects empty, malformed, ambiguous and oversized weather batches", async () => {
    for (const query of [{ market: "" }, { market: "invalid" }, { markets: `${a},` }, { market: a, markets: b }, { markets: new Array(21).fill(a).join(",") }]) {
      const record = recorder();
      await createMobileApiHandler()({ method: "GET", query: { resource: "cover-progress", ...query } } as never, record.response as never);
      expect(record.result().statusCode).to.equal(400);
    }
  });
  it("surfaces a failed market lookup as a read error", async () => {
    const record = recorder();
    await createMobileApiHandler({ readCoverProgress: async () => { throw new Error("RPC private details"); } })({ method: "GET", query: { resource: "cover-progress", market: a } } as never, record.response as never);
    expect(record.result().statusCode).to.equal(503);
    expect(JSON.stringify(record.result().body)).not.to.include("private");
  });
});
