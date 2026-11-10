import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {observationEnd, days, noaaUrl, type MarketSpec} from '../../shared/pm-amm/spec';
import {evaluate, type Evidence} from '../../shared/pm-amm/noaa';
import {checkedMarket, connection, marketArg, sendOnce, saveJson, readJson, log} from './operator';
const address = marketArg();
const {entry, sdk, market, state} = await checkedMarket(address);
const spec: MarketSpec = entry.spec;
days(spec);
const slot = await connection.getSlot(), chainTime = await connection.getBlockTime(slot);
if (chainTime === null || chainTime <= state.endTs.toNumber() || chainTime <= observationEnd(spec)) throw Error('Wait until trading and observation days have ended');
const file = `shared/pm-amm/evidence/${address}.json`;
const label = `resolve:${address}`;
const run = log(), recorded = run.transactions.find((t: any) => t.label === label);
if (recorded) {
  if (!fs.existsSync(file)) throw Error('Logged resolution missing evidence; reconcile manually');
  const evidence: Evidence = readJson(file);
  if (evidence.market !== address || evidence.evaluation.outcome !== (state.winningSide === 1 ? 'yes' : state.winningSide === 2 ? 'no' : null) || !state.resolved) throw Error('Logged resolution differs from chain; reconcile manually');
  evidence.resolveTx = recorded.signature; saveJson(file, evidence);
  console.log('Already resolved', recorded.signature);
} else if (run.attempts[label]) {
  throw Error('Prior resolution attempt: preserve evidence and reconcile chain manually');
} else if (state.resolved) {
  throw Error('Already resolved without local signature; reconcile manually');
} else {
  const url = noaaUrl(spec);
  const response = await fetch(url, {signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw Error(`NOAA HTTP ${response.status}`);
  const raw = await response.text();
  const evidence: Evidence = {market:address, spec, url, raw, fetchedAt:new Date().toISOString(), sha256:createHash('sha256').update(raw).digest('hex'), evaluation:evaluate(spec, JSON.parse(raw)), resolveTx:null};
  console.log(JSON.stringify(evidence.evaluation));
  if (process.argv.includes('--send')) {
    // Snapshot is written once before the attempt marker/send. Reruns with a marker never replace it.
    saveJson(file, evidence);
    evidence.resolveTx = await sendOnce(label, () => sdk.send.resolveMarket(market, evidence.evaluation.outcome));
    saveJson(file, evidence);
  } else console.log('Dry run; use --send to resolve (no evidence file changed)');
}
