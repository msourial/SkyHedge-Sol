import {PublicKey, type Connection, type ParsedTransactionWithMeta, type ParsedInstruction, type PartiallyDecodedInstruction} from '@solana/web3.js';
import bs58 from 'bs58';
import controlled from './controlled-wallets.json';
import {MINT, PROGRAM} from './trading';

export const excludedWallets = new Set(controlled.map(w=>w.publicKey));
export const explorerAccount = (address:string) => `https://explorer.solana.com/address/${encodeURIComponent(address)}?cluster=devnet`;
export const explorerTransaction = (signature:string) => `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet`;
export function statsUnits(raw:bigint):string {
  const fraction=(raw%1000000n).toString().padStart(6,'0').replace(/0+$/,'');
  return (raw/1000000n).toLocaleString('en-US')+(fraction?'.'+fraction:'');
}
export interface TradeRecord {signature:string; instruction:number; market:string; wallet:string; volume:bigint; fee:bigint}
export interface Activity {wallets:string[]; trades:number; volume:bigint; fee:bigint}
export function aggregateTrades(records:TradeRecord[], excluded:ReadonlySet<string>=excludedWallets):Activity {
  const seen=new Set<string>(), wallets=new Set<string>();let trades=0,volume=0n,fee=0n;
  for(const r of records) {
    const id=`${r.signature}:${r.instruction}`;
    if(excluded.has(r.wallet)||seen.has(id))continue;
    if(r.volume<0n||r.fee<0n)throw Error('Negative swap amount');
    seen.add(id);wallets.add(r.wallet);trades++;volume+=r.volume;fee+=r.fee;
  }
  return {wallets:[...wallets],trades,volume,fee};
}
type Ix=ParsedInstruction|PartiallyDecodedInstruction;
const swapTag=[248,198,158,145,225,117,135,200]; // SDK 0.2.0 IDL swap discriminator.
function swap(ix:Ix) {
  if(ix.programId.toBase58()!==PROGRAM||!('data' in ix))return null;
  const bytes=bs58.decode(ix.data);
  if(!swapTag.every((v,i)=>bytes[i]===v))return null;
  if(bytes.length!==25||bytes[8]>5||ix.accounts.length<11)throw Error('Unsupported swap instruction');
  return {accounts:ix.accounts.map(a=>a.toBase58()),direction:bytes[8],amount:new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getBigUint64(9,true)};
}
/** Decode swaps, including CPI swaps. Attribute transfers only when a group contains one swap.
 * All monetary amounts are observed SPL mUSDC transfers; no fee estimates or TVL enter stats. */
