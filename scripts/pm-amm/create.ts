import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {PublicKey, ComputeBudgetProgram} from '@solana/web3.js';
import {validateSpec, marketName, assertCatalogIdentity, type MarketSpec} from '../../shared/pm-amm/spec';
import {MINT} from '../../shared/pm-amm/trading';
import {catalogPath, readJson, saveJson, wallet, client, tokenBalances, connection, log, logPath, sendOnce} from './operator';
import {sameStrike,creationParameters,findStrikeAttempt} from '../../shared/pm-amm/creation';
const require=createRequire(import.meta.url);
const {CU}=require('@pm-amm/sdk') as typeof import('@pm-amm/sdk');
const demo = process.argv.includes('--demo');
if(demo&&process.argv.includes('--mid-december'))throw Error('Choose demo or mid-December, not both');
const now = Math.floor(Date.now()/1000);
const midDecember=process.argv.includes('--mid-december');
const expansion:MarketSpec[]=require('../../shared/pm-amm/markets.mid-december.json');
const specs: MarketSpec[] = midDecember?expansion:demo ? [{city:'New York',station:'USW00094728',stationName:'NY CITY CNTRL PARK',timeZone:'America/New_York', start:'2026-10-01',end:'2026-10-02',thresholdTenths:10,endTs:now+660,historicalDemo:true}] : [
  {city:'New York',station:'USW00094728',stationName:'NY CITY CNTRL PARK',timeZone:'America/New_York',start:'2026-12-08',end:'2026-12-09',thresholdTenths:100,endTs:Date.parse('2026-12-07T00:00:00Z')/1000},
  {city:'Chicago',station:'USW00094846',stationName:'CHICAGO OHARE INTL AP',timeZone:'America/Chicago',start:'2026-12-08',end:'2026-12-09',thresholdTenths:100,endTs:Date.parse('2026-12-07T00:00:00Z')/1000},
];
const kp=wallet(), sdk=client(kp), seed=demo?50:400;
console.log('Creator',kp.publicKey.toBase58());
console.log('Available mUSDC raw', (await tokenBalances([new PublicKey(MINT)],kp.publicKey))[0].toString());
for (const spec of specs) {
  const catalog=readJson(catalogPath);
  const existing=Object.entries(catalog).find(([, e]:any)=>sameStrike(e.spec,spec));
  if (existing) {console.log('Already cataloged',existing[0]);continue;}
  validateSpec(spec,now);
  const name=marketName(spec), label=`create:${name}`;
  if(!midDecember&&log().attempts[`create:${demo?'demo':spec.station}`])throw Error('Reconcile legacy creation attempt manually');
  const priorAttempt=findStrikeAttempt(log().attempts,spec);
  if(priorAttempt||log().attempts[label])throw Error(`Reconcile prior create manually: ${priorAttempt??label}`);
  if (!process.argv.includes('--send')) {console.log('Dry run',name,seed);continue;}
  if ((await tokenBalances([new PublicKey(MINT)],kp.publicKey))[0]<BigInt(seed*1e6)) {console.log(`Stop: insufficient funds for another ${seed} mUSDC seed`);break;}
  const lamports=await connection.getBalance(kp.publicKey);
  // Conservative rent/fee budget, estimated from existing creation receipts. Stop before sending.
  if(lamports<36000000){console.log('Stop: creator SOL below estimated 0.036 SOL creation budget');break;}
  const marketId=Number(randomBytes(6).readUIntBE(0,6)),market=sdk.marketPda(marketId);
  const initialize=await sdk.ix.initializeMarket(creationParameters(spec,marketId,kp.publicKey));
  const deposit=await sdk.ix.depositLiquidity({signer:kp.publicKey,market,amount:seed*1e6});
  const ixs=[ComputeBudgetProgram.setComputeUnitLimit({units:CU.HEAVY}),initialize,deposit];
  let created: {marketId:number;marketPda:string;signature:string} | undefined;
  await sendOnce(label,async()=> {
    // Persist deterministic recovery identity before broadcast; never retry an ambiguous send.
    const before=log();Object.assign(before.attempts[label],{marketId,marketPda:market.toBase58(),spec,seedMusdc:seed});saveJson(logPath,before);
    const signature=await sdk.sendIxs(ixs);
    created={marketId,marketPda:market.toBase58(),signature};
    // Save returned PDA immediately, before fetching more chain state.
    const r=log();r.attempts[label].result=created;saveJson(logPath,r);
    return created.signature;
  });
  if (!created) throw Error('Missing creation result; reconcile manually');
  const state=await sdk.fetchMarket(new PublicKey(created.marketPda));
  if (!state) throw Error('Created market not found');
  const actualSpec={...spec,endTs:state.endTs.toNumber()};
  // Explicit instruction expiry must match the named strike exactly; never alter it after sending.
  if (actualSpec.endTs!==spec.endTs) throw Error(`Creation endTs drift: expected ${spec.endTs}, got ${actualSpec.endTs}; reconcile catalog manually`);
  catalog[created.marketPda]={spec, name, creator:kp.publicKey.toBase58(),seedMusdc:seed,createdTx:created.signature,marketId:created.marketId};
  assertCatalogIdentity(catalog[created.marketPda],state,MINT);
  saveJson(catalogPath,catalog);
}
