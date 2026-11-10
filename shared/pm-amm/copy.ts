import type {MarketSpec} from './spec';

export function settlementSource(spec: Pick<MarketSpec, 'source'>): 'noaa' | 'eccc' {
  return spec.source === 'eccc' ? 'eccc' : 'noaa';
}

export function sourceLabel(spec: Pick<MarketSpec, 'source'>): string {
  return settlementSource(spec) === 'eccc' ? 'Environment Canada' : 'NOAA';
}

export function strikeSentence(spec: MarketSpec): string {
  const amount = `${spec.thresholdTenths / 10} mm`;
  if (settlementSource(spec) === 'eccc') {
    return `Pays if total precipitation (rain plus melted snow) is at least ${amount} at ${spec.stationName} between ${spec.start} and ${spec.end}, inclusive.`;
  }
  return `Pays if it rains at least ${amount} at ${spec.stationName} between ${spec.start} and ${spec.end}, inclusive.`;
}

export function strikeShort(spec: MarketSpec): string {
  const amount = `${spec.thresholdTenths / 10} mm`;
  return settlementSource(spec) === 'eccc'
    ? `Total precipitation ≥ ${amount} · ${spec.stationName}`
    : `Rainfall ≥ ${amount} · ${spec.stationName}`;
}

export function marketEyebrow(spec: MarketSpec): string {
  if (spec.historicalDemo) return 'KNOWN-OUTCOME MECHANICS DEMO';
  return settlementSource(spec) === 'eccc' ? 'ENVIRONMENT CANADA / TOTAL PRECIPITATION' : 'NOAA / RAINFALL';
}

export function positionEyebrow(spec: MarketSpec): string {
  if (spec.historicalDemo) return 'HISTORICAL DEMO';
  return settlementSource(spec) === 'eccc' ? 'PRECIPITATION MARKET' : 'RAIN MARKET';
}

export function awaitingLabel(spec: MarketSpec): string {
  return settlementSource(spec) === 'eccc' ? 'Awaiting Environment Canada settlement' : 'Awaiting NOAA settlement';
}

export function trustParagraph(spec: MarketSpec): string {
  const name = sourceLabel(spec);
  return `Settled by SkyHedge's single resolver key using ${name} data. ${name} can revise data; there is no dispute window yet. You can re-check the numbers yourself at the link.`;
}

export function missingDataNote(spec: MarketSpec): string {
  return `Missing or quality-flagged ${sourceLabel(spec)} data delays settlement. There is no guaranteed refund or alternative station. Starting prices are pool settings, not weather forecasts.`;
}

export function verifyLinkLabel(spec: MarketSpec): string {
  return settlementSource(spec) === 'eccc' ? 'Re-check Environment Canada observations ↗' : 'Re-check NOAA observations ↗';
}
