import {Connection, PublicKey} from '@solana/web3.js';
import {PmAmmClient, type MarketAccount} from '@pm-amm/sdk';
import {getAssociatedTokenAddressSync, unpackAccount} from '@solana/spl-token';
import {fetchMarkets, marketState, payout, positionValue, MINT, PROGRAM, RPC} from './trading';
import {assertCatalogIdentity, type MarketSpec} from './spec';
import catalogJson from './markets.devnet.json';
import {visibleCatalog} from './leaderboard';
import {awaitingLabel} from './copy';
export {evidence} from './evidence/index';

export interface CatalogEntry {spec:MarketSpec;name:string;creator:string;seedMusdc:number;createdTx:string;marketId:number;hidden?:boolean}
export const catalog = catalogJson as Record<string,CatalogEntry>;
export const listedMarkets = visibleCatalog(catalog);
/** Native discovery places the Canadian launches first; all other visibility is shared with web. */
export const mobileListedMarkets = Object.fromEntries(Object.entries(listedMarkets).sort(([,a],[,b]) => {
  const rank=(city:string)=>city==='Toronto'?0:city==='Montreal'?1:2;
  return rank(a.spec.city)-rank(b.spec.city);
}));
export const connection = new Connection(RPC,{commitment:'confirmed',disableRetryOnRateLimit:true});
export const readClient = PmAmmClient.readOnly(connection,new PublicKey(PROGRAM),new PublicKey(MINT));
export const explorer = (signature:string) => `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
export async function loadMarkets(rpc:Connection=connection):Promise<Record<string,MarketAccount>> {
  const addresses=Object.keys(catalog);
  const client=rpc===connection?readClient:PmAmmClient.readOnly(rpc,new PublicKey(PROGRAM),new PublicKey(MINT));
  const states=await fetchMarkets(client,addresses.map(a=>new PublicKey(a)));
  return Object.fromEntries(states.flatMap((m,i)=> {
    if (!m) return [];
    assertCatalogIdentity(catalog[addresses[i]],m,MINT);
    return [[addresses[i],m]];
  }));
}
export async function loadBalances(states:Record<string,MarketAccount>,owner:PublicKey,rpc:Pick<Connection,'getMultipleAccountsInfo'>=connection) {
  const addresses=Object.keys(states), mints=[new PublicKey(MINT),...addresses.flatMap(a=>[states[a].yesMint,states[a].noMint])];
  const atas=mints.map(m=>getAssociatedTokenAddressSync(m,owner));
  const accounts=await rpc.getMultipleAccountsInfo(atas);
  const raw=accounts.map((info,i)=>info?unpackAccount(atas[i],info).amount:0n);
  return {musdc:raw[0],positions:Object.fromEntries(addresses.map((a,i)=>[a,{yes:raw[1+i*2],no:raw[2+i*2]}]))};
}
export const units = (raw:number|bigint) => (Number(raw)/1e6).toLocaleString('en-US',{maximumFractionDigits:6});

export function positionSummary(market:MarketAccount,spec:MarketSpec,yes:bigint,no:bigint,now?:number) {
  const state=marketState(market,now);
  const winningPayout=payout(market,yes,no);
  return {yes,no,...positionValue(market,Number(yes),Number(no),now),payout:winningPayout,collectable:state.resolved&&winningPayout>0n,
    status:state.resolved?'Settled':state.expired?awaitingLabel(spec):'Trading open'};
}
