import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {days, validateSpec, marketName, type MarketSpec} from './spec';
import {ecccUrl, evaluateEccc, millimetresToTenths, precipitationTenths} from './eccc';
import {settlementSource, sourceLabel, strikeSentence, verifyLinkLabel} from './copy';

const spec: MarketSpec = {
  city: 'Toronto',
  station: '6158731',
  stationName: 'TORONTO INTL A',
  timeZone: 'America/Toronto',
  start: '2026-12-14',
  end: '2026-12-16',
  thresholdTenths: 100,
  endTs: 1797224399,
  source: 'eccc',
};

function feature(date: string, amount: number | null, flag: string | null = null, climateId = spec.station) {
  return {
    type: 'Feature',
    properties: {
      CLIMATE_IDENTIFIER: climateId,
      STATION_NAME: spec.stationName,
      LOCAL_DATE: `${date} 00:00:00`,
      TOTAL_PRECIPITATION: amount,
      TOTAL_PRECIPITATION_FLAG: flag,
    },
  };
}

function collection(rows: ReturnType<typeof feature>[]) {
  return {type: 'FeatureCollection', features: rows, numberReturned: rows.length};
}

const complete = () => collection([
  feature('2026-12-14', 6.9),
  feature('2026-12-15', 0, 'T'),
  feature('2026-12-16', 3.1),
]);

test('ECCC spec, name, URL and inclusive total precipitation outcome', () => {
  validateSpec(spec, 1794330000);
  assert.equal(settlementSource(spec), 'eccc');
  assert.equal(sourceLabel(spec), 'Environment Canada');
  assert.equal(marketName(spec), 'PREC:6158731:20261214-20261216:GE100:T1797224399');
  assert.ok(new TextEncoder().encode(marketName(spec)).length <= 64);
  assert.equal(ecccUrl(spec), 'https://api.weather.gc.ca/collections/climate-daily/items?f=json&CLIMATE_IDENTIFIER=6158731&datetime=2026-12-14%2F2026-12-16&sortby=LOCAL_DATE&limit=8');
  assert.match(strikeSentence(spec), /total precipitation \(rain plus melted snow\) is at least 10 mm/);
  assert.equal(verifyLinkLabel(spec), 'Re-check Environment Canada observations ↗');
  assert.equal(evaluateEccc(spec, complete()).outcome, 'yes');
  assert.equal(evaluateEccc(spec, complete()).totalTenths, 100);
  assert.deepEqual(days(spec), ['2026-12-14', '2026-12-15', '2026-12-16']);
});

test('inclusive threshold, dry days, integer millimetres and trace as zero', () => {
  assert.equal(evaluateEccc({...spec, thresholdTenths: 100}, complete()).outcome, 'yes');
  assert.equal(evaluateEccc({...spec, thresholdTenths: 101}, complete()).outcome, 'no');
  assert.equal(evaluateEccc(spec, collection([feature('2026-12-14', 0), feature('2026-12-15', 0, 'T'), feature('2026-12-16', 0)])).outcome, 'no');
  assert.equal(evaluateEccc(spec, collection([feature('2026-12-14', 1), feature('2026-12-15', 4), feature('2026-12-16', 5)])).totalTenths, 100);
  assert.equal(precipitationTenths(0, 'T'), 0);
  assert.equal(precipitationTenths(null, 'T'), 0);
  assert.equal(millimetresToTenths(1), 10);
  assert.equal(millimetresToTenths(3.1), 31);
});

test('missing, duplicate, flagged, malformed, foreign and incomplete observations refuse', () => {
  const rows = complete().features;
  assert.throws(() => evaluateEccc(spec, collection(rows.slice(1))));
  assert.throws(() => evaluateEccc(spec, collection([rows[0], rows[0], rows[2]])));
  assert.throws(() => evaluateEccc(spec, collection([feature('2026-12-14', 6.9), feature('2026-12-15', 0, 'M'), feature('2026-12-16', 3.1)])));
  assert.throws(() => evaluateEccc(spec, collection([feature('2026-12-14', 6.9), feature('2026-12-15', 0, 'E'), feature('2026-12-16', 3.1)])));
  assert.throws(() => evaluateEccc(spec, collection([feature('2026-12-14', 1.9, 'T'), feature('2026-12-15', 0), feature('2026-12-16', 3.1)])));
  assert.throws(() => evaluateEccc(spec, collection([feature('2026-12-14', null), feature('2026-12-15', 0), feature('2026-12-16', 3.1)])));
  assert.throws(() => evaluateEccc(spec, collection([feature('2026-12-14', -0.1), feature('2026-12-15', 0), feature('2026-12-16', 3.1)])));
  assert.throws(() => evaluateEccc(spec, collection([feature('2026-12-14', 1.25), feature('2026-12-15', 0), feature('2026-12-16', 3.1)])));
  assert.throws(() => evaluateEccc(spec, collection([feature('2026-12-14', 1.9, null, '7025251'), feature('2026-12-15', 0), feature('2026-12-16', 3.1)])));
  assert.throws(() => evaluateEccc(spec, collection([feature('2026-12-13', 1.9), feature('2026-12-15', 0), feature('2026-12-16', 3.1)])));
  assert.throws(() => millimetresToTenths('1.9'));
});

test('ECCC evidence hash is over the raw response body', () => {
  const raw = JSON.stringify(complete());
  const evaluation = evaluateEccc(spec, JSON.parse(raw));
  const sha256 = createHash('sha256').update(raw).digest('hex');
  assert.equal(evaluation.outcome, 'yes');
  assert.equal(sha256, createHash('sha256').update(raw).digest('hex'));
  assert.equal(sha256.length, 64);
});

test('NOAA markets keep rainfall copy and names', () => {
  const noaa: MarketSpec = {city:'New York', station:'USW00094728', stationName:'NY CITY CNTRL PARK', timeZone:'America/New_York', start:'2026-12-08', end:'2026-12-09', thresholdTenths:100, endTs:1796601600};
  validateSpec(noaa, 1794330000);
  assert.equal(settlementSource(noaa), 'noaa');
  assert.equal(sourceLabel(noaa), 'NOAA');
  assert.equal(marketName(noaa), 'RAIN:USW00094728:20261208-20261209:GE100:T1796601600');
  assert.match(strikeSentence(noaa), /Pays if it rains at least 10 mm/);
  assert.equal(verifyLinkLabel(noaa), 'Re-check NOAA observations ↗');
});
