import type {MarketAccount} from '@pm-amm/sdk';
import {dateMs, type MarketSpec} from './spec';
import {marketState, quote, rawAmount} from './trading';

export type RiskType = 'rain' | 'snow' | 'total precipitation';
export type BuyDirection = 'usdcToYes' | 'usdcToNo';
/** Explicit risk metadata wins; legacy RAIN/DEMO names describe rain only. */
export interface HedgeMarket {
  name: string;
  spec: Pick<MarketSpec, 'city' | 'start' | 'end' | 'thresholdTenths' | 'endTs' | 'historicalDemo'> & {riskType?: RiskType};
}
export type HedgeCatalog = Record<string, HedgeMarket>;
export interface HedgeRequest {
  location?: string;
  riskType?: RiskType;
  startDate?: string;
  endDate?: string;
  maxPay?: string;
  direction: BuyDirection;
}
export interface ParsedRequest {request: HedgeRequest; issues: string[]; path: 'deterministic'}
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const monthPattern = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

/** No network or model calls. Yearless named dates use the 2026 event context. */
export function parseHedgeRequest(input: string, catalog: HedgeCatalog, now = new Date()): ParsedRequest {
  const text = normalize(input).replace(/[–—]/g, '-').replace(/[’]/g, "'");
  const request: HedgeRequest = {direction:'usdcToYes'};
  const issues: string[] = [];
  const cities = [...new Map(['Montreal','Toronto','New York','Chicago',...Object.values(catalog).map(e => e.spec.city)].map(city => [normalize(city),city])).values()];
  const found = cities.filter(city => new RegExp(`\\b${escape(normalize(city))}\\b`).test(text));
  if (found.length === 1) request.location = found[0];
  else if (found.length > 1) issues.push('Use one location per request.');
  else {
    const location = text.match(/\b(?:located in|based in|i am in|i'm in|in)\s+([a-z][a-z .'-]*?)(?=,|\s+(?:and|i\b|from|want|for|to hedge|hedg|against|budget|max|with)|$)/)?.[1]?.trim();
    if (location) request.location = location.replace(/\b\w/g, c => c.toUpperCase());
  }
  if (/\btotal precipitation\b|\brain (?:plus|and|\+) melted snow\b/.test(text)) request.riskType = 'total precipitation';
  else if (/\bsnow(?:fall|ing)?\b/.test(text) && /\brain(?:fall|ing)?\b/.test(text)) issues.push('Choose rain, snow, or total precipitation.');
  else if (/\bsnow(?:fall|ing)?\b/.test(text)) request.riskType = 'snow';
  else if (/\brain(?:fall|ing)?\b/.test(text)) request.riskType = 'rain';
  // Absence must be explicit; ordinary “hedge against snow” means buying Yes.
  if (/\b(?:no|without|lack of) (?:rain(?:fall|ing)?|snow(?:fall|ing)?|total precipitation)\b|\b(?:rain|snow)(?:fall)? (?:will not|won't|does not|doesn't) (?:happen|occur|fall)\b|\b(?:won't|will not|doesn't|does not) (?:rain|snow)(?:fall|ing)?\b|\bdry weather\b/.test(text)) {
    request.direction = 'usdcToNo';
    if (/\bdry weather\b/.test(text) && !request.riskType) request.riskType = 'rain';
  }
  try {
    const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
    const namedPattern = `\\b(${monthPattern})\\s+(\\d{1,2})(?:,?\\s+(20\\d{2}))?\\s*(?:to|through|until|-)\\s*(?:(${monthPattern})\\s+)?(\\d{1,2})(?:,?\\s+(20\\d{2}))?\\b`;
    const ranges = [...text.matchAll(new RegExp(namedPattern, 'g'))];
    const namedDates = (s: string) => s.match(new RegExp(`\\b${monthPattern}\\s+\\d{1,2}\\b`, 'g'))?.length ?? 0;
    if (/\bthis week\b/.test(text)) {
      if (iso.length || namedDates(text)) throw Error('Conflicting dates');
      const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
      request.startDate = monday.toISOString().slice(0,10);
      request.endDate = new Date(monday.getTime() + 6 * 86400000).toISOString().slice(0,10);
    } else {
      if (iso.length) {
        if (iso.length !== 2 || namedDates(text)) throw Error('Use one date range.');
        [request.startDate,request.endDate] = iso;
      } else {
        if (ranges.length > 1 || ranges.length === 1 && namedDates(text) !== namedDates(ranges[0][0])) throw Error('Use one date range.');
        const range = ranges[0];
        if (range) {
          const [,m1,d1,y1,m2,d2,y2] = range;
          const date = (m: string,d: string,y: string) => `${y}-${String(months.indexOf(m.slice(0,3))+1).padStart(2,'0')}-${d.padStart(2,'0')}`;
          request.startDate = date(m1,d1,y1 ?? y2 ?? '2026');
          request.endDate = date(m2 ?? m1,d2,y2 ?? y1 ?? '2026');
        }
      }
    }
    if (request.startDate && request.endDate) {
      if (dateMs(request.startDate) > dateMs(request.endDate)) throw Error('The end date must be on or after the start date.');
    }
  } catch {
    delete request.startDate; delete request.endDate;
    issues.push('Use valid dates in order, for example Dec 14 to Dec 16, 2026.');
  }
  const amounts = [...text.matchAll(/\b(?:budget|max(?:imum)?(?:\s+(?:loss|pay))?|premium|the most(?:\s+i can pay)?)\b(?:\s+(?:is|of|i|can|am|willing|able|to|pay|spend|have|have to|up to|at most))*\s*(?:[:=]\s*)?\$?\s*(-?\d[\d,.]*(?:e[+-]?\d+)?)/g)];
  if (amounts.length === 1) {
    const amount = amounts[0][1].replace(/[.,]$/, '');
    try {rawAmount(amount); request.maxPay = amount;}
    catch {issues.push('Enter a positive budget with up to six decimal places.');}
  } else if (amounts.length > 1) issues.push('Use one budget per request.');
  for (const [key,label] of [['location','location'],['riskType','weather risk (rain, snow, or total precipitation)'],['startDate','date range'],['maxPay','budget in mUSDC']] as const) {
    if (!request[key]) issues.push(`Add a ${label}.`);
  }
  return {request,issues,path:'deterministic'};
}

