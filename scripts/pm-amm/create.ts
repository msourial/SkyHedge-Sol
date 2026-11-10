import fs from 'node:fs';
import {PublicKey} from '@solana/web3.js';
import {validateSpec, marketName, type MarketSpec} from '../../shared/pm-amm/spec';
import {quote, MINT} from '../../shared/pm-amm/trading';
import {catalogPath, readJson, saveJson, wallet, client, tokenBalances, connection, log, logPath, sendOnce} from './operator';
const demo = process.argv.includes('--demo');
const now = Math.floor(Date.now()/1000);
const specs: MarketSpec[] = demo ? [{city:'New York',station:'USW00094728',stationName:'NY CITY CNTRL PARK',timeZone:'America/New_York', start:'2026-10-01',end:'2026-10-02',thresholdTenths:10,endTs:now+660,historicalDemo:true}] : [
  {city:'New York',station:'USW00094728',stationName:'NY CITY CNTRL PARK',timeZone:'America/New_York',start:'2026-12-08',end:'2026-12-09',thresholdTenths:100,endTs:Date.parse('2026-12-07T00:00:00Z')/1000},
  {city:'Chicago',station:'USW00094846',stationName:'CHICAGO OHARE INTL AP',timeZone:'America/Chicago',start:'2026-12-08',end:'2026-12-09',thresholdTenths:100,endTs:Date.parse('2026-12-07T00:00:00Z')/1000},
];
const kp=wallet(), sdk=client(kp), seed=demo?50:400;
console.log('Creator',kp.publicKey.toBase58());
console.log('Available mUSDC raw', (await tokenBalances([new PublicKey(MINT)],kp.publicKey))[0].toString());
for (const spec of specs) {
  const catalog=readJson(catalogPath);
  const existing=Object.entries(catalog).find(([, e]:any)=>e.spec.station===spec.station && e.spec.start===spec.start && e.spec.end===spec.end && e.spec.historicalDemo===spec.historicalDemo);
  if (existing) {console.log('Already cataloged',existing[0]);continue;}
  validateSpec(spec,now);
  const name=marketName(spec), label=`create:${demo?'demo':spec.station}`;
  if (log().attempts[label]) throw Error(`Reconcile prior create manually: ${label}`);
  if (!process.argv.includes('--send')) {console.log('Dry run',name,seed);continue;}
  if ((await tokenBalances([new PublicKey(MINT)],kp.publicKey))[0]<BigInt(seed*1e6)) throw Error('Insufficient seed funds');
  let created: Awaited<ReturnType<typeof sdk.send.createMarket>> | undefined;
  await sendOnce(label,async()=> {
    created=await sdk.send.createMarket({name,durationSecs:spec.endTs-Math.floor(Date.now()/1000),initialPriceBps:5000,depositUsdc:seed});
    // Save returned PDA immediately, before fetching more chain state.
    const r=log();r.attempts[label].result=created;saveJson(logPath,r);
    return created.signature;
  });
  if (!created) throw Error('Missing creation result; reconcile manually');
  const state=await sdk.fetchMarket(new PublicKey(created.marketPda));
  if (!state) throw Error('Created market not found');
  const actualSpec={...spec,endTs:state.endTs.toNumber()};
  // SDK computes endTs from its own wall clock. Reject drift rather than silently changing the named strike.
  if (actualSpec.endTs!==spec.endTs) throw Error(`Creation endTs drift: expected ${spec.endTs}, got ${actualSpec.endTs}; reconcile catalog manually`);
  catalog[created.marketPda]={spec, name, creator:kp.publicKey.toBase58(),seedMusdc:seed,createdTx:created.signature,marketId:created.marketId};
  saveJson(catalogPath,catalog);
}
