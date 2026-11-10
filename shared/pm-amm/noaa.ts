import {days, type MarketSpec} from './spec';
export function evaluate(spec: MarketSpec, rows: unknown) {
  const expected = days(spec);
  if (!Array.isArray(rows) || rows.length !== expected.length) throw Error('Expected exactly one observation per day');
  const values = new Map<string, number>();
  for (const row of rows) {
    if (!row || row.STATION !== spec.station || !expected.includes(row.DATE) || values.has(row.DATE)) throw Error('Unexpected or duplicate station/day');
    if (typeof row.PRCP !== 'string' || !/^\d+(\.\d)?$/.test(row.PRCP)) throw Error('Invalid daily PRCP');
    const flags = typeof row.PRCP_ATTRIBUTES === 'string' ? row.PRCP_ATTRIBUTES.split(',') : [];
    if (flags.length !== 4 || flags[1] !== '') throw Error('Missing attributes or NOAA quality flag');
    const tenths = BigInt(row.PRCP.replace('.', '')) * (row.PRCP.includes('.') ? 1n : 10n);
    if (tenths > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('PRCP overflow');
    values.set(row.DATE, Number(tenths));
  }
  const perDay = expected.map(date => ({date, tenths: values.get(date)!}));
  const total = perDay.reduce((sum, d) => sum + BigInt(d.tenths), 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('PRCP total overflow');
  if (!Number.isSafeInteger(spec.thresholdTenths) || spec.thresholdTenths < 0) throw Error('Invalid threshold');
  return {perDay, totalTenths:Number(total), thresholdTenths:spec.thresholdTenths, outcome:total >= BigInt(spec.thresholdTenths) ? 'yes' as const : 'no' as const};
}
export interface Evidence {
  market: string; spec: MarketSpec; url: string; raw: string; fetchedAt: string; sha256: string;
  evaluation: ReturnType<typeof evaluate>; resolveTx: string | null;
}
