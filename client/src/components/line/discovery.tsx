import { useState, type ReactNode } from "react";
import { CITIES, PERILS, perilById } from "../../../../shared/peril-registry.ts";
import * as copy from "../../../../shared/ui-copy.ts";
import { instrumentArt } from "../../../../shared/ui-instrument.ts";
import { fractionOnScale, scaleFor } from "../../../../shared/ui-ladder.ts";
import { lineTokens } from "../../../../shared/ui-tokens.ts";
import { unavailableMarkets, type MarketModel, type MarketSelection, type ReceiptModel } from "../../../../shared/ui-discovery.ts";
import type { PerilId } from "../../../../shared/ui-types.ts";
import { LineArt } from "./draw";
import { Glyph } from "./glyphs";

export function PerilFilter({ value, onChange, markets, all = true }: { value: PerilId | "all"; onChange: (value: PerilId | "all") => void; markets: readonly MarketModel[]; all?: boolean }) {
  const items = [...(all ? [{ id: "all" as const, label: copy.ALL }] : []), ...PERILS];
  return <div className={`ln-switch ${all ? "ln-switch--all" : ""}`} role="tablist" aria-label={copy.WEATHER_WORD} onKeyDown={(event) => {
    const index = items.findIndex((i) => i.id === value);
    const next = event.key === "ArrowRight" ? (index + 1) % items.length : event.key === "ArrowLeft" ? (index - 1 + items.length) % items.length : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null;
    if (next != null) { event.preventDefault(); onChange(items[next].id); (event.currentTarget.children[next] as HTMLButtonElement).focus(); }
  }}>{items.map((item) => <button key={item.id} role="tab" type="button" aria-selected={value === item.id} tabIndex={value === item.id ? 0 : -1} data-open={item.id === "all" || markets.some((m) => m.peril === item.id)} onClick={() => onChange(item.id)}>
    {item.id !== "all" ? <Glyph name={item.id} size={24} /> : <Glyph name="markets" size={24} />}<span>{item.label}</span>
  </button>)}</div>;
}
export function Instrument({ peril, rungs = [], trigger = null, reading = null, state = "idle", size = "stage", unit }: { peril: PerilId; rungs?: number[]; trigger?: number | null; reading?: number | null; state?: "idle" | "ghost" | "loading" | "covered" | "paid" | "dry"; size?: "mini" | "tile" | "stage"; unit?: string }) {
  const art = instrumentArt({ peril, rungs, selected: trigger, reading, state, size, unit: unit ?? perilById(peril)!.unit });
  return <LineArt {...art} label={art.label} />;
}
export function FigurePair({ loss, gain, across = false }: { loss: string; gain: string; across?: boolean }) {
  return <div key={`${loss}-${gain}`} className="ln-cells ln-figure-swap">{[{ label: across ? copy.LOSS_OPEN : copy.MAX_LOSS, amount: `-${loss}` }, { label: across ? copy.GAIN_OPEN : copy.MAX_GAIN, amount: `+${gain}` }].map((item) => <div className="ln-money-cell" key={item.label}><p className="ln-label">{item.label}</p><p className="ln-money-figure ln-fig-l">{item.amount}</p><p className="ln-caption">SKYT</p></div>)}</div>;
}
export function FirstRun({ onDismiss }: { onDismiss: () => void }) {
  return <aside className="ln-intro"><p>{copy.FIRST_RUN}</p><button className="ln-text-btn" onClick={onDismiss}>{copy.GOT_IT}</button></aside>;
}
function CoverTile({ receipt, onClick }: { receipt: ReceiptModel; onClick: () => void }) {
  return <button className="ln-cover-tile ln-press" onClick={onClick}>{receipt.peril ? <Instrument peril={receipt.peril} rungs={receipt.rungs} trigger={receipt.trigger} reading={receipt.reading} state="covered" size="tile" /> : <Glyph name="protect" />}<strong>{receipt.title}</strong><span>{copy.MAX_LOSS} {receipt.loss ?? "—"}</span><span className="ln-label">{receipt.status}</span></button>;
}
export function MarketsScreen({ markets, receipts = [], loading = false, failed = false, onSelect, onReceipt, filter: initialFilter = "all", expanded = false, technical }: { markets: MarketModel[]; receipts?: ReceiptModel[]; loading?: boolean; failed?: boolean; onSelect: (market: MarketSelection) => void; onReceipt: (id: string) => void; filter?: PerilId | "all"; expanded?: boolean; technical?: ReactNode }) {
  const [filter, setFilter] = useState<PerilId | "all">(initialFilter);
  const visible = markets.filter((m) => filter === "all" || m.peril === filter);
  const active = receipts.filter((r) => r.kind === "open" && (filter === "all" || r.peril === filter));
  const hero = visible[0];
  const unavailable = unavailableMarkets(markets, filter);
  return <section className="ln ln-browse" aria-label="Weather markets" data-motion="run">
    <header className="ln-screen-head"><h1 className="ln-title">{copy.MARKETS_TITLE}</h1><span className="ln-label">{copy.DEVNET_TAG}</span></header>
    <PerilFilter value={filter} onChange={setFilter} markets={markets} />
    {failed && filter !== "cold" ? <p role="alert" className="ln-note">{markets.length ? copy.PARTIAL_MARKETS : copy.CHAIN_ERROR}</p> : null}
    {loading && filter !== "cold" ? <div className="ln-market-loading" role="status" aria-label={copy.GETTING_QUOTE}><div className="ln-skel"/><div className="ln-skel"/><div className="ln-skel"/></div> : active.length ? <section><h2 className="ln-zone">{copy.YOUR_COVERS}</h2><div className="ln-covers-rail">{active.map((r) => <CoverTile key={r.id} receipt={r} onClick={() => onReceipt(r.id)} />)}</div></section> : hero ? <section className="ln-market-hero" aria-label={`${hero.city} · ${perilById(hero.peril)?.label}`}>
      <div className="ln-market-stage"><Instrument peril={hero.peril} rungs={hero.rungs} trigger={hero.trigger} unit={hero.unit} /><div><h2 className="ln-title">{hero.city}</h2><p className="ln-label">{perilById(hero.peril)?.label} · {hero.station}</p><p>{hero.triggerLabel}</p><p className="ln-label">{hero.close}</p></div></div>
      <div className="ln-stat-strip">{[{ label: copy.CHANCE, value: hero.chance }, { label: copy.MULTIPLE, value: hero.multiple }, { label: copy.MAX_LOSS, value: `-${hero.loss}` }].map((s) => <div key={s.label}><p className="ln-label">{s.label}</p><p className="ln-fig-m">{s.value}</p>{s.label === copy.MAX_LOSS ? <span className="ln-label">SKYT</span> : null}</div>)}</div>
      <button className="ln-cta ln-press" onClick={() => onSelect(hero)}>{copy.COVER_THIS}</button><p className="ln-note">{hero.note}</p>
    </section> : <div className="ln-empty"><Instrument peril={filter === "all" ? PERILS[0].id : filter} state="ghost" size="tile"/><p>{filter === "cold" ? copy.notOpenLine("cold", "") : failed ? copy.STATE_UNAVAILABLE : copy.EMPTY_MARKETS}</p></div>}
    {visible.length ? <section><h2 className="ln-zone">{copy.OPEN_NOW}</h2>{visible.map((market) => <button className="ln-market-row ln-press" key={market.id} onClick={() => onSelect(market)}>
      <Instrument peril={market.peril} rungs={market.rungs} trigger={market.trigger} size="mini" unit={market.unit}/><span className="ln-row-copy"><strong>{market.city} · {perilById(market.peril)?.label}</strong><span>{market.triggerLabel}</span><span className="ln-label">{copy.MAX_LOSS} -{market.loss} SKYT · {market.close}</span></span><span className="ln-market-odds"><span className="ln-fig-m">{market.chance}</span><span className="ln-fig-minor">{market.multiple}</span><Glyph name="chevron" size={18}/></span>
    </button>)}</section> : null}
    {(!loading && !failed || filter === "cold") ? <details className="ln-unavailable" open={expanded || undefined}><summary>{copy.notOpenMarkets(unavailable.length)}</summary>{unavailable.map((u) => <div className="ln-unavailable-row" key={u.id}><Glyph name={u.peril}/><span>{u.label} · {copy.NOT_OPEN_YET}</span></div>)}</details> : null}
    {technical}
  </section>;
}
export function Receipt({ receipt: r, onClose }: { receipt: ReceiptModel; onClose: () => void }) {
  const d = r.diagram;
  const step = d ? 20 + d.step * 320 : 0;
  return <section aria-label={copy.RECEIPT} className="ln-receipt">
    <button onClick={onClose} className="ln-text-btn">{copy.DONE}</button><h2 className="ln-title">{r.title}</h2><p className={`ln-stamp ${r.kind !== "paid" ? "ln-stamp--neutral" : ""}`}>{r.status}</p>
    <div className="ln-receipt-art">{r.peril ? <Instrument peril={r.peril} rungs={r.rungs} trigger={r.trigger} reading={r.reading} unit={r.unit} state={r.trigger == null ? "ghost" : r.kind === "paid" ? "paid" : r.kind === "dry" ? "dry" : "covered"}/> : null}</div>
    {r.loss && r.gain ? <FigurePair loss={r.loss} gain={r.gain}/> : null}
    {d ? <svg className="ln-payoff" viewBox="0 0 361 112" role="img" aria-label={`${copy.MAX_LOSS} ${d.loss} SKYT · ${copy.MAX_GAIN} ${d.gain} SKYT · ${copy.TRIGGER} ${d.trigger}`}>
      <line x1="16" y1="56" x2="345" y2="56" stroke={lineTokens.tick}/><path className="ln-diagram-segment" d={`M20 ${56 + d.lossPx} H${step}`} stroke={lineTokens.fg2} strokeWidth="3"/>
      <path d={`M${step} ${56 + d.lossPx} V${56 - d.gainPx}`} stroke={lineTokens.slicker} strokeWidth="2"/><path className="ln-diagram-segment" d={`M${step} ${56 - d.gainPx} H345`} stroke={lineTokens.fg} strokeWidth="3"/>
      {d.ticks.map((fraction, index) => <line key={index} x1={20 + fraction * 320} x2={20 + fraction * 320} y1="56" y2="64" stroke={lineTokens.tick}/>)}
      {d.reading != null ? <circle data-testid="final-reading" cx={20 + d.reading * 320} cy="56" r="3" fill={lineTokens.glacier}/> : null}
      <text x="20" y="110" fill={lineTokens.fg2} fontSize="13">{d.loss} SKYT</text><text x="345" y="14" textAnchor="end" fill={lineTokens.fg} fontSize="13">{d.gain} SKYT</text><text x={step} y="80" textAnchor="middle" fill={lineTokens.fg2} fontSize="13">{d.trigger}</text>
    </svg> : <p className="ln-note">{copy.RECEIPT_DATA_UNAVAILABLE}</p>}
    <p className="ln-note">{r.reading != null ? `${r.reading} ${r.unit}` : copy.FINAL_READING_UNAVAILABLE}</p>
    {r.settled ? <p className="ln-note">{copy.NOAA_WINDOW_ENDED} · {r.settled}</p> : null}
    <dl><div className="ln-detail-row"><dt>{copy.PAYOUT}</dt><dd className={r.kind === "paid" ? "ln-payout" : ""}>{r.payout ?? "—"} SKYT</dd></div><div className="ln-detail-row"><dt>{copy.MAX_LOSS}</dt><dd>-{r.loss ?? "—"} SKYT</dd></div></dl>
    {r.result ? <p className="ln-fig-m">{r.result}</p> : null}<p className="ln-note ln-address">{r.station} · {r.market}</p>
  </section>;
}
export function WalletScreen({ address, balance, receipts, totals, loading, failed, onConnect, onRetry, onDisconnect, technical, initialReceipt = null, technicalOpen = false }: { address: string | null; balance: string | null; receipts: ReceiptModel[]; totals: { loss: string; gain: string } | null; loading: boolean; failed: boolean; onConnect: () => void; onRetry: () => void; onDisconnect?: () => void; technical?: ReactNode; initialReceipt?: string | null; technicalOpen?: boolean }) {
  const [selected, setSelected] = useState<string | null>(initialReceipt);
  const [copied, setCopied] = useState<string | null>(null);
  const receipt = receipts.find((r) => r.id === selected);
  return <section className="ln ln-browse" data-motion="run"><header className="ln-screen-head"><h1 className="ln-title">{copy.WALLET_TITLE}</h1><span className="ln-label">{copy.DEVNET_TAG}</span></header>
    {receipt ? <Receipt receipt={receipt} onClose={() => setSelected(null)}/> : <>
      {!address ? <div className="ln-wallet-empty"><Glyph name="wallet" size={48}/><p>{copy.WALLET_INTRO}</p><button className="ln-cta" onClick={onConnect}>{copy.CONNECT_WALLET}</button></div> : <>
        <p className="ln-label">{copy.SKYT_BALANCE}</p><p className="ln-balance">{balance ?? "—"}</p>
        <button className="ln-copy ln-press" aria-label={copy.COPY_ADDRESS} onClick={async () => { try { await navigator.clipboard.writeText(address); setCopied(copy.COPIED); } catch { setCopied(copy.COPY_FAILED); } }}><span>{address.slice(0, 8)}…{address.slice(-8)}</span><Glyph name="wallet" size={20}/></button>{copied ? <p role="status">{copied}</p> : null}
        {loading ? <p role="status" className="ln-note">{copy.READING_WALLET}</p> : null}
        {failed ? <div role="alert"><p>{copy.CHAIN_ERROR}</p><button className="ln-text-btn" onClick={onRetry}>{copy.TRY_AGAIN}</button></div> : null}
        {totals ? <FigurePair {...totals} across/> : null}
        <h2 className="ln-zone">{copy.YOUR_COVERS}</h2>
        {!loading && !failed && receipts.length === 0 ? <p className="ln-note">{copy.EMPTY_COVERS}</p> : null}
        {receipts.map((r) => <button className="ln-wallet-row ln-press" key={r.id} onClick={() => setSelected(r.id)}>{r.peril ? <Instrument peril={r.peril} rungs={r.rungs} trigger={r.trigger} reading={r.reading} size="mini" state={r.trigger == null ? "ghost" : "covered"}/> : <Glyph name="protect"/>}<span><strong>{r.title}</strong><span className="ln-label">{r.kind === "open" || r.kind === "paid" || r.kind === "dry" ? "✓ " : ""}{r.status}</span><span className="ln-wallet-result">{r.result ?? `${copy.MAX_LOSS} -${r.loss ?? "—"} · ${copy.MAX_GAIN} +${r.gain ?? "—"} SKYT`}</span></span><Glyph name="chevron" size={18}/></button>)}
        {onDisconnect ? <button className="ln-text-btn" onClick={onDisconnect}>{copy.DISCONNECT}</button> : null}
      </>}
      <details className="ln-technical" open={technicalOpen || undefined}><summary>{copy.TECHNICAL_DETAILS}</summary><p>{copy.CONTRACT_LABEL}</p><p>{copy.SETTLED_UNITS}</p><p>{copy.TECH_CONTEXT}</p>{CITIES.map((city) => <p key={city.id} className="ln-label">{city.name} · {city.stationId}</p>)}{technical}</details>
    </>}
  </section>;
}
