export interface MarketSpec {
  city: string;
  station: string;
  stationName: string;
  timeZone: string;
  start: string;
  end: string;
  thresholdTenths: number;
  endTs: number;
  historicalDemo?: boolean;
  /** Defaults to NOAA GHCND daily precipitation when omitted. */
  source?: 'noaa' | 'eccc';
}
export function dateMs(date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date) throw Error('Invalid observation date');
  return ms;
}
export function days(spec: Pick<MarketSpec, 'start' | 'end'>): string[] {
  const start = dateMs(spec.start), end = dateMs(spec.end);
  if (end < start || (end - start) / 86400000 >= 366) throw Error('Invalid observation window');
  return Array.from({length: (end - start) / 86400000 + 1}, (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10));
}
/** UTC timestamp corresponding to station-local midnight. */
export function localMidnight(date: string, timeZone: string): number {
  const target = dateMs(date);
  const format = new Intl.DateTimeFormat('en-CA', {timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'});
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(format.formatToParts(guess).map(p => [p.type, p.value]));
    const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    guess += target - shown;
  }
  return guess / 1000;
}
export function validateSpec(spec: MarketSpec, now?: number): void {
  days(spec);
  if (!spec.city.trim() || !spec.stationName.trim()) throw Error('Invalid station');
  if (spec.source === 'eccc') {
    if (!/^[A-Z0-9]{7,11}$/.test(spec.station)) throw Error('Invalid station');
  } else if (spec.source !== undefined && spec.source !== 'noaa') {
    throw Error('Invalid settlement source');
  } else if (!/^[A-Z0-9]{11}$/.test(spec.station)) {
    throw Error('Invalid station');
  }
  if (!Number.isSafeInteger(spec.thresholdTenths) || spec.thresholdTenths < 0) throw Error('Invalid threshold');
  if (!Number.isSafeInteger(spec.endTs)) throw Error('Invalid trading end');
  const start = localMidnight(spec.start, spec.timeZone);
  if (!spec.historicalDemo && spec.endTs > start) throw Error('Trading must end before observations start');
  if (spec.historicalDemo && (now === undefined || dateMs(spec.end) / 1000 >= now)) throw Error('Historical demo must use past observations');
  if (now !== undefined && spec.endTs - now < 600) throw Error('Creation needs at least 600 seconds');
}
/** Compact, reversible strike identity; human labels live in the catalog. */
export function marketName(spec: MarketSpec): string {
  days(spec);
  const kind = spec.historicalDemo ? 'DEMO' : spec.source === 'eccc' ? 'PREC' : 'RAIN';
  const name = `${kind}:${spec.station}:${spec.start.replaceAll('-', '')}-${spec.end.replaceAll('-', '')}:GE${spec.thresholdTenths}:T${spec.endTs}`;
  if (new TextEncoder().encode(name).length > 64) throw Error('Market name exceeds 64 bytes');
  return name;
}
export const NOAA_BASE = 'https://www.ncei.noaa.gov/access/services/data/v1';
export function noaaUrl(spec: MarketSpec): string {
  return `${NOAA_BASE}?${new URLSearchParams({dataset:'daily-summaries', stations:spec.station, startDate:spec.start, endDate:spec.end, dataTypes:'PRCP', units:'metric', format:'json', includeAttributes:'true'})}`;
}

export function observationEnd(spec: Pick<MarketSpec, 'end' | 'timeZone'>): number {
  const next = new Date(dateMs(spec.end) + 86400000).toISOString().slice(0,10);
  return localMidnight(next, spec.timeZone);
}
export function assertCatalogIdentity(entry: {spec: MarketSpec; name: string; creator: string}, state: {name: number[]; endTs: {toNumber(): number}; authority: {toBase58(): string}; collateralMint: {toBase58(): string}}, mint: string): void {
  // Historical demos validate the past-window exception relative to their trading end.
  validateSpec(entry.spec, entry.spec.historicalDemo ? entry.spec.endTs - 600 : undefined);
  if (marketName(entry.spec) !== entry.name || new TextDecoder().decode(new Uint8Array(state.name)).replace(/\0/g, '') !== entry.name || state.endTs.toNumber() !== entry.spec.endTs || state.authority.toBase58() !== entry.creator || state.collateralMint.toBase58() !== mint) throw Error('Market identity mismatch');
}
