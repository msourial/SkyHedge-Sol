const c=require('./common.cjs');
const {observe,resolve}=require('./resolver.cjs');
const {quoteSwap,minOutput,marketState}=require('./helpers.cjs');
const {getAssociatedTokenAddressSync}=require('@solana/spl-token');
async function balances(kp) {
  const sol=await c.connection.getBalance(kp.publicKey);
  const ata=getAssociatedTokenAddressSync(c.MINT,kp.publicKey);
  const info=await c.connection.getAccountInfo(ata);
  const usdc=info?(await c.connection.getTokenAccountBalance(ata)).value.amount:'0';
  return {lamports:sol,microMusdc:usdc};
}
async function main(){
  const creator=c.wallet('creator'), no=c.wallet('no-trader');
  let run=c.fs.existsSync(c.runPath)?c.load():{startedAt:new Date().toISOString(),rpc:c.connection.rpcEndpoint,program:c.PROGRAM.toBase58(),mint:c.MINT.toBase58(),name:'NYC Central Park rain >=1mm 2026-10-01 (NOAA)',wallets:{creator:creator.publicKey.toBase58(),noTrader:no.publicKey.toBase58()},transactions:[],funding:{},blockers:[]};
  if(run.wallets.creator!==creator.publicKey.toBase58() || run.wallets.noTrader!==no.publicKey.toBase58()) throw Error('External wallets do not match recorded run');
  c.save(run);
  try {
    run.initialObservation ||= await observe(); c.save(run);
    for(const [role,kp] of [['creator',creator],['noTrader',no]]) {
      if(!run.funding[role]) {
        // Persist attempt BEFORE the request: reruns never repeat faucet claims.
        run.funding[role]={attemptedAt:new Date().toISOString()};c.save(run);
        const response=await fetch('https://pm-amm-devnet.vercel.app/api/faucet',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({wallet:kp.publicKey.toBase58()}),signal:AbortSignal.timeout(30000)});
        run.funding[role]={...run.funding[role],status:response.status,body:await response.json()}; c.save(run);
        if(run.funding[role].body.signature) await c.record(run,`faucet:${role}`,run.funding[role].body.signature);
        if(!response.ok) throw Error(`Faucet blocked ${role}: HTTP ${response.status}`);
      }
      const b=await balances(kp);run.funding[role].balance=b;c.save(run);
      if(b.lamports<10000000 || BigInt(b.microMusdc)<60000000n) throw Error(`Insufficient devnet funds for ${role}`);
    }
    const client=c.client(creator);
    if(!run.market){
      if(run.createAttemptedAt) throw Error('Prior create attempt requires manual chain reconciliation');
      run.beforeCreate=await balances(creator);run.createAttemptedAt=new Date().toISOString();c.save(run);
      run.market=await client.send.createMarket({name:run.name,durationSecs:600,initialPriceBps:5000,depositUsdc:50});
      await c.record(run,'createMarket',run.market.signature,{seedMusdc:50});
      run.afterCreate=await balances(creator);run.creationLamportsSpent=run.beforeCreate.lamports-run.afterCreate.lamports;c.save(run);
    }
    const market=new c.PublicKey(run.market.marketPda);
    for(const [label,kp,direction] of [['buyYES',creator,'usdcToYes'],['buyNO',no,'usdcToNo']]) {
      if(run.transactions.some(t=>t.label===label)) continue;
      run.attempts ||= {};
      if(run.attempts[label]) throw Error(`Reconcile prior ${label} attempt manually`);
      const before=await client.fetchMarket(market); const quote=quoteSwap(before,direction,5000000); const minimum=minOutput(quote);
      run.attempts[label]={at:new Date().toISOString(),quote,minimum};c.save(run);
      const signature=await c.client(kp).send.swap(market,direction,5000000,minimum);
      await c.record(run,label,signature,{inputMicro:5000000,quote,minimum,priceBefore:marketState(before).price});
      const after=await client.fetchMarket(market);run.transactions.at(-1).priceAfter=marketState(after).price;c.save(run);
    }
    const state=await client.fetchMarket(market);run.endTs=state.endTs.toNumber();c.save(run);
    if(Date.now()/1000<=run.endTs+3){console.log('Trades complete. Run again after',new Date((run.endTs+4)*1000).toISOString());return;}
    if(!run.transactions.some(t=>t.label==='resolveMarket')) await resolve();
    run=c.load();
    for(const [label,kp,action] of [['claimWinnings',run.resolutionObservation.outcome==='yes'?creator:no,'claimWinnings'],['claimLpResiduals',creator,'claimLpResiduals'],['claimLpWinnings',creator,'claimWinnings']]) {
      if(run.transactions.some(t=>t.label===label)) continue;
      if(run.attempts[label]) throw Error(`Reconcile prior ${label} manually`);
      run.attempts[label]={at:new Date().toISOString()};c.save(run);
      const before=await balances(kp);const signature=await c.client(kp).send[action](market);
      await c.record(run,label,signature,{before});run.transactions.at(-1).after=await balances(kp);c.save(run);
    }
    run.finalMarket=await client.fetchMarket(market);run.completedAt=new Date().toISOString();c.save(run);
  } catch(e){run=c.load();run.blockers.push({at:new Date().toISOString(),message:e instanceof Error?e.message:String(e)});c.save(run);throw e;}
}
main().catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1;});
