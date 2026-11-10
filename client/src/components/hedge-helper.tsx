import {useMemo, useState, type FormEvent} from 'react';
import type {MarketAccount} from '@pm-amm/sdk';
import {marketRisk, riskLabel, suggestHedge, type HedgeCatalog, type HedgeSuggestion} from '@shared/pm-amm/hedge-helper';
import {units} from '@/lib/pm-amm';

export function HedgeHelper({catalog,markets,canReview,busy,onReview}:{catalog:HedgeCatalog;markets:Record<string,MarketAccount>;canReview:boolean;busy:boolean;onReview:(suggestion:HedgeSuggestion)=>void}) {
  const [input,setInput] = useState(''), [submitted,setSubmitted] = useState('');
  const response = useMemo(() => {
    if (!submitted) return null;
    try {return {result:suggestHedge(submitted,catalog,markets)};}
    catch {return {error:'The helper could not read the loaded markets. Refresh markets and try again.'};}
  },[submitted,catalog,markets]);
  const result = response && 'result' in response ? response.result : undefined;
  const request = result?.request, suggestion = result?.suggestion;
  function submit(event: FormEvent) {event.preventDefault();setSubmitted(input.trim());}
  return <section className="pm-helper" aria-labelledby="hedge-helper-title">
    <h2 id="hedge-helper-title">Hedge helper</h2>
    <p>Describe your location, weather risk, dates and the most you can pay. We’ll look for one trade in the loaded markets.</p>
    <form onSubmit={submit}>
      <label htmlFor="hedge-request">Describe your weather hedge</label>
      <div className="pm-helper-compose"><input id="hedge-request" value={input} onChange={event=>{setInput(event.target.value);setSubmitted('');}} maxLength={2000} placeholder="Montreal, snow, Dec 14 to Dec 16, budget 20 mUSDC" aria-describedby="hedge-parser-note"/><button type="submit" disabled={busy||!input.trim()}>Find a trade</button></div>
    </form>
    <p id="hedge-parser-note" className="pm-small">Parsed with deterministic rules. Yearless dates use 2026; “this week” uses Monday–Sunday in UTC.</p>
    <div aria-live="polite" aria-atomic="true">
      {response && 'error' in response && <p className="pm-error">{response.error}</p>}
      {result && <div className="pm-helper-reply">
        <h3>Parsed request</h3>
        <dl className="pm-helper-fields"><div><dt>Location</dt><dd>{request?.location ?? 'Needed'}</dd></div><div><dt>Weather risk</dt><dd>{request?.riskType ? riskLabel(request.riskType) : 'Needed'}</dd></div><div><dt>Dates</dt><dd>{request?.startDate && request.endDate ? `${request.startDate} – ${request.endDate}` : 'Needed'}</dd></div><div><dt>Budget</dt><dd>{request?.maxPay ? `${request.maxPay} mUSDC` : 'Needed'}</dd></div></dl>
        <p>{result.message}</p>
        {!!result.issues.length && <ul>{result.issues.map(issue=><li key={issue}>{issue}</li>)}</ul>}
        {suggestion && <article aria-label="Suggested trade">
          <h3>{suggestion.market.spec.city} · {suggestion.direction === 'usdcToYes' ? 'Yes' : 'No'}</h3>
          <p>{riskLabel(marketRisk(suggestion.market))} · {suggestion.market.spec.start} – {suggestion.market.spec.end} · strike ≥ {suggestion.market.spec.thresholdTenths/10} mm</p>
          <dl className="pm-helper-fields"><div><dt>You pay (estimate)</dt><dd>{units(suggestion.q.amount)} mUSDC</dd></div><div><dt>Shares (estimate)</dt><dd>{units(suggestion.q.out)} {suggestion.direction === 'usdcToYes' ? 'Yes' : 'No'}</dd></div><div><dt>Fee included (estimate)</dt><dd>{units(suggestion.q.fee)} mUSDC</dd></div></dl>
          <p>{suggestion.reason}</p>
          <p className="pm-small">This is a suggestion. Review the latest quote, then confirm in the trade panel if you choose to proceed.</p>
          <button type="button" className="pm-primary" disabled={busy||!canReview} onClick={()=>onReview(suggestion)}>Review this trade</button>
          {!canReview && <p className="pm-small">Wait for the demo wallet or connect Phantom to review this trade.</p>}
        </article>}
        {!!result.closest.length && <div><h3>Closest markets</h3><ul className="pm-helper-closest">{result.closest.map(entry=><li key={entry.address}>
          <strong>{entry.market.spec.city}</strong> · {riskLabel(marketRisk(entry.market))}<br/>
          {entry.market.spec.start} – {entry.market.spec.end} · strike ≥ {entry.market.spec.thresholdTenths/10} mm<br/>
          <span>{entry.status}</span>{entry.differences.map(difference=><p key={difference}>{difference}</p>)}
        </li>)}</ul></div>}
      </div>}
    </div>
  </section>;
}
