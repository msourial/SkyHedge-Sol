import {days, type MarketSpec} from './spec';

export const ECCC_BASE = 'https://api.weather.gc.ca/collections/climate-daily/items';

export function ecccUrl(spec: MarketSpec): string {
  days(spec);
  return `${ECCC_BASE}?${new URLSearchParams({
    f: 'json',
    CLIMATE_IDENTIFIER: spec.station,
    datetime: `${spec.start}/${spec.end}`,
    sortby: 'LOCAL_DATE',
    limit: String(days(spec).length + 5),
  })}`;
}

function localDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) throw Error('Invalid LOCAL_DATE');
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error('Invalid LOCAL_DATE');
  return date;
}

function properties(row: unknown): Record<string, unknown> {
  if (!row || typeof row !== 'object') throw Error('Invalid daily observation');
  const rec = row as {properties?: unknown};
  if (rec.properties && typeof rec.properties === 'object') return rec.properties as Record<string, unknown>;
  return row as Record<string, unknown>;
}

function observationRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.map(properties);
  if (payload && typeof payload === 'object' && Array.isArray((payload as {features?: unknown}).features)) {
    return ((payload as {features: unknown[]}).features).map(properties);
  }
  throw Error('Expected a FeatureCollection or observation list');
}

/** Convert a non-negative ECCC millimetre reading (at most one decimal) to integer tenths. */
export function millimetresToTenths(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw Error('Invalid daily total precipitation');
  const tenths = Math.round(value * 10);
  if (Math.abs(value * 10 - tenths) > 1e-8 || tenths > Number.MAX_SAFE_INTEGER) throw Error('Invalid daily total precipitation');
  return tenths;
}

/** Trace (T) is a measured amount below 0.2 mm and counts as 0 mm. Any other flag, or a trace with a positive amount, is refused. */
export function precipitationTenths(amount: unknown, flag: unknown): number {
  const mark = flag == null || flag === '' ? '' : String(flag);
  if (mark === 'T') {
    if (amount == null || amount === '' || amount === 0) return 0;
    throw Error('Trace flag with a positive precipitation amount');
  }
  if (mark !== '') throw Error('Missing attributes or ECCC quality flag');
  if (amount == null || amount === '') throw Error('Missing daily total precipitation');
  return millimetresToTenths(amount);
}

export function evaluateEccc(spec: MarketSpec, payload: unknown) {
  const expected = days(spec);
  const rows = observationRows(payload);
  if (rows.length !== expected.length) throw Error('Expected exactly one observation per day');
  const values = new Map<string, number>();
  for (const row of rows) {
    const date = localDate(row.LOCAL_DATE);
    if (row.CLIMATE_IDENTIFIER !== spec.station || !expected.includes(date) || values.has(date)) throw Error('Unexpected or duplicate station/day');
    values.set(date, precipitationTenths(row.TOTAL_PRECIPITATION, row.TOTAL_PRECIPITATION_FLAG));
  }
  const perDay = expected.map(date => ({date, tenths: values.get(date)!}));
  const total = perDay.reduce((sum, d) => sum + BigInt(d.tenths), 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('Precipitation total overflow');
  if (!Number.isSafeInteger(spec.thresholdTenths) || spec.thresholdTenths < 0) throw Error('Invalid threshold');
  return {perDay, totalTenths: Number(total), thresholdTenths: spec.thresholdTenths, outcome: total >= BigInt(spec.thresholdTenths) ? 'yes' as const : 'no' as const};
}
