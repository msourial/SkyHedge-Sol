import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import BN from 'bn.js';
import type {MarketAccount} from '@pm-amm/sdk';
import {days, validateSpec, marketName, localMidnight, noaaUrl, type MarketSpec} from './spec';
import {evaluate, type Evidence} from './noaa';
import {quote, rawAmount, payout, positionValue} from './trading';
const spec: MarketSpec = {city:'New York', station:'USW00094728', stationName:'NY CITY CNTRL PARK', timeZone:'America/New_York', start:'2026-12-07', end:'2026-12-08', thresholdTenths:10, endTs:1796601600};
const rows = (a = '0.4', b = '0.6') => [a,b].map((PRCP,i) => ({STATION:spec.station, DATE:days(spec)[i], PRCP, PRCP_ATTRIBUTES:',,1,2400'}));
test('spec window, local midnight and deterministic name', () => {
  validateSpec(spec, 1794330000);
  assert.equal(localMidnight('2026-12-07', spec.timeZone), Date.parse('2026-12-07T05:00:00Z')/1000);
  assert.equal(marketName(spec), 'RAIN:USW00094728:20261207-20261208:GE10:T1796601600');
  assert.ok(new TextEncoder().encode(marketName(spec)).length <= 64);
  assert.throws(() => validateSpec({...spec, endTs:localMidnight(spec.start, spec.timeZone)+1}));
  assert.throws(() => days({...spec, start:'2026-02-30'}));
  assert.throws(() => days({...spec, end:'2026-12-06'}));
  assert.throws(() => validateSpec({...spec, thresholdTenths:1.1}));
  assert.throws(() => validateSpec(spec, spec.endTs-599));
  assert.throws(() => validateSpec({...spec, historicalDemo:true}, 1794330000));
});
test('inclusive multi-day boundary and dry observations', () => {
  assert.equal(evaluate(spec, rows()).outcome, 'yes');
  assert.equal(evaluate(spec, rows('0.0','0.0')).outcome, 'no');
  assert.equal(evaluate(spec, rows()).totalTenths,10);
});
test('missing, duplicate, flagged, malformed, foreign and overflowing observations refuse', () => {
  assert.throws(() => evaluate(spec, rows().slice(1)));
  assert.throws(() => evaluate(spec, [rows()[0],rows()[0]]));
  for (const change of [{PRCP_ATTRIBUTES:',X,1,2400'}, {PRCP:'-1.0'}, {PRCP:'NaN'}, {PRCP:1}, {PRCP:'0.01'}, {PRCP:'9007199254740992'}, {STATION:'USW00094846'}, {DATE:'2026-12-09'}, {PRCP_ATTRIBUTES:null}]) {
    assert.throws(() => evaluate(spec, [{...rows()[0], ...change},rows()[1]]));
  }
  assert.throws(() => evaluate(spec, rows('900719925474099.0','900719925474099.0')));
});
const fixed = (n: number) => new BN(BigInt(Math.round(n * 2**32)).toString()).shln(16);
const m = {endTs:new BN(1000),lastAccrualTs:new BN(0),lZero:fixed(100e6/0.3989422804014327/Math.sqrt(1000)), reserveYes:fixed(100e6),reserveNo:fixed(100e6),resolved:false,winningSide:0} as MarketAccount;
test('raw units, fees, slippage, buy/sell and settled value', () => {
  assert.equal(rawAmount('10.123456'),10123456);
  for (const bad of ['0','-1','1e6','1.1234567','9007199254.740992']) assert.throws(() => rawAmount(bad));
  const q = quote(m,'usdcToYes',10e6,0);
  assert.equal(q.fee,200000); assert.equal(q.minimum,Math.floor(q.out*0.99));
  assert.ok(q.out>10e6 && q.out<20e6);
  assert.equal(quote(m,'usdcToNo',10e6,0).out,q.out);
  assert.ok(quote(m,'yesToUsdc',10e6,0).out>0);
  assert.throws(() => quote(m,'usdcToYes',10e6,1000));
  assert.equal(payout({...m,resolved:true,winningSide:2},1n,2n),2n);
  assert.ok(Math.abs(positionValue(m,1000000,0,0).raw-500000)<0.01);
});
test('public evidence retains reproducible raw response and outcome', () => {
  const raw=JSON.stringify(rows());
  const e: Evidence={market:'public-address',spec,url:noaaUrl(spec),raw,fetchedAt:new Date(0).toISOString(),sha256:createHash('sha256').update(raw).digest('hex'),evaluation:evaluate(spec,JSON.parse(raw)),resolveTx:null};
  assert.equal(e.sha256.length,64); assert.equal(e.evaluation.perDay.length,2);
  assert.equal(new URL(e.url).searchParams.get('stations'),spec.station);
});

test('station-local observation end and DST', async () => {
  const {observationEnd, assertCatalogIdentity}=await import('./spec');
  assert.equal(observationEnd({...spec,end:'2026-12-08'}),Date.parse('2026-12-09T05:00:00Z')/1000);
  assert.equal(observationEnd({...spec,end:'2026-12-08',timeZone:'America/Chicago'}),Date.parse('2026-12-09T06:00:00Z')/1000);
  assert.equal(observationEnd({...spec,end:'2026-11-01'}),Date.parse('2026-11-02T05:00:00Z')/1000);
  const entry={spec,name:marketName(spec),creator:'creator'};
  const state={name:Array.from(new TextEncoder().encode(entry.name)),endTs:{toNumber:()=>spec.endTs},authority:{toBase58:()=>'creator'},collateralMint:{toBase58:()=>'mint'}};
  assert.doesNotThrow(()=>assertCatalogIdentity(entry,state,'mint'));
  assert.throws(()=>assertCatalogIdentity({...entry,spec:{...spec,thresholdTenths:11}},state,'mint'));
});

test('LP residuals skip fully checkpointed positions and include entry surplus',async()=> {
 const {pendingResiduals}=await import('./trading');const q=1n<<48n;
 const state={cumYesPerShare:new BN((2n*q).toString()),cumNoPerShare:new BN(q.toString())};
 const lp={shares:new BN((10n*q).toString()),yesPerShareCheckpoint:state.cumYesPerShare,noPerShareCheckpoint:state.cumNoPerShare};
 assert.deepEqual(pendingResiduals(state,lp),{yes:0n,no:0n});
 assert.deepEqual(pendingResiduals(state,{...lp,yesPerShareCheckpoint:new BN(q.toString()),excessNo:new BN(3)}),{yes:10n,no:3n});
});
