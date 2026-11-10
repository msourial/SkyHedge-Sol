import {Connection, PublicKey} from '@solana/web3.js';
import {PmAmmClient, type MarketAccount} from '@pm-amm/sdk';
import {getAssociatedTokenAddressSync, unpackAccount} from '@solana/spl-token';
import {fetchMarkets, MINT, PROGRAM, RPC} from '@shared/pm-amm/trading';
import {assertCatalogIdentity, type MarketSpec} from '@shared/pm-amm/spec';
import catalogJson from '@shared/pm-amm/markets.devnet.json';
import run from '../../../docs/pm-amm-web/run.devnet.json';
import type {Evidence} from '@shared/pm-amm/noaa';
import {visibleCatalog} from '@shared/pm-amm/leaderboard';
export interface CatalogEntry {spec:MarketSpec;name:string;creator:string;seedMusdc:number;createdTx:string;marketId:number;hidden?:boolean}
export const catalog = catalogJson as Record<string,CatalogEntry>;
export const listedMarkets = visibleCatalog(catalog);
export const connection = new Connection(RPC,{commitment:'confirmed',disableRetryOnRateLimit:true});
export const readClient = PmAmmClient.readOnly(connection,new PublicKey(PROGRAM),new PublicKey(MINT));
export const evidence = Object.values(import.meta.glob('../../../shared/pm-amm/evidence/*.json',{eager:true,import:'default'})) as Evidence[];
export const explorer = (signature:string) => `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
export async function loadMarkets():Promise<Record<string,MarketAccount>> {
  const addresses=Object.keys(catalog);
  const states=await fetchMarkets(readClient,addresses.map(a=>new PublicKey(a)));
  return Object.fromEntries(states.flatMap((m,i)=> {
    if (!m) return [];
    assertCatalogIdentity(catalog[addresses[i]],m,MINT);
    return [[addresses[i],m]];
  }));
}
export async function loadBalances(states:Record<string,MarketAccount>,owner:PublicKey) {
  const addresses=Object.keys(states), mints=[new PublicKey(MINT),...addresses.flatMap(a=>[states[a].yesMint,states[a].noMint])];
  const atas=mints.map(m=>getAssociatedTokenAddressSync(m,owner));
  const accounts=await connection.getMultipleAccountsInfo(atas);
  const raw=accounts.map((info,i)=>info?unpackAccount(atas[i],info).amount:0n);
  return {musdc:raw[0],positions:Object.fromEntries(addresses.map((a,i)=>[a,{yes:raw[1+i*2],no:raw[2+i*2]}]))};
}
export const units = (raw:number|bigint) => (Number(raw)/1e6).toLocaleString('en-US',{maximumFractionDigits:6});

export const settledRedemptions = run.transactions.filter(t=>t.label.startsWith('collect:')||t.label.startsWith('creator-winnings:'));
