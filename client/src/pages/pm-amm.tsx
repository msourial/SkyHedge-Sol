import {useCallback, useEffect, useMemo, useRef, useState, type FC, type ReactNode} from 'react';
import {Link, useLocation} from 'react-router-dom';
import {ConnectionProvider, WalletProvider, useWallet, type ConnectionProviderProps} from '@solana/wallet-adapter-react';
import {PhantomWalletAdapter} from '@solana/wallet-adapter-phantom';
import {WalletModalProvider} from '@solana/wallet-adapter-react-ui';
import {AnchorProvider} from '@anchor-lang/core';
import {PmAmmClient, type MarketAccount, type SwapDirection} from '@pm-amm/sdk';
import {PublicKey} from '@solana/web3.js';
import {CloudRain, ArrowUpRight, CheckCircle2, RefreshCw, Wallet, ChevronRight} from 'lucide-react';
import {useBurnerSession} from '@/lib/pm-burner/session';
import {WalletButton, WalletStatusProvider, useWalletStatus} from '@/components/wallet-button';
import {catalog, connection, evidence, explorer, loadBalances, loadMarkets, units, settledRedemptions} from '@/lib/pm-amm';
import {quote, rawAmount, marketState, positionValue, payout, quoteStateKey, RPC, PROGRAM, MINT} from '@shared/pm-amm/trading';
import '@solana/wallet-adapter-react-ui/styles.css';
import './pm-amm.css';
const SafeConnection=ConnectionProvider as unknown as FC<ConnectionProviderProps & {children?:ReactNode}>;
const wallets=[new PhantomWalletAdapter()];
function PhantomProvider({children}:{children:ReactNode}) {
  const {reportError}=useWalletStatus();
  return <WalletProvider wallets={wallets} autoConnect={false} onError={reportError}><WalletModalProvider>{children}</WalletModalProvider></WalletProvider>;
}
export default function PmAmm() {
  return <WalletStatusProvider><SafeConnection endpoint={RPC}><PhantomProvider><Trading /></PhantomProvider></SafeConnection></WalletStatusProvider>;
}
type Review={address:string;direction:SwapDirection;amount:number;q:ReturnType<typeof quote>;owner:string;stateKey:string};
function Trading() {
  const wallet=useWallet();
  const burner=useBurnerSession();
  const [walletMode,setWalletMode]=useState<'burner'|'phantom'>('burner');
  const [exported,setExported]=useState<string|null>(null),[resetReview,setResetReview]=useState(false);
  const burnerActive=walletMode==='burner';
  const phantomSdk=useMemo(()=>wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions ? PmAmmClient.fromProvider(new AnchorProvider(connection,{publicKey:wallet.publicKey,signTransaction:wallet.signTransaction,signAllTransactions:wallet.signAllTransactions},{commitment:'confirmed'}),new PublicKey(PROGRAM),new PublicKey(MINT)):null,[wallet.publicKey,wallet.signTransaction,wallet.signAllTransactions]);
  const sdk=burnerActive&&burner.status==='ready'?burner.client:!burnerActive?phantomSdk:null;
  const owner=burnerActive?burner.publicKey:wallet.publicKey;
  const [markets,setMarkets]=useState<Record<string,MarketAccount>>({});
  const [balances,setBalances]=useState<Awaited<ReturnType<typeof loadBalances>>|null>(null);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[review,setReview]=useState<Review|null>(null);
  const [amount,setAmount]=useState(''),[selected,setSelected]=useState(Object.keys(catalog)[0]),[side,setSide]=useState<SwapDirection>('usdcToYes');
  const actionInFlight=useRef(false);
  const [pending,setPending]=useState<string|null>(null);
  const [storageError,setStorageError]=useState('');
  const [lastTx,setLastTx]=useState<Record<string,string>>({});
  const location=useLocation(), positions=location.pathname.endsWith('/positions');
  const activeOwner=useRef(owner?.toBase58()); activeOwner.current=owner?.toBase58();
  const request=useRef(0);
  const refresh=useCallback(async()=> {
    const id=++request.current, address=owner?.toBase58();
    try {
      const next=await loadMarkets();
      const b=owner?await loadBalances(next,owner):null;
      if (id!==request.current || activeOwner.current!==address) return;
      setMarkets(next);setBalances(b);setError('');
    } catch(e) {if(id===request.current) {setMarkets({});setBalances(null);setError(message(e));}}
  },[owner]);
  useEffect(()=> {setReview(null);setBalances(null);setLastTx({});try{setPending(owner?localStorage.getItem('skyhedge-pm-pending:'+owner.toBase58()):null);setStorageError('');}catch{setPending(null);setStorageError('Browser storage is unavailable. Enable it to trade safely; wallet balance reads still work.');}void refresh();},[refresh]);
  useEffect(()=>{if(burnerActive&&burner.status==='ready')void refresh();},[burnerActive,burner.status,refresh]);
  useEffect(()=> {const timer=setInterval(()=>{if(!document.hidden)void refresh();},15000);return()=>clearInterval(timer);},[refresh]);
  const m=markets[selected];
  async function perform(action:()=>Promise<string>,address:string) {
    if(!owner||actionInFlight.current)throw Error('A wallet action is already in progress');
    const ownerAddress=owner.toBase58(), key='skyhedge-pm-pending:'+ownerAddress;
    if(localStorage.getItem(key))throw Error('Check the previous transaction in wallet activity before trading again');
    actionInFlight.current=true;
    try {
      localStorage.setItem(key,JSON.stringify({market:address,at:new Date().toISOString()}));setPending(localStorage.getItem(key));
      const signature=await action();localStorage.removeItem(key);if(activeOwner.current===ownerAddress)setPending(null);return signature;
    }catch(e){if(/user rejected|user declined|approval.*rejected/i.test(message(e))){localStorage.removeItem(key);if(activeOwner.current===ownerAddress)setPending(null);}throw e;}finally{actionInFlight.current=false;}
  }
  const reviewTrade=()=> {
    try {if(!m)throw Error('Live market state unavailable');const raw=rawAmount(amount);if(!owner||!sdk)throw Error('Wait for demo wallet funding or connect Phantom to trade');setReview({address:selected,direction:side,amount:raw,q:quote(m,side,raw),owner:owner.toBase58(),stateKey:quoteStateKey(m)});setError('');setNotice('');}catch(e){setError(message(e));}
  };
  async function send() {
    if(!review||!sdk||!owner||busy||actionInFlight.current)return;
    setBusy(true);setError('');setNotice('');
    try {
      if(activeOwner.current!==review.owner)throw Error('Wallet changed. Review again.');
      const latest=await loadMarkets(),state=latest[review.address];
      if(!state)throw Error('Market unavailable');
      const fresh=quote(state,review.direction,review.amount);
      setMarkets(latest);
      if(quoteStateKey(state)!==review.stateKey||fresh.out<review.q.minimum||fresh.fee!==review.q.fee) {
        setReview({...review,q:fresh,stateKey:quoteStateKey(state)});setNotice('The quote changed. Review the updated amounts and confirm again.');return;
      }
      if(activeOwner.current!==review.owner)throw Error('Wallet changed. Review again.');
      const signature=await perform(()=>sdk.send.swap(new PublicKey(review.address),review.direction,review.amount,review.q.minimum),review.address);
      if(activeOwner.current!==review.owner)return;
      setLastTx(t=>({...t,[review.address]:signature}));setReview(null);setNotice('Trade confirmed on devnet.');await refresh();if(burnerActive)await burner.refresh();
    }catch(e){setError(`${message(e)} If a transaction was sent, check your wallet history before trying again.`);setReview(null);}finally{setBusy(false);}
  }
  async function collect(address:string) {
    if(!sdk||!owner||busy||actionInFlight.current)return;setBusy(true);setError('');
    try {const ownerAtSend=owner.toBase58();const signature=await perform(()=>sdk.send.claimWinnings(new PublicKey(address)),address);if(activeOwner.current!==ownerAtSend)return;setLastTx(t=>({...t,[address]:signature}));setNotice('Collected on devnet.');await refresh();if(burnerActive)await burner.refresh();}catch(e){setError(`${message(e)} Check your wallet history before trying again.`);}finally{setBusy(false);}
  }
  return <div className="pm-app"><header className="pm-header"><Link to="/" className="pm-brand"><CloudRain aria-hidden="true"/>SkyHedge</Link><span className="pm-devnet">Devnet · play money</span>{!burnerActive&&<WalletButton/>}</header>
    <main className="pm-main"><nav className="pm-nav" aria-label="Trading"><Link aria-current={!positions?'page':undefined} to="/app">Markets</Link><Link aria-current={positions?'page':undefined} to="/app/positions">Positions</Link><button onClick={()=>void refresh()} aria-label="Refresh markets"><RefreshCw size={16}/></button></nav>
    <section className="pm-wallet-panel" aria-label="Wallet options"><div className="pm-wallet-tabs"><button aria-pressed={burnerActive} disabled={busy} onClick={()=>{setWalletMode('burner');setReview(null);}}>Demo wallet</button><button aria-pressed={!burnerActive} disabled={busy} onClick={()=>{setWalletMode('phantom');setReview(null);setExported(null);}}>Use Phantom</button></div>{burnerActive&&<><p>Devnet play money only. This wallet is saved in this browser. Clearing browser storage loses access; export your key to keep it.</p>{burner.status==='funding'||burner.status==='loading'?<p role="status">Setting up your devnet wallet…</p>:null}{burner.error&&<p role="alert">{burner.error}</p>}{burner.balances&&burner.status==='ready'&&<p>{burner.balances.usdc.toLocaleString()} mUSDC · {burner.balances.sol.toLocaleString(undefined,{maximumFractionDigits:9})} devnet SOL</p>}<div className="pm-wallet-actions"><button disabled={busy||!burner.publicKey} onClick={()=>setExported(burner.exportKey())}>Export key</button><button disabled={busy||burner.status==='funding'} onClick={()=>setResetReview(true)}>New wallet</button></div>{exported&&<div><label htmlFor="burner-secret">Secret devnet key — anyone with this key can use this wallet</label><textarea id="burner-secret" readOnly value={exported}/><button onClick={()=>setExported(null)}>Hide key</button></div>}{resetReview&&<div role="alert"><p>Export first. Replacing this wallet removes this browser's access to its positions. A new wallet does not bypass faucet limits.</p><button disabled={busy} onClick={()=>{setExported(null);if(burner.reset())setResetReview(false);}}>Replace wallet</button><button onClick={()=>setResetReview(false)}>Keep wallet</button></div>}</>}</section>
    <div className="pm-title"><p className="pm-eyebrow">WEATHER MARKETS / SOLANA</p><h1>{positions?'Your weather positions':'Trade the weather.'}</h1><p>Rainfall markets for individuals and businesses. Choose Yes or No, trade in mUSDC, and collect if your side wins.</p></div>
    {balances&&<div className="pm-balance"><Wallet size={18}/><span>{units(balances.musdc)} mUSDC available</span><small>{owner?.toBase58()}</small></div>}
    {storageError&&<p role="alert" className="pm-error">{storageError}</p>}{pending&&owner&&<div className="pm-error"><p>A previous wallet action needs checking. Open your <a href={`https://explorer.solana.com/address/${owner.toBase58()}?cluster=devnet`} target="_blank" rel="noreferrer">devnet wallet activity</a> before trying again. Repeating an uncertain send can duplicate a trade.</p><button disabled={busy} onClick={()=>{try{localStorage.removeItem('skyhedge-pm-pending:'+owner.toBase58());setPending(null);}catch{setStorageError('Browser storage is unavailable; previous action still needs checking.');}}}>I checked activity; allow another action</button></div>}
    {error&&<p role="alert" className="pm-error">{error}</p>}{notice&&<p role="status" className="pm-notice">{notice}</p>}
    {positions ? <section aria-label="Positions" className="pm-grid">{!owner?<p>Connect a wallet to see your positions.</p>:!balances?<p>Position balances unavailable. Refresh to try again.</p>:Object.entries(catalog).map(([address,entry])=> {
      const state=markets[address],b=balances.positions[address];if(!state||!b||b.yes+b.no===0n)return null;
      const value=positionValue(state,Number(b.yes),Number(b.no)); const winning=payout(state,b.yes,b.no);
      return <article className="pm-card" key={address}><p className="pm-eyebrow">{entry.spec.historicalDemo?'HISTORICAL DEMO':'RAIN MARKET'}</p><h2>{entry.spec.city}</h2><p>{entry.spec.start} – {entry.spec.end}</p><div className="pm-stats"><div><small>Yes shares</small><strong>{units(b.yes)}</strong></div><div><small>No shares</small><strong>{units(b.no)}</strong></div></div><p>{value.estimate?'Estimated current value':'Winning payout'} <strong>{units(value.raw)} mUSDC</strong></p><p>{state.resolved?'Settled':marketState(state).expired?'Awaiting NOAA settlement':'Trading open'}</p>{winning>0n&&<button className="pm-primary" disabled={busy} onClick={()=>void collect(address)}>Collect {units(winning)} mUSDC</button>}{lastTx[address]&&<a href={explorer(lastTx[address])} target="_blank" rel="noreferrer">View transaction ↗</a>}<Verification address={address}/></article>;
    })}{balances&&Object.values(balances.positions).every(b=>b.yes+b.no===0n)&&<p>No outcome tokens in this wallet yet. <Link to="/app">Browse markets →</Link></p>}</section>:
    <div className="pm-workspace"><section className="pm-market-list" aria-label="Markets">{Object.entries(catalog).map(([address,entry])=> {const state=markets[address],s=state?marketState(state):null;return <article key={address} className={`pm-card ${selected===address?'pm-selected':''}`}><div className="pm-card-top"><span className="pm-eyebrow">{entry.spec.historicalDemo?'KNOWN-OUTCOME MECHANICS DEMO':'NOAA / RAINFALL'}</span><span className="pm-status">{s?s.resolved?'Settled':s.expired?'Awaiting data':'Trading open':'Live state unavailable'}</span></div><h2>{entry.spec.city}<CloudRain aria-hidden="true"/></h2><p>{entry.spec.stationName}</p><p className="pm-strike">Pays if it rains at least <strong>{entry.spec.thresholdTenths/10} mm</strong> at {entry.spec.stationName} between {entry.spec.start} and {entry.spec.end}, inclusive.</p><div className="pm-market-bottom"><div><small>Yes price</small><strong>{s?`${(s.price*100).toFixed(2)}¢`:'—'}</strong></div><div><small>Probability</small><strong>{s?`${(s.price*100).toFixed(2)}%`:'—'}</strong></div><button aria-label={`Select ${entry.spec.city} ${entry.spec.historicalDemo?'demo':'market'}`} onClick={()=>{setSelected(address);setReview(null);setNotice('');}}>{s?.resolved?'View result':'Trade'}<ChevronRight size={16}/></button></div><small>Trading ends {new Date(entry.spec.endTs*1000).toLocaleString()} · your local time</small><Verification address={address}/></article>;})}</section>
    <aside className="pm-ticket"><p className="pm-eyebrow">MAKE YOUR CALL</p><h2>{catalog[selected].spec.city}</h2><p>{catalog[selected].spec.start} – {catalog[selected].spec.end}</p>{review?<section aria-label="Review trade"><h3>Review your trade</h3><dl><dt>You pay</dt><dd>{units(review.amount)} mUSDC</dd><dt>You get (estimate)</dt><dd>{units(review.q.out)} {review.direction==='usdcToYes'?'Yes':'No'} shares</dd><dt>Minimum received</dt><dd>{units(review.q.minimum)} shares</dd><dt>Fee (included)</dt><dd>{units(review.q.fee)} mUSDC</dd></dl><p>Each winning share pays 1 mUSDC. Minimum received allows 1% slippage. Solana network fees are additional.</p><button className="pm-primary" disabled={busy||!sdk} onClick={()=>void send()}>{busy?'Confirming…':'Confirm trade'}</button><button disabled={busy} onClick={()=>setReview(null)}>Back</button></section>:<><div className="pm-sides"><button aria-pressed={side==='usdcToYes'} onClick={()=>setSide('usdcToYes')}>Yes</button><button aria-pressed={side==='usdcToNo'} onClick={()=>setSide('usdcToNo')}>No</button></div><label htmlFor="pm-amount">Amount · mUSDC</label><input id="pm-amount" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Enter amount"/><p>Each winning share pays 1 mUSDC. Prices move as people trade.</p><button className="pm-primary" disabled={busy||!m||marketState(m).expired||m.resolved} onClick={reviewTrade}>Review trade <ArrowUpRight size={18}/></button>{m&&(m.resolved||marketState(m).expired)&&<p>Trading has ended for this market.</p>}</>}<div className="pm-trust"><CheckCircle2 size={18}/><p>Settled by SkyHedge's single resolver key using NOAA data. NOAA can revise data; there is no dispute window yet. You can re-check the numbers yourself at the link.</p></div><p className="pm-small">Missing or quality-flagged NOAA data delays settlement. There is no guaranteed refund or alternative station. Starting prices are pool settings, not weather forecasts.</p>{lastTx[selected]&&<a href={explorer(lastTx[selected])} target="_blank" rel="noreferrer">View transaction ↗</a>}</aside></div>}
    <footer className="pm-footer">PREDICT pm-AMM · Weather hedging for farmers, events, aviation, vendors and you.</footer></main></div>;
}
function Verification({address}:{address:string}) {
  const e=evidence.find(e=>e.market===address);if(!e)return null;
  return <details className="pm-verify"><summary>How to verify</summary><p>Station {e.spec.station} · {e.spec.stationName}</p><ul>{e.evaluation.perDay.map(d=><li key={d.date}>{d.date}: {d.tenths/10} mm</li>)}</ul><p>Total {e.evaluation.totalTenths/10} mm · threshold ≥ {e.evaluation.thresholdTenths/10} mm · outcome {e.evaluation.outcome.toUpperCase()}</p><a href={e.url} target="_blank" rel="noreferrer">Re-check NOAA observations ↗</a>{e.resolveTx&&<a href={explorer(e.resolveTx)} target="_blank" rel="noreferrer">Resolution transaction ↗</a>}{settledRedemptions.filter(t=>t.label.includes(address)).map(t=><a key={t.signature} href={explorer(t.signature)} target="_blank" rel="noreferrer">{t.label.startsWith('creator-')?'Creator redemption':'Demo trader Collect'} transaction ↗</a>)}<p>Fetched {e.fetchedAt}</p><p className="pm-hash">SHA-256 {e.sha256}</p><p>Settled by SkyHedge's single resolver key using NOAA data. NOAA can revise data; there is no dispute window yet. You can re-check the numbers yourself at the link.</p></details>;
}
function message(e:unknown) {return e instanceof Error?e.message:String(e);}