export function marketRisk(entry: HedgeMarket): RiskType | undefined {
  return entry.spec.riskType ?? (/^(RAIN|DEMO):/.test(entry.name) ? 'rain' : undefined);
}
export const riskLabel = (risk?: RiskType) => risk === 'total precipitation' ? 'total precipitation (rain plus melted snow)' : risk ?? 'unspecified weather risk';
const compatible = (wanted: RiskType, actual?: RiskType) => wanted === actual || actual === 'total precipitation' || wanted === 'total precipitation' && actual === 'snow';

/** Gross input includes the shared quote's fee. Try the full budget first, then
 * bounded binary search for the largest successful raw input below it. */
export function sizeHedge(market: MarketAccount, direction: BuyDirection, budget: string, now: number) {
  const limit = rawAmount(budget);
  const attempt = (amount: number) => {
    try {
      const q = quote(market,direction,amount,now);
      if (!Number.isSafeInteger(q.fee) || q.fee < 0 || q.fee > amount || !Number.isFinite(q.avgPrice) || q.out <= 0) return null;
      return q;
    } catch {return null;}
  };
  const full = attempt(limit);
  if (full) return full;
  // Supported quote sizes form a bounded interval; tiny sizes may round to zero.
  let lo = 1, hi = limit - 1, best: ReturnType<typeof quote> | null = null;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2), q = attempt(mid);
    if (q) {best = q; lo = mid + 1;}
    else if (mid <= 2) lo = mid + 1;
    else hi = mid - 1;
  }
  return best;
}
export interface ClosestMarket {address: string; market: HedgeMarket; differences: string[]; status: string}
export interface HedgeSuggestion {address: string; market: HedgeMarket; direction: BuyDirection; q: ReturnType<typeof quote>; reason: string}
export interface HedgeResult extends ParsedRequest {message: string; closest: ClosestMarket[]; suggestion?: HedgeSuggestion}