export function tradesFromTransaction(tx:ParsedTransactionWithMeta, signature:string, market:string):TradeRecord[] {
  if(!tx.meta)throw Error('Transaction metadata unavailable');
  if(tx.meta.err)return [];
  const records:TradeRecord[]=[];
  tx.transaction.message.instructions.forEach((outer,index)=> {
    const inner=tx.meta!.innerInstructions?.find(g=>g.index===index)?.instructions??[];
    const swaps=[outer,...inner].map(swap).filter(s=>s!==null);
    const relevant=swaps.filter(s=>s.accounts[1]===market&&!excludedWallets.has(s.accounts[0]));
    if(!relevant.length)return;
    if(swaps.length!==1)throw Error('Multiple swaps in one instruction group need manual attribution');
    const s=relevant[0];
    // CPI routers can transfer unrelated tokens beside the swap. Only use its subtree.
    let scoped=inner;
    if(!swap(outer)) {
      const at=inner.findIndex(ix=>swap(ix)?.accounts[1]===market);
      const height=(inner[at] as Ix & {stackHeight?:number}).stackHeight;
      if(typeof height!=='number'||inner.slice(at+1).some(ix=>typeof (ix as Ix & {stackHeight?:number}).stackHeight!=='number'))throw Error('CPI stack attribution unavailable');
      const end=inner.findIndex((ix,i)=>i>at&&(ix as Ix & {stackHeight:number}).stackHeight<=height);
      scoped=inner.slice(at+1,end<0?undefined:end);
    }
    const user=s.accounts[6],feeAccounts=new Set(s.accounts.slice(9,11).filter(a=>a!==PROGRAM));
    const transfers=scoped.flatMap(ix=> {
      if(ix.programId.toBase58()!=='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')return [];
      if(!('parsed' in ix))throw Error('Unparsed token instruction in swap');
      if(ix.program!=='spl-token')throw Error('Unsupported token instruction in swap');
      const {type,info}=ix.parsed;
      if(type!=='transfer'&&type!=='transferChecked')return [];
      const keys=tx.transaction.message.accountKeys;
      const sourceIndex=keys.findIndex(k=>k.pubkey.toBase58()===info.source);
      const mint=info.mint??[...(tx.meta!.preTokenBalances??[]),...(tx.meta!.postTokenBalances??[])].find(b=>b.accountIndex===sourceIndex)?.mint;
      if(!mint)throw Error('Transfer mint unavailable');
      if(mint!==MINT)return [];
      return [{source:info.source as string,destination:info.destination as string,amount:BigInt(info.amount??info.tokenAmount.amount)}];
    });
    const fee=transfers.filter(t=>feeAccounts.has(t.destination)).reduce((n,t)=>n+t.amount,0n);
    // IDL enum order: usdcToYes, usdcToNo, yesToUsdc, noToUsdc, yesToNo, noToYes.
    const debit=transfers.filter(t=>t.source===user).reduce((n,t)=>n+t.amount,0n);
    const credit=transfers.filter(t=>t.destination===user).reduce((n,t)=>n+t.amount,0n);
    const volume=s.direction<2?debit:s.direction<4?credit+fee:0n;
    if(s.direction<2&&debit!==s.amount)throw Error('Swap input transfer mismatch');
    if(s.direction<4&&volume===0n)throw Error('Swap transfers unavailable');
    records.push({signature,instruction:index,market,wallet:s.accounts[0],volume,fee});
  });
  return records;
}
export type HistoryRpc=Pick<Connection,'getSignaturesForAddress'|'getParsedTransaction'>;
/** History must reach the known creation receipt. A missing/pruned page is an error, never zero. */
export async function loadMarketTrades(rpc:HistoryRpc,market:string,createdTx:string,signal?:AbortSignal):Promise<TradeRecord[]> {
  const records:TradeRecord[]=[];let before:string|undefined;const seen=new Set<string>();
  for(let page=0;page<100;page++) {
    signal?.throwIfAborted();
    const signatures=await rpc.getSignaturesForAddress(new PublicKey(market),{before,limit:100},'finalized');
    if(!signatures.length)throw Error('Market history incomplete: creation receipt unavailable');
    for(const entry of signatures) {
      if(seen.has(entry.signature))throw Error('Market history pagination repeated');
      seen.add(entry.signature);
      if(entry.signature===createdTx)return records;
      if(entry.err)continue;
      signal?.throwIfAborted();
      const tx=await rpc.getParsedTransaction(entry.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
      if(!tx)throw Error('Market transaction history unavailable');
      records.push(...tradesFromTransaction(tx,entry.signature,market));
    }
    before=signatures.at(-1)!.signature;
  }
  throw Error('Market history exceeds scan limit');
}
export async function loadActivity(rpc:HistoryRpc,catalog:Record<string,{createdTx:string}>,signal?:AbortSignal) {
  const perMarket:Record<string,Activity>={}, records:TradeRecord[]=[];
  for(const [address,entry] of Object.entries(catalog)) {
    const trades=await loadMarketTrades(rpc,address,entry.createdTx,signal);
    perMarket[address]=aggregateTrades(trades);records.push(...trades);
  }
  return {perMarket,total:aggregateTrades(records)};
}
