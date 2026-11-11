import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createFilePendingStore} from './pm-amm-pending-store.ts';
import {Connection,Keypair} from '@solana/web3.js';
import {PmAmmClient} from '@pm-amm/sdk';
import {PublicKey} from '@solana/web3.js';
import {MINT,PROGRAM,RPC,rawAmount} from '../../shared/pm-amm/trading.ts';
import {assertControlledWallet,createBuyReview,submitPmAmmBuy} from '../src/pm-amm/transactions.ts';

async function main() {
  const args=process.argv.slice(2),value=(flag:string)=>args[args.indexOf(flag)+1];
  const market=value('--market'),side=value('--side'),amount=value('--amount');
  if (!args.includes('--market')||!market||!['yes','no'].includes(side)||!args.includes('--amount')) throw Error('Usage: --market <address> --side yes|no --amount 1 [--send]');
  const path=process.env.SKYHEDGE_TRADER_KEYPAIR;
  if (!path) throw Error('Set SKYHEDGE_TRADER_KEYPAIR to a controlled trader keypair path');
  let trader:Keypair;
  try {trader=Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(path,'utf8'))));}
  catch {throw Error('Unable to load the trader keypair from the provided path');}
  const rpc=process.env.SKYHEDGE_PMAMM_RPC??RPC;
  assertControlledWallet(trader.publicKey.toBase58(),rpc);
  const connection=new Connection(rpc,'confirmed');
  const client=PmAmmClient.readOnly(connection,new PublicKey(PROGRAM),new PublicKey(MINT));
  const state=await client.fetchMarket(new PublicKey(market));if (!state) throw Error('Market not found');
  const review=createBuyReview({owner:trader.publicKey.toBase58(),market,state,direction:side==='yes'?'usdcToYes':'usdcToNo',amountRaw:rawAmount(amount)});
  console.log(JSON.stringify({market,side,amountRaw:review.quote.amount,estimatedSharesRaw:review.quote.out,minimumRaw:review.quote.minimum,feeRaw:review.quote.fee},null,2));
  if (!args.includes('--send')) return;
  const store=createFilePendingStore(fileURLToPath(new URL('../.pmamm-pending/',import.meta.url)));
  const signature=await submitPmAmmBuy({connection,owner:trader.publicKey,review,store,sign:async tx=>{
    tx.sign([trader]);const signature=await connection.sendRawTransaction(tx.serialize(),{skipPreflight:false,maxRetries:0});
    try {
      const result=await connection.confirmTransaction(signature,'finalized');
      if (result.value.err) throw Error(`Transaction failed: ${signature}`);
    } catch {throw Object.assign(Error(`Check transaction confirmation: ${signature}`),{signature});}
    return signature;
  }});
  console.log(signature);console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Buy failed');process.exitCode=1;});
