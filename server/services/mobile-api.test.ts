import { expect } from "chai";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createCityListHandler } from "../../api/cities";
import { createCityDetailHandler } from "../../api/cities/[slug]";
import { createAgriculturalMarketsHandler } from "../../api/agricultural-markets";
import { createPortfolioHandler } from "../../api/portfolio/[wallet]";
import { readFinalizedWalletState } from "../../mobile/src/chain";
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
    await createCityListHandler(async () => cities as never)({ method: "GET" } as never, record.response as never);

    expect(record.result().statusCode).to.equal(200);
    expect(record.result().body).to.deep.equal({ cities });
    expect(record.result().headers.get("Cache-Control")).to.include("s-maxage");
  });

  it("keeps the per-city window and completed-week history contract", async () => {
    const city = { slug: "des-moines", noaaStationId: "GHCND:USW00014933" };
    const state = { slug: city.slug, currentWindow: { start: "2026-09-28", end: "2026-10-05" }, cumulativeMm: null };
    const history = [{ week: "2026-09-21", mm: null }];
    const record = recorder();
    await createCityDetailHandler({
      resolveCity: () => city as never,
      readState: async () => state as never,
      readHistory: async () => history,
    })({ method: "GET", query: { slug: "des-moines" } } as never, record.response as never);

    expect(record.result().statusCode).to.equal(200);
    expect(record.result().body).to.deep.equal({ ...state, weeklyHistoryMm: history });
  });

  it("does not invent mobile markets or evidence validation", async () => {
    const record = recorder();
    await createAgriculturalMarketsHandler({ now: () => new Date("2026-09-30T00:00:00Z") })({ method: "GET" } as never, record.response as never);
    const body = record.result().body as { markets: Array<{ evidenceStatus: string; noaaStationId: string | null }>; settlementSource: string };

    expect(body.markets).to.have.length(12);
    expect(body.settlementSource).to.equal("NOAA");
    expect(body.markets.every((market) => market.evidenceStatus === "researching_evidence" && market.noaaStationId === null)).to.equal(true);
  });

  it("labels a wallet portfolio as not indexed instead of returning false zero positions", async () => {
    const wallet = new PublicKey("DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y").toBase58();
    const record = recorder();
    await createPortfolioHandler()({ method: "GET", query: { wallet } } as never, record.response as never);
    const body = record.result().body as { indexed: boolean; source: string; protections: unknown[]; message: string };

    expect(record.result().statusCode).to.equal(200);
    expect(body.indexed).to.equal(false);
    expect(body.source).to.equal("not-indexed");
    expect(body.protections).to.deep.equal([]);
    expect(body.message).to.match(/not available|not indexed/i);
  });

  it("rejects malformed wallet addresses at the portfolio boundary", async () => {
    const record = recorder();
    await createPortfolioHandler()({ method: "GET", query: { wallet: "not-a-public-key" } } as never, record.response as never);
    expect(record.result().statusCode).to.equal(400);
    expect(record.result().body).to.have.property("error", "INVALID_WALLET");
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
});
