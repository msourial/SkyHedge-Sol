// Read-only reconciliation: preserve actual chain receipts, including failed sends.
const c=require('./common.cjs');
async function main(){
  const run=c.load();
  run.receipts=[];
  for(const t of run.transactions){
    const tx=await c.connection.getTransaction(t.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
    if(!tx || !tx.meta) throw Error(`Receipt unavailable: ${t.label}`);
    const keys=tx.transaction.message.staticAccountKeys || tx.transaction.message.accountKeys;
    run.receipts.push({label:t.label,signature:t.signature,slot:tx.slot,blockTime:tx.blockTime,error:tx.meta.err,feeLamports:tx.meta.fee,
      payer:keys[0].toBase58(),payerLamportsDelta:tx.meta.postBalances[0]-tx.meta.preBalances[0],
      preTokenBalances:tx.meta.preTokenBalances,postTokenBalances:tx.meta.postTokenBalances});
    const receipt=run.receipts.at(-1);
    receipt.trackedMusdcDeltas={};
    for(const [role,owner] of Object.entries(run.wallets)) {
      const sum=items=>items.filter(b=>b.owner===owner && b.mint===run.mint).reduce((n,b)=>n+BigInt(b.uiTokenAmount.amount),0n);
      receipt.trackedMusdcDeltas[role]=(sum(tx.meta.postTokenBalances)-sum(tx.meta.preTokenBalances)).toString();
    }
    c.save(run);
    if(tx.meta.err && !t.error) throw Error(`Unexpected on-chain error: ${t.label}`);
  }
  if(run.market){
    const market=await c.readClient().fetchMarket(new c.PublicKey(run.market.marketPda));
    run.verifiedMarket={address:run.market.marketPda,authority:market.authority.toBase58(),collateralMint:market.collateralMint.toBase58(),name:Buffer.from(market.name).toString().replace(/\0/g,''),startTs:market.startTs.toNumber(),endTs:market.endTs.toNumber(),resolved:market.resolved,winningSide:market.winningSide};
  }
  const creation=run.receipts.find(t=>t.label==='createMarket');
  if(creation) run.creationMeasurement={method:'finalized transaction payer pre/post lamports',successfulCreateLamportsSpent:-creation.payerLamportsDelta,failedCreateFeeLamports:run.receipts.filter(t=>t.label==='createMarket:failed300s').reduce((n,t)=>n+t.feeLamports,0)};
  if(run.completedAt) {
    if(!run.verifiedMarket.resolved || run.verifiedMarket.winningSide!==(run.resolutionObservation.outcome==='yes'?1:2)) throw Error('Resolved outcome mismatch');
    for(const label of ['createMarket','buyYES','buyNO','resolveMarket','claimWinnings','claimLpResiduals','claimLpWinnings']) if(run.transactions.filter(t=>t.label===label).length!==1) throw Error('Missing or duplicate action: '+label);
  }
  run.verifiedAt=new Date().toISOString();c.save(run);console.log('Verified finalized receipts:',run.receipts.length);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
