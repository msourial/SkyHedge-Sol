import {useEffect,useState} from 'react';
import {catalog,connection} from '@/lib/pm-amm';
import {loadActivity,explorerAccount,statsUnits,type Activity} from '@shared/pm-amm/stats';

export function PmActivity() {
  const [data,setData]=useState<Awaited<ReturnType<typeof loadActivity>>|null>(null);
  const [error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  useEffect(()=> {
    let active=true;const controller=new AbortController();
    setData(null);setError('');
    const timer=setTimeout(()=>{active=false;controller.abort();setError('Stats history took too long. Retry to read devnet activity.');},20000);
    void loadActivity(connection,catalog,controller.signal).then(result=>{if(active)setData(result);}).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));}).finally(()=>clearTimeout(timer));
    return ()=>{active=false;controller.abort();clearTimeout(timer);};
  },[attempt]);
  function row(label:string,a:Activity,addresses:string[]) {
    const href=explorerAccount(addresses[0]);
    return <tr key={label}><th scope="row">{label}{addresses.slice(1).map(address=><a key={address} href={explorerAccount(address)} target="_blank" rel="noreferrer" aria-label={`Additional total source ${address}`}> ↗</a>)}</th>{[String(a.wallets.length),String(a.trades),statsUnits(a.volume),statsUnits(a.fee)].map((value,i)=><td key={i}><a href={href} target="_blank" rel="noreferrer">{value}</a></td>)}</tr>;
  }
  return <section className="pm-activity" aria-label="Public market activity"><h2>Public market activity</h2><p>Finalized Devnet swaps · SkyHedge operator and test wallets excluded. Volume is the gross mUSDC leg; fees are observed mUSDC transfers. Outcome-to-outcome swaps count as trades with zero mUSDC volume and fees.</p>{!data&&!error&&<p>Reading on-chain trade history…</p>}{error&&<p role="alert">Stats unavailable: {error}</p>}{data&&<><div className="pm-activity-scroll"><table><thead><tr><th>Market</th><th>Unique trader wallets</th><th>Trades</th><th>Volume (mUSDC)</th><th>Fees (mUSDC)</th></tr></thead><tbody>{row('All markets',data.total,Object.keys(catalog))}{Object.entries(catalog).map(([address,e])=>row(`${e.spec.city} · ${e.spec.thresholdTenths/10} mm · ${e.spec.start}${e.spec.historicalDemo?' · demo':''}`,data.perMarket[address],[address]))}</tbody></table></div>{data.total.trades===0&&<p>No public swaps found after excluding SkyHedge wallets. All figures are zero.</p>}</>}<button onClick={()=>setAttempt(n=>n+1)}>{error?'Retry stats':'Refresh stats'}</button><p className="pm-small">Each figure opens its market account in Solana Explorer. Total sources include every catalog market. History failures are shown here separately from live market prices.</p></section>;
}
