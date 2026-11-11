import {excludedWallets,explorerAccount,loadMarketTrades,type HistoryRpc,type TradeRecord} from './stats';

export const LEADERBOARD_CITIES=new Set(['Montreal','Toronto']);
export const CALL_POINTS=10;
export const BOLD_BONUS=5;

export function isHiddenEntry(entry:{hidden?:boolean}) {return entry.hidden===true;}
export function visibleCatalog<T extends {hidden?:boolean}>(catalog:Record<string,T>):Record<string,T> {
  return Object.fromEntries(Object.entries(catalog).filter(([,entry])=>!isHiddenEntry(entry)));
}
export function isLeaderboardMarket(spec:{city:string}) {return LEADERBOARD_CITIES.has(spec.city);}
export function shortenWallet(address:string) {
  if(address.length<8)throw Error('Wallet too short to abbreviate');
  return `${address.slice(0,4)}…${address.slice(-4)}`;
}
export function settledWinner(state:{resolved:boolean;winningSide:number}):'yes'|'no'|null {
  if(!state.resolved)return null;
  if(state.winningSide===1)return 'yes';
  if(state.winningSide===2)return 'no';
  throw Error('Invalid settled winner');
}
/** True when the observed buy price (mUSDC in / shares out) is strictly under 0.30. */
export function boldBonus(volume:bigint,shares:bigint) {
  return shares>0n&&volume>0n&&volume*10n<shares*3n;
}

export interface FirstCall {wallet:string;market:string;side:'yes'|'no';volume:bigint;shares:bigint;signature:string;instruction:number;slot:number}
export function firstCalls(records:TradeRecord[]):FirstCall[] {
  const sorted=[...records].sort((a,b)=>(a.slot-b.slot)||(a.instruction-b.instruction)||a.signature.localeCompare(b.signature));
  const seen=new Set<string>(),out:FirstCall[]=[];
  for(const r of sorted) {
    if(r.direction!==0&&r.direction!==1)continue;
    const key=`${r.wallet}:${r.market}`;
    if(seen.has(key))continue;
    seen.add(key);
    out.push({wallet:r.wallet,market:r.market,side:r.direction===0?'yes':'no',volume:r.volume,shares:r.shares,signature:r.signature,instruction:r.instruction,slot:r.slot});
  }
  return out;
}

export interface LeaderboardRow {rank:number;wallet:string;points:number;correctCalls:number;explorer:string}
export function scoreLeaderboard(calls:FirstCall[],winners:Record<string,'yes'|'no'|null|undefined>,excluded:ReadonlySet<string>=excludedWallets):{settled:boolean;rows:LeaderboardRow[]} {
  const settled=Object.values(winners).some(winner=>winner==='yes'||winner==='no');
  if(!settled)return {settled:false,rows:[]};
  const scores=new Map<string,{points:number;correctCalls:number}>();
  for(const call of calls) {
    if(excluded.has(call.wallet))continue;
    const winner=winners[call.market];
    if(winner!=='yes'&&winner!=='no')continue;
    if(call.side!==winner)continue;
    const cur=scores.get(call.wallet)??{points:0,correctCalls:0};
    cur.points+=CALL_POINTS+(boldBonus(call.volume,call.shares)?BOLD_BONUS:0);
    cur.correctCalls++;
    scores.set(call.wallet,cur);
  }
  return {settled:true,rows:[...scores.entries()].sort((a,b)=>b[1].points-a[1].points||b[1].correctCalls-a[1].correctCalls||a[0].localeCompare(b[0])).map(([wallet,score],index)=>({rank:index+1,wallet,points:score.points,correctCalls:score.correctCalls,explorer:explorerAccount(wallet)}))};
}

export async function loadLeaderboard(rpc:HistoryRpc,catalog:Record<string,{spec:{city:string};createdTx:string}>,states:Record<string,{resolved:boolean;winningSide:number}>,signal?:AbortSignal) {
  const eligible=Object.entries(catalog).filter(([,entry])=>isLeaderboardMarket(entry.spec));
  if(eligible.some(([address])=>!states[address]))throw Error('Leaderboard market state unavailable');
  const records:TradeRecord[]=[];
  const winners:Record<string,'yes'|'no'|null>={};
  for(const [address,entry] of eligible) {
    winners[address]=settledWinner(states[address]);
    records.push(...await loadMarketTrades(rpc,address,entry.createdTx,signal));
  }
  return scoreLeaderboard(firstCalls(records),winners);
}
