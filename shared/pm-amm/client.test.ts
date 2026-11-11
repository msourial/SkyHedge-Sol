import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import BN from 'bn.js';
import {Keypair} from '@solana/web3.js';
import type {MarketAccount} from '@pm-amm/sdk';
import {catalog,listedMarkets,mobileListedMarkets,evidence,loadBalances,positionSummary} from './client';
import {verificationViewModel} from './verification';

const fixed = (n:number)=>new BN(BigInt(Math.round(n*2**32)).toString()).shln(16);
const market = {endTs:new BN(1000),lastAccrualTs:new BN(0),lZero:fixed(100e6/0.3989422804014327/Math.sqrt(1000)),reserveYes:fixed(100e6),reserveNo:fixed(100e6),resolved:false,winningSide:0,yesMint:Keypair.generate().publicKey,noMint:Keypair.generate().publicKey} as MarketAccount;
const spec=Object.values(catalog)[0].spec;

test('native catalog starts Toronto then Montreal and uses web visibility',()=> {
  const cities=Object.values(mobileListedMarkets).map(entry=>entry.spec.city);
  assert.equal(cities[0],'Toronto');
  assert.ok(cities.indexOf('Montreal')>cities.lastIndexOf('Toronto'));
  assert.ok(cities.findIndex(city=>city!=='Toronto'&&city!=='Montreal')>cities.lastIndexOf('Montreal'));
  assert.ok(!cities.includes('Seattle')&&!cities.includes('Miami'));
  assert.deepEqual(Object.keys(mobileListedMarkets).sort(),Object.keys(listedMarkets).sort());
});

test('static evidence index covers each committed JSON exactly once',()=> {
  const names=readdirSync(new URL('./evidence/',import.meta.url)).filter(name=>name.endsWith('.json')).sort();
  assert.deepEqual(evidence.map(record=>record.market+'.json').sort(),names);
});

test('balances use batched associated token reads and missing accounts are zero',async()=> {
  let calls=0;
  const balances=await loadBalances({market},Keypair.generate().publicKey,{getMultipleAccountsInfo:async addresses=> {
    calls++;
    assert.equal(addresses.length,3);
    assert.equal(new Set(addresses.map(address=>address.toBase58())).size,3);
    return [null,null,null];
  }});
  assert.equal(calls,1);
  assert.deepEqual(balances,{musdc:0n,positions:{market:{yes:0n,no:0n}}});
});

test('positions expose estimated marks and collect only settled winning shares',()=> {
  const open=positionSummary(market,spec,2_000_000n,0n,0);
  assert.equal(open.status,'Trading open');assert.equal(open.estimate,true);assert.equal(open.collectable,false);
  assert.ok(Math.abs(open.raw-1_000_000)<.01);
  assert.equal(positionSummary(market,spec,2_000_000n,0n,1000).status,'Awaiting NOAA settlement');
  assert.equal(positionSummary(market,{...spec,source:'eccc'},0n,0n,1000).status,'Awaiting Environment Canada settlement');
  const winner=positionSummary({...market,resolved:true,winningSide:1},spec,2_000_000n,3n,1000);
  assert.equal(winner.payout,2_000_000n);assert.equal(winner.collectable,true);assert.equal(winner.estimate,false);assert.equal(winner.status,'Settled');
  assert.equal(positionSummary({...market,resolved:true,winningSide:2},spec,2_000_000n,0n,1000).collectable,false);
});

test('verification preserves published daily values, total, outcome and public links',()=> {
  const record=evidence[0],view=verificationViewModel(record.spec,record);
  assert.deepEqual(view.days,record.evaluation.perDay.map(day=>({date:day.date,mm:day.tenths/10})));
  assert.equal(view.totalMm,record.evaluation.totalTenths/10);assert.equal(view.thresholdMm,record.spec.thresholdTenths/10);
  assert.equal(view.sha256,record.sha256);assert.equal(view.outcome,record.evaluation.outcome);
  assert.equal(view.stationId,record.spec.station);assert.equal(view.source,'NOAA');
  assert.equal(new URL(view.resolutionUrl!).searchParams.get('cluster'),'devnet');
  assert.equal(new URL(view.sourceUrl).searchParams.get('stations'),record.spec.station);
  assert.match(view.trust,/single resolver key/);assert.match(view.missingData,/delays settlement/);
  assert.throws(()=>verificationViewModel({...record.spec,thresholdTenths:123},record),/does not match/);
  const pending=verificationViewModel({...record.spec,source:'eccc',station:'6158731'});
  assert.equal(pending.source,'Environment Canada');assert.equal(pending.stationIdLabel,'Climate ID');
  assert.equal(pending.totalMm,null);assert.equal(pending.outcome,null);assert.deepEqual(pending.days,[]);
});

test('native and shared market source copy avoids unrelated product framing',()=> {
  const forbidden=new RegExp(['insur'+'ance','wed'+'ding'].join('|'),'i');
  const visit=(directory:URL):void=> {
    for(const entry of readdirSync(directory,{withFileTypes:true})) {
      const path=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
      if(entry.isDirectory())visit(path);
      else if(/\.(?:ts|tsx|json)$/.test(entry.name))assert.doesNotMatch(readFileSync(path,'utf8'),forbidden,String(path));
    }
  };
  visit(new URL('../../mobile/src/',import.meta.url));
  visit(new URL('./',import.meta.url));
});
