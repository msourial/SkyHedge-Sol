import { BorshCoder, type Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "../../shared/idl/skyhedge_protection.json" with { type: "json" };
import { PERILS, resolveCityPeril, type PerilId } from "../../shared/perils.js";
import type { WeatherUnit } from "../../shared/weather-signals.js";
import { DataUnavailableError, NOAA_STATIONS, type SkyHedgeCity } from "./noaa.js";
import { perilForPinnedHashes } from "./methodology-docs.js";
import { NoaaReadCache } from "./noaa-cache.js";
import { callWithRpcFailover, prepareRpcUrls } from "./rpc-failover.js";
import { utcDates } from "./ghcnd-daily.js";

export interface WeatherWindow { city: SkyHedgeCity; peril: PerilId; start: string; end: string; }
export interface ForecastWindow extends WeatherWindow { trigger: number; operator?: "gte" | "gt" | "lte" | "lt"; }
export interface MarketWeatherWindow extends ForecastWindow { historyProbability: number; }
export const CITY_TIMEZONES: Record<SkyHedgeCity, string> = {
  "new-york": "America/New_York", chicago: "America/Chicago", miami: "America/New_York", dallas: "America/Chicago",
  "los-angeles": "America/Los_Angeles", seattle: "America/Los_Angeles", boston: "America/New_York", austin: "America/Chicago", "des-moines": "America/Chicago",
};
export function weatherUnit(peril: PerilId): WeatherUnit { return peril === "heat" || peril === "cold" ? "°C" : peril === "wind" ? "m/s" : "mm"; }
export function cityToday(city: SkyHedgeCity, now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CITY_TIMEZONES[city], year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function validateWeatherWindow(window: WeatherWindow): string[] {
  if (!(window.city in NOAA_STATIONS) || !(window.peril in PERILS)) throw new DataUnavailableError("Unknown NOAA city or peril");
  for (const date of [window.start, window.end]) {
    const time = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) throw new DataUnavailableError("Invalid observation date");
  }
  return utcDates(window.start, window.end);
}
export function previousDay(date: string): string { return new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10); }

const marketCache = new NoaaReadCache(null);
/** Direct account read also works for ended covers omitted from the selling-market catalogue. */
export function readMarketWeatherWindow(address: string): Promise<MarketWeatherWindow> {
  const key = new PublicKey(address);
  const program = new PublicKey(process.env.SKYHEDGE_PROGRAM_ID ?? idl.address);
  return marketCache.read(`weather-market:${program}:${key}`, 60, () => callWithRpcFailover(prepareRpcUrls(), async (url) => {
    const connection = new Connection(url, { commitment: "confirmed", disableRetryOnRateLimit: true,
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8_000) }),
    });
    const account = await connection.getAccountInfo(key, "confirmed");
    if (!account || !account.owner.equals(program)) throw new DataUnavailableError("Market account is missing or has the wrong owner");
    const decoded = new BorshCoder(idl as unknown as Idl).accounts.decode("Market", account.data) as Record<string, unknown>;
    return weatherWindowFromAccount(decoded);
  }));
}

/** Anchor's committed IDL uses snake-case account fields. */
export function weatherWindowFromAccount(account: Record<string, unknown>): MarketWeatherWindow {
  const hex = (field: string) => Buffer.from(account[field] as number[]).toString("hex");
  const identity = resolveCityPeril(hex("city_hash"));
  if (!identity) throw new DataUnavailableError("Market city/peril hash is unknown");
  const pinnedPeril = perilForPinnedHashes(NOAA_STATIONS[identity.city].stationId, hex("station_id_hash"), hex("provider_hash"), hex("methodology_hash"));
  if (pinnedPeril !== identity.peril) throw new DataUnavailableError("Market station or methodology does not match the NOAA pin");
  const date = (field: string) => {
    const seconds = Number(String(account[field]));
    if (!Number.isSafeInteger(seconds) || seconds % 86_400 !== 0) throw new DataUnavailableError("Market window must use UTC date boundaries");
    return new Date(seconds * 1_000).toISOString().slice(0, 10);
  };
  const variant = Object.keys(account.operator as object)[0]?.toLowerCase();
  const operator = ({ greaterthanorequal: "gte", greaterthan: "gt", lessthanorequal: "lte", lessthan: "lt" } as const)[variant as "greaterthanorequal" | "greaterthan" | "lessthanorequal" | "lessthan"];
  const trigger = Number(String(account.threshold_mm_x100)) / 100;
  const historyProbability = Number(account.quote_probability_bps) / 10_000;
  if (!["gte", "gt", "lte", "lt"].includes(operator ?? "") || !Number.isFinite(trigger) || trigger < 0
    || !Number.isFinite(historyProbability) || historyProbability < 0 || historyProbability > 1) throw new DataUnavailableError("Market trigger or history chance is invalid");
  const window = { ...identity, start: date("observation_start"), end: date("observation_end"), trigger, operator, historyProbability };
  validateWeatherWindow(window);
  return window;
}
