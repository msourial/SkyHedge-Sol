import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PublicKey} from '@solana/web3.js';
import specs from './markets.mid-december.json';
import catalog from './markets.devnet.json';
import {sameStrike,creationParameters,findStrikeAttempt} from './creation';
import {localMidnight,validateSpec,marketName,type MarketSpec} from './spec';
test('threshold-aware strike matching preserves original and historical markets',()=>{
 const spec=specs[0];assert.ok(sameStrike(spec,{...spec,endTs:spec.endTs+1}));
 assert.equal(sameStrike(spec,{...spec,thresholdTenths:100}),false);
 assert.equal(sameStrike(spec,{...spec,start:'2026-12-15'}),false);
 const demo=Object.values(catalog).find(e=>'historicalDemo' in e.spec)!.spec;
 assert.ok(sameStrike(demo,{...demo,endTs:demo.endTs+100}));
 assert.equal(sameStrike(demo,{...demo,historicalDemo:false}),false);
});
test('all expansion strikes close one second before station midnight with exact instruction expiry',()=>{
 const seen=new Set<string>();
 for(const spec of specs as MarketSpec[]){
  validateSpec(spec,Date.parse('2026-11-10T00:00:00Z')/1000);
  assert.equal(spec.endTs,localMidnight(spec.start,spec.timeZone)-1);
  const p=creationParameters(spec,42,PublicKey.default);
  assert.equal(p.endTs,spec.endTs);assert.equal(p.name,marketName(spec));assert.equal(p.initialPriceBps,5000);
  assert.ok(!seen.has(p.name));seen.add(p.name);
 }
 assert.deepEqual(new Set(specs.map(s=>s.thresholdTenths)),new Set([50,100,250]));
});

test('an ambiguous creation attempt blocks the same strike even after close drift',()=>{const spec=specs[0];const attempts={original:{spec}};assert.equal(findStrikeAttempt(attempts,{...spec,endTs:spec.endTs+1}),'original');assert.equal(findStrikeAttempt(attempts,{...spec,thresholdTenths:100}),undefined);});
