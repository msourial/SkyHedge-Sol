import { parseNoaaDailyRainfall } from '../server/services/noaa';
export const LOCAL_RPC = 'http://127.0.0.1:8899';
export function guardRpc(rpc: string): string {
  if (rpc !== LOCAL_RPC) throw new Error(`LOCAL REPLAY refuses RPC ${rpc}; only ${LOCAL_RPC} is allowed`);
  return rpc;
}
export function datePlus(date: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('Invalid date');
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
export function parseNoaaTotal(raw: string, start: string, end: string) {
  datePlus(start, 0); datePlus(end, 0);
  if (start > end || end >= new Date().toISOString().slice(0, 10) || Date.parse(end) - Date.parse(start) > 365 * 86400000) throw new Error('Require a past date range of at most 366 days');
  const rows: unknown = JSON.parse(raw);
  if (!Array.isArray(rows)) throw new Error('NOAA response must be an array');
  const byDate = new Map<string, number>();
  for (const row of rows) {
    if (row.STATION !== 'USW00094728' || typeof row.DATE !== 'string' || row.DATE < start || row.DATE > end || byDate.has(row.DATE)) throw new Error('Unexpected station/date or duplicate NOAA day');
    if (typeof row.PRCP !== 'string' || !/^\d+(?:\.\d+)?$/.test(row.PRCP)) throw new Error('Missing or invalid NOAA PRCP');
    // Access Services metric PRCP is already millimeters; reuse the existing flag validator.
    const day = parseNoaaDailyRainfall({date: row.DATE, value: Number(row.PRCP), attributes: row.PRCP_ATTRIBUTES ?? ',,,'});
    byDate.set(day.date, day.millimeters);
  }
  const daily = [];
  for (let date = start; date <= end; date = datePlus(date, 1)) {
    if (!byDate.has(date)) throw new Error(`Missing NOAA day ${date}`);
    daily.push({date, mm: byDate.get(date)!});
  }
  return { daily, totalX100: daily.reduce((sum, day) => sum + Math.round(day.mm * 100), 0) };
}
