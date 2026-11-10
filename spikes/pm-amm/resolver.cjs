const {createHash} = require('node:crypto');
const c = require('./common.cjs');
const SPEC = Object.freeze({station:'USW00094728',date:'2026-10-01',strikeMm:1});
const URL = `https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries&stations=${SPEC.station}&startDate=${SPEC.date}&endDate=${SPEC.date}&dataTypes=PRCP&units=metric&format=json&includeAttributes=true`;
function evaluate(rows) {
  if (!Array.isArray(rows) || rows.length!==1) throw Error('Expected exactly one daily observation');
  const r=rows[0];
  if(r.STATION!==SPEC.station || r.DATE!==SPEC.date || typeof r.PRCP!=='string' || !/^\d+(\.\d)?$/.test(r.PRCP)) throw Error('Missing or invalid daily PRCP');
  const flags=r.PRCP_ATTRIBUTES?.split(',');
  if(!flags || flags.length!==4 || flags[1]!=='') throw Error('Missing attributes or NOAA quality flag');
  const totalTenths=Math.round(Number(r.PRCP)*10);
  if(!Number.isSafeInteger(totalTenths)) throw Error('PRCP exceeds safe numeric range');
  return {totalMm:totalTenths/10,outcome:totalTenths>=SPEC.strikeMm*10?'yes':'no'};
}
async function observe() {
  const response=await fetch(URL,{signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw Error(`NOAA HTTP ${response.status}`);
  const raw=await response.text(); const values=JSON.parse(raw);
  return {url:URL,fetchedAt:new Date().toISOString(),spec:SPEC,raw,values,sha256:createHash('sha256').update(raw).digest('hex'),...evaluate(values)};
}
async function resolve() {
  const run=c.load(); if(!run.market) throw Error('No created market');
  if(run.transactions.some(t=>t.label==='resolveMarket')) throw Error('Resolution already recorded');
  const creator=c.wallet('creator'); const client=c.client(creator); const market=new c.PublicKey(run.market.marketPda);
  const state=await client.fetchMarket(market);
  if(!state || !state.authority.equals(creator.publicKey) || !state.collateralMint.equals(c.MINT) || Buffer.from(state.name).toString().replace(/\0/g,'')!==run.name) throw Error('Market identity mismatch');
  const slot=await c.connection.getSlot(); const chainTime=await c.connection.getBlockTime(slot);
  if(chainTime===null || chainTime<=state.endTs.toNumber()) throw Error('Market has not ended on chain');
  if(run.resolveAttemptedAt) throw Error('Prior resolve attempt requires manual chain reconciliation');
  run.resolutionObservation=await observe(); c.save(run);
  run.resolveAttemptedAt=new Date().toISOString();c.save(run);
  const signature=await client.send.resolveMarket(market,run.resolutionObservation.outcome);
  await c.record(run,'resolveMarket',signature,{outcome:run.resolutionObservation.outcome});
}
module.exports={SPEC,URL,evaluate,observe,resolve};
if(require.main===module) resolve().catch(e=>{console.error(e.message);process.exitCode=1;});