/** Searches only the supplied page catalog. Chain state is supplied by the page,
 * never synthesized or fetched here. Ranking ties retain catalog order. */
export function suggestHedge(input: string, catalog: HedgeCatalog, states: Record<string,MarketAccount>, now = new Date()): HedgeResult {
  const parsed = parseHedgeRequest(input,catalog,now), r = parsed.request;
  const result: HedgeResult = {...parsed,message:'',closest:[]};
  if (parsed.issues.length) {result.message = 'Please add or clarify the request.'; return result;}
  const time = Math.floor(now.getTime()/1000);
  const ranked = Object.entries(catalog).map(([address,market],index) => {
    const spec = market.spec, risk = marketRisk(market), differences: string[] = [];
    const city = normalize(spec.city) === normalize(r.location!);
    const overlaps = spec.start <= r.endDate! && spec.end >= r.startDate!;
    const riskMatch = compatible(r.riskType!,risk);
    if (!city) differences.push(`Different city: ${spec.city}.`);
    if (!overlaps) differences.push('Observation dates do not overlap your request.');
    if (!riskMatch) differences.push(`Measures ${riskLabel(risk)}, not ${r.riskType}.`);
    const state = states[address];
    let status = 'Live state unavailable';
    if (spec.historicalDemo || spec.endTs <= time) status = 'Not tradeable: trading ended';
    else if (state) {
      try {const s = marketState(state,time);status = s.resolved ? 'Not tradeable: settled' : s.expired ? 'Not tradeable: trading ended' : s.lEff > 0 && Number.isFinite(s.x) && Number.isFinite(s.y) ? 'Trading open' : 'Not tradeable: liquidity unavailable';}
      catch {status = 'Live state unavailable';}
    }
    const distance = Math.abs(dateMs(spec.start) - dateMs(r.startDate!))/86400000;
    return {address,market,differences,status,exact:city && overlaps && riskMatch,score:(city?10000:0)+(overlaps?1000:0)+(riskMatch?100:0)-Math.min(distance,99),index};
  }).sort((a,b) => b.score - a.score || a.index - b.index);
  const matches = ranked.filter(e => e.exact);
  for (const match of matches) {
    if (match.status !== 'Trading open') continue;
    const q = sizeHedge(states[match.address],r.direction,r.maxPay!,time);
    if (!q) continue;
    const spec = match.market.spec;
    const reason = `${r.direction === 'usdcToYes' ? 'Yes pays if the measured event reaches the strike' : 'No pays if the measured event stays below the strike'} in ${spec.city}. This market measures ${riskLabel(marketRisk(match.market))} at a strike of ≥ ${spec.thresholdTenths/10} mm for ${spec.start} to ${spec.end}. ${spec.start === r.startDate && spec.end === r.endDate ? 'The observation window matches your dates.' : 'The observation window overlaps your dates; it is not the same window.'} The estimated cost, including the trade fee, fits your budget. Solana network fees are additional.`;
    result.suggestion = {address:match.address,market:match.market,direction:r.direction,q,reason};
    result.message = 'One trade to review.';
    return result;
  }
  result.closest = ranked.slice(0,3).map(({address,market,differences,status}) => ({address,market,differences,status}));
  result.message = matches.length ? 'A matching market exists, but no positive trade can be quoted with available live state and your budget. Refresh markets or adjust your request.' : 'No exact match in the loaded catalog. These are the closest markets; their city, dates or weather measurement may differ.';
  if (!ranked.length) result.message = 'No markets are loaded. No trade can be suggested.';
  return result;
}
