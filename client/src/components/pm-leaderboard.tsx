import {useEffect,useState} from 'react';
import type {MarketAccount} from '@pm-amm/sdk';
import {catalog,connection} from '@/lib/pm-amm';
import {loadLeaderboard,shortenWallet,type LeaderboardRow} from '@shared/pm-amm/leaderboard';

export function PmLeaderboard({markets}:{markets:Record<string,MarketAccount>}) {
  const [rows,setRows]=useState<LeaderboardRow[]|null>(null);
  const [settled,setSettled]=useState(false);
  const [error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const ready=Object.keys(markets).length>0;
  const settleKey=Object.entries(markets).map(([address,m])=>`${address}:${m.resolved}:${m.winningSide}`).sort().join('|');
  useEffect(()=> {
    if(!ready)return;
    let active=true;const controller=new AbortController();
    setRows(null);setError('');setSettled(false);
    const timer=setTimeout(()=>{active=false;controller.abort();setError('Leaderboard history took too long. Retry to read on-chain scores.');},20000);
    void loadLeaderboard(connection,catalog,markets,controller.signal).then(result=>{if(active){setSettled(result.settled);setRows(result.rows);}}).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));}).finally(()=>clearTimeout(timer));
    return ()=>{active=false;controller.abort();clearTimeout(timer);};
  },[attempt,ready,settleKey]);
  return <section className="pm-activity pm-leaderboard" aria-label="Will It Rain? leaderboard"><h2>Will It Rain?</h2><p>Public scores from finalized Devnet trades and settlements on Montreal and Toronto markets. No login required. The first Yes or No buy per wallet per market scores 10 points if that side wins, plus 5 if the buy was below 0.30. SkyHedge operator and test wallets are excluded.</p>{!ready&&!error&&<p>Waiting for live market state…</p>}{ready&&!rows&&!error&&<p>Reading on-chain trades and settlements…</p>}{error&&<p role="alert">Leaderboard unavailable: {error}</p>}{rows&&!settled&&<p>The leaderboard stays empty until a Montreal or Toronto market settles.</p>}{rows&&settled&&<>{rows.length===0?<p>No public correct calls yet after settlement.</p>:<div className="pm-activity-scroll"><table><thead><tr><th>Rank</th><th>Wallet</th><th>Points</th><th>Correct calls</th></tr></thead><tbody>{rows.map(row=><tr key={row.wallet}><th scope="row">{row.rank}</th><td><a href={row.explorer} target="_blank" rel="noreferrer">{shortenWallet(row.wallet)}</a></td><td>{row.points}</td><td>{row.correctCalls}</td></tr>)}</tbody></table></div>}</>}{ready&&<button onClick={()=>setAttempt(n=>n+1)}>{error?'Retry leaderboard':'Refresh leaderboard'}</button>}<p className="pm-small">Wallets open in Solana Explorer on Devnet. Scores are computed in the browser from on-chain history, with no database.</p></section>;
}
