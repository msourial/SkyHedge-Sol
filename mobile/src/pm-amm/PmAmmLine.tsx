import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import type { MarketAccount } from '@pm-amm/sdk';
import { catalog, mobileListedMarkets, connection, loadMarkets, loadBalances, units } from '../../../shared/pm-amm/client.ts';
import { marketState, rawAmount, RPC } from '../../../shared/pm-amm/trading.ts';
import { awaitingLabel, marketEyebrow, missingDataNote, sourceLabel, strikeShort, trustParagraph } from '../../../shared/pm-amm/copy.ts';
import { verificationViewModel } from '../../../shared/pm-amm/verification.ts';
import { positionSummary } from '../../../shared/pm-amm/client.ts';
import { evidence } from '../../../shared/pm-amm/client.ts';
import { lineTokens as C } from '../../../shared/ui-tokens.ts';
import type { PerilId } from '../../../shared/ui-types.ts';
import { authorizeDevnetWallet, signAndConfirmDevnetTransaction, type AuthorizedWallet } from '../wallet.ts';
import { loadWalletSession, saveWalletSession, clearWalletSession } from '../wallet-session-store.ts';
import { isWalletDecline } from '../covered.ts';
import { CityPill, Group, LineSheet, PerilTiles, Pill, PillSegmented, Row, ui } from '../line/primitives.tsx';
import { LinePressable } from '../line/pressable.tsx';
import { Section, MarketRow, marketStyles as ms } from '../line/MarketsLine.tsx';
import { protectStyles as s, LineClaimBar, TicketRow } from '../line/ProtectLine.tsx';
import { PayoffChart } from '../line/payout-graphics.tsx';
import { SignSheet, type SignReview } from '../line/SignSheet.tsx';
import { ScreenTransition } from '../liquid-glass.tsx';
import { AboutButton } from '../line/WelcomeScreen.tsx';
import { PerilAvatar } from '../line/PerilAvatar.tsx';
import { dayFromIso } from '../../../shared/ui-ladder.ts';
import { createBuyReview, submitPmAmmBuy, submitPmAmmClaim, QuoteChangedError, reconcilePendingSend, type PendingMarker } from './transactions.ts';
import { securePendingStore } from './pending-store.ts';
import { chance, pmTicket, pmWindowLabel, stationTitle } from './view.ts';

