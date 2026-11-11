import {PublicKey} from '@solana/web3.js';
import {assertCatalogIdentity} from '../../shared/pm-amm/spec';
import {quote, MINT, rawAmount, marketState} from '../../shared/pm-amm/trading';
import {client, wallet, marketArg, readJson, catalogPath, sendOnce, log, saveJson, logPath} from './operator';
const address=marketArg(), entry=readJson(catalogPath)[address];
if (!entry) throw Error('Unknown catalog market');
const no=process.argv.includes('--no'), kp=wallet(no?'no-trader':'creator'), sdk=client(kp), market=new PublicKey(address);
const state=await sdk.fetchMarket(market); if (!state) throw Error('Missing market');
assertCatalogIdentity(entry,state,MINT);
const direction=no?'usdcToNo':'usdcToYes', amount=rawAmount('5'), q=quote(state,direction,amount);
console.log('Trader',kp.publicKey.toBase58(),'quote',q);
if (process.argv.includes('--send')) {
  const label=`buy:${address}:${direction}`;
  const signature=await sendOnce(label,()=>sdk.send.swap(market,direction,amount,q.minimum));
  const run=log(); const tx=run.transactions.find((t:any)=>t.signature===signature);
  tx.quote=q;tx.wallet=kp.publicKey.toBase58();tx.priceBefore=marketState(state).price;saveJson(logPath,run);
}