type Tab = 'catalog'|'protect'|'wallet';
type Balances = Awaited<ReturnType<typeof loadBalances>>;
const addresses = Object.keys(mobileListedMarkets);
export function PmAmmLine({tab,onTab,onAbout,navigationRevision}: {tab:string;navigationRevision?:number;onTab:(tab:Tab)=>void;onAbout:()=>void}) {
  const scrollRef=useRef<ScrollView>(null);
  useEffect(()=>{scrollRef.current?.scrollTo({y:0,animated:false});},[tab,navigationRevision]);
  const [states,setStates] = useState<Record<string,MarketAccount>>({});
  const [selected,setSelected] = useState(addresses[0]);
  const [peril,setPeril] = useState<PerilId>('rain');
  const [side,setSide] = useState<'usdcToYes'|'usdcToNo'>('usdcToYes');
  const [amount,setAmount] = useState('');
  const [session,setSession] = useState<AuthorizedWallet|null>(null);
  const owner = useRef<string|null>(null);
  const [pending,setPending]=useState<PendingMarker|null>(null);
  const [pendingStatus,setPendingStatus]=useState<string|null>(null);
  const [balances,setBalances] = useState<Balances|null>(null);
  const [sheet,setSheet] = useState<'city'|'info'|null>(null);
  const [verify,setVerify] = useState<string|null>(null);
  const [error,setError] = useState<string|null>(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const busyRef = useRef(false);
  const [review,setReview] = useState<{sign:SignReview;buy:ReturnType<typeof createBuyReview>}|null>(null);
  const [signature,setSignature] = useState<string|null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const spec = catalog[selected].spec, state = states[selected];
  const cities = [...new Set(addresses.map(a=>catalog[a].spec.city))];
  const cityMarkets = addresses.filter(a=>catalog[a].spec.city===spec.city);
  const refresh = async () => {
    const turn = ++generation.current, wallet = owner.current;
    try {
      const next = await loadMarkets();
      const funds = wallet ? await loadBalances(next,new PublicKey(wallet)) : null;
      const marker = wallet ? await securePendingStore.get(wallet) : null;
      if (mounted.current && turn===generation.current && wallet===owner.current) {setStates(next);setBalances(funds);setPending(marker);setError(null);}
    } catch (e) {if(mounted.current && turn===generation.current)setError(e instanceof Error?e.message:'Could not read Devnet. Try again.');}
    finally {if(mounted.current && turn===generation.current)setLoading(false);}
  };
  useEffect(()=>{
    mounted.current=true;
    void loadWalletSession().then(saved=>{if(!mounted.current)return;owner.current=saved?.address??null;setSession(saved);void refresh();}).catch(()=>{void refresh();});
    const timer=setInterval(()=>{if(AppState.currentState==='active'&&!busyRef.current)void refresh();},15000);
    const listener=AppState.addEventListener('change',v=>{if(v==='active'&&!busyRef.current)void refresh();});
    return ()=>{mounted.current=false;generation.current++;clearInterval(timer);listener.remove();};
  },[]);
  const connect = async () => {
    if(busyRef.current)return;
    try {const next=await authorizeDevnetWallet();owner.current=next.address;setSession(next);setBalances(null);setReview(null);await saveWalletSession(next);await refresh();}catch(e){setError(e instanceof Error?e.message:'Wallet connection did not complete.');}
  };
  const disconnect = () => {if(busyRef.current)return;owner.current=null;generation.current++;setSession(null);setBalances(null);setPending(null);setPendingStatus(null);setReview(null);void clearWalletSession();};
  const changeMarket = (a:string) => {setSelected(a);setPeril('rain');setReview(null);onTab('protect');};
  let preview:SignReview|null=null,quoteError:string|null=null;
  if(state && amount)try {preview=pmTicket({owner:session?.address??'',market:selected,spec,state,direction:side,amountRaw:rawAmount(amount)});}catch(e){quoteError=e instanceof Error?e.message:'Enter an amount.';}
  const marketStatus=state?marketState(state):null;
  const canTrade=!!state&&!marketStatus?.expired&&!marketStatus?.resolved&&peril==='rain';
  const openReview = () => {
    if(!session){void connect();return;}
    if(!preview||!state||!canTrade)return;
    if(!balances){setError('Refresh your wallet balance before reviewing.');return;}
    const raw=rawAmount(amount);
    if(balances.musdc<BigInt(raw)){setError('Not enough mUSDC. Open Wallet for Devnet funding help.');return;}
    setSignature(null);setError(null);
    try {
      const now=Math.floor(Date.now()/1000);
      const input={owner:session.address,market:selected,state,direction:side,amountRaw:raw,now};
      setReview({sign:pmTicket({...input,spec}),buy:createBuyReview(input)});
    } catch(e) {setError(e instanceof Error?e.message:'Refresh the quote before reviewing.');}
  };
  const sign = async (tx:Parameters<typeof submitPmAmmBuy>[0]['sign'] extends (tx:infer T)=>unknown?T:never) => {
    if(!session || owner.current!==session.address)throw Error('The active wallet changed. Reconnect before approving.');
    return signAndConfirmDevnetTransaction({transactionBase64:Buffer.from(tx.serialize()).toString('base64'),wallet:session,rpcUrl:RPC,onSignature:setSignature});
  };
  const collect = async (a:string) => {
    if(!session||busyRef.current)return;
    busyRef.current=true;setBusy(true);setError(null);
    try {await submitPmAmmClaim({connection,owner:new PublicKey(session.address),market:a,store:securePendingStore,sign,getOwner:()=>owner.current});await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Collection did not complete. Check Wallet before trying again.');}
    finally{busyRef.current=false;setBusy(false);}
  };
  const verification = verify?verificationViewModel(catalog[verify].spec,evidence.find(e=>e.market===verify)):null;
  return <View style={{flex:1}}>
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>{setLoading(true);void refresh();}} tintColor={C.glacier}/>} contentContainerStyle={{paddingHorizontal:16,paddingBottom:24,width:"100%",maxWidth:640,alignSelf:"center"}}><ScreenTransition transitionKey={tab}>
      {error?<Group style={{marginVertical:12}}><Row><Text accessibilityRole="alert" style={[ui.body,{flex:1}]}>{error}</Text><LinePressable onPress={()=>{void refresh();}} style={{minHeight:48,justifyContent:'center'}}><Text style={s.link}>Retry</Text></LinePressable></Row></Group>:null}
      {tab==='catalog'?<>
        <View style={s.head}><CityPill city={spec.city} onPress={()=>setSheet('city')}/><View style={{flexDirection:'row',alignItems:'center',gap:8}}><Pill devnet/><AboutButton onPress={onAbout}/></View></View>
        <View style={s.tiles}><PerilTiles value={peril} onChange={setPeril} size="xs"/></View>
        {peril==='rain'?<View style={ms.hero}>
          <View style={ms.heroHeader}><PerilAvatar peril="rain" size={44}/><View style={ms.rowMain}><Text numberOfLines={1} style={ms.cardTitle}>{spec.source==='eccc'?'Precipitation':'Rain'} in {spec.city}</Text><Text style={ms.label}>{pmWindowLabel(spec)}</Text></View><Pill devnet compact/></View>
          <Text style={[ms.label,ms.paysAt]}>Pays out at</Text><View style={ms.numeralLine}><Text style={ms.heroNumeral}>{spec.thresholdTenths/10}</Text><Text style={ms.heroUnit}>mm or more</Text></View>
          <View style={ms.strikes}><Text style={ms.label}>Trigger</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ms.strikeList}>{cityMarkets.map(a=><LinePressable key={a} accessibilityRole="radio" accessibilityState={{selected:a===selected}} onPress={()=>setSelected(a)} style={ms.strikeTarget}><View style={[ms.strike,a===selected&&ms.strikeOn]}><Text style={[ms.strikeText,a===selected&&ms.strikeTextOn]}>{catalog[a].spec.thresholdTenths/10} mm · {dayFromIso(catalog[a].spec.start)}</Text></View></LinePressable>)}</ScrollView></View>
          <View style={ms.stats}><View style={ms.stat}><Text style={ms.label}>Yes chance</Text><Text style={ms.statValue}>{state?chance(state):'—'}</Text></View><View style={ms.stat}><Text style={ms.label}>Status</Text><Text style={[ms.statValue,{fontSize:15}]}>{marketStatus?.resolved?'Settled':marketStatus?.expired?'Trading closed':state?'Trading open':'Reading Devnet…'}</Text></View></View>
          <LinePressable onPress={()=>changeMarket(selected)} style={ms.cta}><Text style={ms.ctaText}>Cover {spec.thresholdTenths/10} mm</Text></LinePressable><Text style={ms.note}>Yes chance is the pool price, not a weather forecast.</Text>
        </View>:null}
        {peril==='rain'?cities.map((city,i)=><Section key={city} title={city} count={`${addresses.filter(a=>catalog[a].spec.city===city).length} markets`} index={i} enter={false}>{addresses.filter(a=>catalog[a].spec.city===city).map((a,j)=><MarketRow key={a} peril="rain" title={`${catalog[a].spec.source==='eccc'?'Precipitation':'Rain'} ≥ ${catalog[a].spec.thresholdTenths/10} mm`} subline={`${catalog[a].spec.historicalDemo?'Historical demo · ':''}${stationTitle(catalog[a].spec.stationName)} · ${pmWindowLabel(catalog[a].spec)}`} action={states[a]?marketState(states[a]).resolved?'Settled':marketState(states[a]).expired?'Trading closed':`${chance(states[a])} Yes`:'Reading Devnet…'} divider={j>0} onPress={()=>changeMarket(a)}/>)}</Section>):<View style={[s.hero,{paddingBottom:20}]}><Text style={ui.figure}>Not available yet</Text><Text style={[ui.body,{marginTop:8}]}>Choose Rain to see the Devnet markets.</Text></View>}
        {loading?<Text style={[ui.label,{marginTop:16}]}>Reading Devnet markets…</Text>:null}
      </>:null}
      {tab==='protect'?<>
        <View style={s.head}><CityPill city={spec.city} onPress={()=>setSheet('city')}/><PillSegmented items={[{value:'window',label:'Window'}]} value="window" onChange={()=>{}} height={40}/></View>
        <Text numberOfLines={1} style={s.sub}>{stationTitle(spec.stationName)} · {pmWindowLabel(spec)}</Text>
        <View style={s.tiles}><PerilTiles value={peril} onChange={setPeril} size="xs"/></View>
        <View style={s.hero}>
          <View style={s.heroHead}><View style={{flex:1}}><Text style={ui.label}>{side==='usdcToNo'?'Pays out below':'Pays out at'}</Text><View style={s.numeralRow}>{peril==='rain'?<><Text style={s.numeral}>{spec.thresholdTenths/10}</Text><Text style={s.unit}>{side==='usdcToNo'?'mm':'mm or more'}</Text></>:<Text style={ui.figure}>Not available yet</Text>}</View></View><LinePressable accessibilityLabel="Settlement information" onPress={()=>setVerify(selected)} style={{minHeight:48,minWidth:48,alignItems:'center',justifyContent:'center'}}><View style={s.infoDot}><Text style={ui.figure}>i</Text></View></LinePressable><Pill devnet compact/></View>
          {peril==='rain'?<>
            <Text style={s.caption}>{marketEyebrow(spec)}</Text>
            <PillSegmented items={[{value:'usdcToYes',label:'Yes'},{value:'usdcToNo',label:'No'}]} value={side} onChange={v=>{setSide(v);setReview(null);}}/>
            {preview?<PayoffChart diagram={preview.ticket.payoff} trigger={spec.thresholdTenths/10} unit="mm" peril="rain" highLabel="" reverse={side==='usdcToNo'}/>:<View style={{height:172,justifyContent:'center'}}><Text style={ui.body}>{marketStatus?.resolved?'Settled':marketStatus?.expired?awaitingLabel(spec):'Enter an amount to see your payout.'}</Text></View>}
            <View style={{flexDirection:'row',justifyContent:'space-between',gap:8,marginTop:6}}><Text style={[ui.figure,{fontSize:15}]}>{preview?`Pay ${units(rawAmount(amount))} · get ${preview.pmAmm?.shares} shares`:'Each winning share pays 1 mUSDC'}</Text></View>
          </>:<Text style={[ui.body,{marginBottom:16}]}>Choose Rain to see the Devnet markets.</Text>}
        </View>
        {peril==='rain'?<>
          <Group style={s.chain}><View style={s.chainHead}>{['Trigger','Yes price','You get','Max loss'].map((label,i)=><Text key={label} style={[ui.label,{flex:i===0?1.25:1,textAlign:i===0?'left':'right'}]}>{label}</Text>)}</View>{cityMarkets.map(a=>{
            const m=states[a],ms=m?marketState(m):null;let row:SignReview|null=null;
            if(m&&amount)try{row=pmTicket({owner:session?.address??'',market:a,spec:catalog[a].spec,state:m,direction:side,amountRaw:rawAmount(amount)});}catch{}
            return <LinePressable key={a} accessibilityRole="radio" accessibilityState={{selected:a===selected}} onPress={()=>setSelected(a)} style={[s.row,a===selected&&s.rowOn]}><View style={{flex:1.25}}><Text style={ui.figure}>{catalog[a].spec.thresholdTenths/10} mm</Text><Text style={ui.label}>{dayFromIso(catalog[a].spec.start)}</Text></View><View style={{flex:1,alignItems:'flex-end'}}><Text style={ui.figure}>{m?chance(m):'—'}</Text><View style={s.chanceTrack}><View style={{height:4,width:ms?`${ms.price*100}%`:'0%',backgroundColor:C.glacier,borderRadius:2}}/></View></View><Text style={[ui.figure,{flex:1,textAlign:'right'}]}>{row?.pmAmm?.shares??'—'}</Text><Text style={[ui.figure,{flex:1,textAlign:'right'}]}>{row?`−${units(rawAmount(amount))}`:ms?.resolved?'Settled':ms?.expired?'Closed':'—'}</Text>{a===selected?<View pointerEvents="none" style={s.innerRing}/>:null}</LinePressable>;
          })}</Group>
          <View style={s.sizeHead}><Text style={ui.label}>Amount, mUSDC</Text></View>
          <TextInput accessibilityLabel="Amount, mUSDC" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="Enter amount" placeholderTextColor={C.dryText} style={[ui.figure,{minHeight:48,paddingHorizontal:16,borderRadius:16,backgroundColor:C.surface1}]}/>
          {quoteError?<Text accessibilityRole="alert" style={s.note}>{quoteError}</Text>:null}
          <Text style={[s.note,{marginTop:12}]}>Yes price is the pool price, not a weather forecast. Each winning share pays 1 mUSDC. Minimum received allows 1% slippage. Solana fees are additional.</Text>
          <Text style={s.note}>{trustParagraph(spec)}</Text><Text style={s.note}>{missingDataNote(spec)}</Text>
          <LinePressable onPress={()=>setVerify(selected)} style={s.textButton}><Text style={s.link}>Settlement information</Text></LinePressable>
        </>:null}
      </>:null}
      {tab==='wallet'?<>
        <View style={s.head}><Text style={[ui.section,{fontSize:28,fontFamily:'Inter_750'}]}>Wallet</Text><View style={{flexDirection:'row',gap:8,alignItems:'center'}}><Pill devnet/><AboutButton onPress={onAbout}/></View></View>
        <View style={s.hero}><Text style={ui.label}>Balance · mUSDC</Text><Text style={[ui.figure,{fontSize:36,lineHeight:44,marginVertical:12}]}>{session&&balances?units(balances.musdc):'—'}</Text>{session?<><Text selectable style={ui.label}>{session.address.slice(0,4)}…{session.address.slice(-4)}</Text><LinePressable onPress={disconnect} style={s.textButton}><Text style={s.link}>Disconnect</Text></LinePressable></>:<LinePressable onPress={()=>{void connect();}} style={ui.cta}><Text style={ui.ctaText}>Connect wallet</Text></LinePressable>}</View>
        {pending?<Group style={{marginTop:12}}><View style={{padding:16}}><Text style={ui.figure}>Check your last transaction</Text><Text style={[ui.body,{marginTop:8}]}>A previous send still needs checking. Another send from this wallet is paused to avoid buying twice.</Text>{pending.signature?<LinePressable style={s.textButton} onPress={()=>{void Linking.openURL(`https://explorer.solana.com/tx/${pending.signature}?cluster=devnet`);}}><Text style={s.link}>View transaction</Text></LinePressable>:<Text style={[ui.label,{marginTop:8}]}>Your wallet did not return a signature. Check its activity before trying again.</Text>}<LinePressable style={s.textButton} disabled={busy} onPress={()=>{if(session)void reconcilePendingSend({connection,owner:session.address,store:securePendingStore}).then(result=>{if(owner.current===session.address){setPending(result.marker);setPendingStatus(result.status);void refresh();}}).catch(e=>setError(e instanceof Error?e.message:'Could not check the transaction.'));}}><Text style={s.link}>Check transaction</Text></LinePressable>{pendingStatus?<Text style={ui.label}>{pendingStatus}</Text>:null}</View></Group>:pendingStatus?<Text style={s.note}>{pendingStatus==='finalized'?'Transaction confirmed.':pendingStatus==='failed'?'Transaction failed. You can review again.':pendingStatus}</Text>:null}
        <View style={{marginTop:28,marginBottom:10,marginHorizontal:4}}><Text style={ui.section}>Your covers</Text></View>
        <Group>{Object.keys(catalog).filter(a=>balances?.positions[a]&&(balances.positions[a].yes>0n||balances.positions[a].no>0n)).map((a,i)=>{
          const p=balances!.positions[a],m=states[a];if(!m)return null;const summary=positionSummary(m,catalog[a].spec,p.yes,p.no);
          return <View key={a}><Row divider={i>0} height={72} onPress={()=>setVerify(a)}><PerilAvatar peril="rain" size={36}/><View style={{flex:1}}><Text style={ui.figure}>{catalog[a].spec.city} · {catalog[a].spec.thresholdTenths/10} mm</Text><Text style={ui.label}>{units(p.yes)} Yes · {units(p.no)} No shares</Text><Text style={ui.label}>{summary.status}</Text></View><View style={{alignItems:'flex-end'}}><Text style={ui.figure}>{units(summary.raw)} mUSDC</Text><Text style={ui.label}>{summary.estimate?'Estimate':'Winning payout'}</Text></View></Row>{summary.collectable?<LineClaimBar label={`Collect ${units(summary.payout)} mUSDC`} busy={busy} onPress={()=>{void collect(a);}}/>:null}</View>;
        })}</Group>
        {session&&balances&&!Object.values(balances.positions).some(p=>p.yes>0n||p.no>0n)?<Text style={[s.note,{marginTop:16}]}>Your shares will appear here after buying.</Text>:null}
        {session?<LinePressable onPress={()=>{void refresh();}} style={s.textButton}><Text style={s.link}>Refresh wallet</Text></LinePressable>:null}
        <Group style={{marginTop:20}}><View style={{padding:16}}><Text style={ui.figure}>Devnet funding</Text><Text style={[ui.body,{marginTop:8}]}>Use test mUSDC for shares and Devnet SOL for fees. The official PREDICT faucet has limits; wait before retrying a refused request.</Text><LinePressable onPress={()=>{void Linking.openURL('https://predict-pm-amm.dev');}} style={s.textButton}><Text style={s.link}>Get Devnet mUSDC</Text></LinePressable><LinePressable onPress={()=>{void Linking.openURL('https://faucet.solana.com/');}} style={s.textButton}><Text style={s.link}>Get Devnet SOL</Text></LinePressable></View></Group>
      </>:null}
    </ScreenTransition></ScrollView>
    {tab==='protect'?<View style={s.pay}><View style={s.payFigs}><Text style={ui.label}>Max loss <Text style={ui.figure}>{preview?`−${units(rawAmount(amount))}`:'—'}</Text></Text><Text style={ui.label}>Max gain <Text style={ui.figure}>{preview?`${preview.ticket.gain.sign}${preview.ticket.gain.whole}.${preview.ticket.gain.fraction}`:'—'}</Text> mUSDC</Text></View><LinePressable disabled={!!session&&(!canTrade||!preview)} onPress={openReview} style={[ui.cta,!!session&&(!canTrade||!preview)&&{backgroundColor:C.surface2}]}><Text style={ui.ctaText}>{!session?'Connect wallet':peril!=='rain'?'Not available yet':marketStatus?.resolved?'Settled':marketStatus?.expired?'Trading closed':preview?`Protect for ${units(rawAmount(amount))} mUSDC`:'Enter amount'}</Text></LinePressable></View>:null}
    {sheet==='city'?<LineSheet title="Choose city" onClose={()=>setSheet(null)}>{cities.map(city=><Row key={city} onPress={()=>{setSelected(addresses.find(a=>catalog[a].spec.city===city)!);setSheet(null);}}><Text style={ui.figure}>{city}</Text></Row>)}</LineSheet>:null}
    {verification?<LineSheet title="Settlement information" onClose={()=>setVerify(null)}><Text style={ui.body}>{verification.trust}</Text><Group style={{marginTop:12}}>{[{label:'Source',value:verification.source},{label:'Station',value:verification.station},{label:verification.stationIdLabel,value:verification.stationId},{label:'Window',value:verification.window},...verification.days.map(d=>({label:d.date,value:`${d.mm} mm`})),{label:'Total',value:verification.totalMm==null?'Not published':`${verification.totalMm} mm`},{label:'Threshold',value:`${verification.thresholdMm} mm`},{label:'Outcome',value:verification.outcome??'Awaiting settlement'}].map((r,i)=><TicketRow key={r.label} {...r} divider={i>0}/>)}</Group><Text selectable style={[ui.label,{marginTop:12}]}>Evidence SHA-256: {verification.sha256??'Not published'}</Text>{verification.resolutionUrl?<LinePressable onPress={()=>{void Linking.openURL(verification.resolutionUrl!);}} style={s.textButton}><Text style={s.link}>View resolution transaction</Text></LinePressable>:null}<LinePressable onPress={()=>{void Linking.openURL(verification.sourceUrl);}} style={s.textButton}><Text style={s.link}>{verification.verifyLabel}</Text></LinePressable><Text style={ui.body}>{verification.missingData}</Text></LineSheet>:null}
    {review?<SignSheet review={review.sign} signature={signature} onClose={()=>setReview(null)} onWallet={()=>onTab('wallet')} onMarkets={()=>onTab('catalog')} onApprove={async(_,onStep)=>{
      if(!session||busyRef.current)return {kind:'error',error:'other',message:'Connect the reviewed wallet before approving.'};
      busyRef.current=true;setBusy(true);
      try {const sig=await submitPmAmmBuy({connection,owner:new PublicKey(session.address),review:review.buy,store:securePendingStore,getOwner:()=>owner.current,sign:async tx=>{onStep('wallet');const result=await sign(tx);onStep('confirm');return result;}});setSignature(sig);await refresh();return {kind:'confirmed'};}
      catch(e){if(e instanceof QuoteChangedError){setReview(null);await refresh();setError('The quote changed. Check the updated shares and review again.');return {kind:'error',error:'other'};}return {kind:'error',error:isWalletDecline(e instanceof Error?e.message:String(e))?'declined':'unconfirmed',message:e instanceof Error?e.message:'Check Wallet before trying again.'};}
      finally{busyRef.current=false;setBusy(false);}
    }}/>:null}
  </View>;
}
