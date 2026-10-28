import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cityById, perilById } from "../../../../shared/peril-registry.ts";
import * as copy from "../../../../shared/ui-copy.ts";
import { citySheetRows, coldCard, countdown, elsewhereCards, featuredCity, marketsLayout as L, marketsMotion as M, marketsPanel, moreInCity, pendingCards, type OpenCard, type PendingCard, type PreviewSelection } from "../../../../shared/ui-markets.ts";
import type { MarketModel, MarketSelection, ReceiptModel } from "../../../../shared/ui-discovery.ts";
import type { QuoteWindow } from "../../../../shared/ui-window-quote.ts";
import type { PerilId } from "../../../../shared/ui-types.ts";
import { instrumentArt } from "../../../../shared/ui-instrument.ts";
import { lineTokens as C } from "../../../../shared/ui-tokens.ts";
import { LineArt } from "./draw";
import { Glyph } from "./glyphs";

function Tick() { return <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" strokeWidth="2" fill="none"/></svg>; }
function MarketInstrument({ peril, market, tile = false, drawLine = true }: { peril: PerilId; market?: { rungs: number[]; trigger: number }; tile?: boolean; drawLine?: boolean }) {
  const art = instrumentArt({ peril, rungs: market?.rungs ?? [], selected: market?.trigger ?? null, reading: null, state: "idle", size: tile ? "tile" : "hero", unit: perilById(peril)!.unit });
  const scale = peril === "wind" ? tile ? L.card.windInstrumentScale : L.hero.windInstrumentScale : tile ? L.card.instrumentScale : L.hero.instrumentScale;
  const top = peril === "wind" ? ((tile ? 104 : L.hero.instrumentHeight) - 136 * scale) / 2 : 0;
  const left = peril === "wind" ? ((tile ? 44 : L.hero.instrumentWidth) - 120 * scale) / 2 : -16 * scale;
  const ops = art.ops.filter((op) => op.op !== "text" && !(op.op === "line" && op.stroke === C.slicker) && !(op.op === "rect" && op.fill === C.slicker)).map((op) => "stroke" in op && op.stroke === C.tick ? { ...op, stroke: C.fg2 } : op);
  return <div className={`mk-instrument ${tile ? "mk-instrument--tile" : ""}`}>
    <div style={{ position: "absolute", left, top, width: (peril === "wind" ? 120 : 104) * scale, height: 156 * scale }}><LineArt ops={ops} viewBox={art.viewBox} width={(peril === "wind" ? 120 : 104) * scale} height={156 * scale} label={art.label}/></div>
    {art.anchorY != null ? <span className="mk-trigger-line" style={{ animation: drawLine ? undefined : "none", left: tile ? L.card.lineStart : L.hero.lineStart - L.margin, top: art.anchorY * scale + top - 1, width: tile ? L.card.lineEnd - L.card.lineStart : L.hero.lineEnd - L.hero.lineStart }}/>: null}
    {!tile ? <span className="mk-reading">{copy.zeroLabel(perilById(peril)!.unit)}</span> : null}
  </div>;
}
function Countdown({ salesCloseAt, nowSeconds }: { salesCloseAt: string; nowSeconds: number }) {
  const [now, setNow] = useState(nowSeconds * 1000);
  const clock = useRef(nowSeconds); clock.current = nowSeconds;
  useEffect(() => {
    const base = clock.current * 1000, started = Date.now();
    setNow(base);
    if (Date.parse(salesCloseAt) - base >= 48 * 3600000) return;
    const timer = setInterval(() => setNow(base + Date.now() - started), 60000);
    return () => clearInterval(timer);
  }, [salesCloseAt, nowSeconds]);
  return <p className="mk-label">{countdown(salesCloseAt, now)}</p>;
}
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = dialog.current!; node.showModal(); return () => node.close(); }, []);
  return <dialog ref={dialog} className="mk-sheet ln" aria-label={title} onKeyDown={(e) => {
    if (e.key !== "Tab") return;
    const targets = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const first = targets[0], last = targets[targets.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  }} onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className="mk-sheet-content"><div className="mk-handle"/><h2 className="mk-strong">{title}</h2><div className="mk-sheet-scroll">{children}</div><button className="mk-close" onClick={onClose}>{copy.CLOSE}</button></div></dialog>;
}
function Hero({ panel, onSelect, onPreview, onWallet, nowSeconds, drawLine }: { panel: ReturnType<typeof marketsPanel>; onSelect: (m: MarketSelection) => void; onPreview: (m: PreviewSelection) => void; onWallet: () => void; nowSeconds: number; drawLine: boolean }) {
  if (panel.kind === "city-not-open") return <section className="mk-city-panel"><MarketInstrument peril={panel.peril}/><div><h2 className="mk-strong">{panel.title}</h2><p className="mk-body mk-secondary">{panel.status}</p><button className="ln-cta mk-outlined" onClick={() => onPreview(panel.selection)}>{panel.cta}</button></div></section>;
  if (panel.kind !== "loading" && panel.kind !== "open" && panel.kind !== "held-receipt-hero") return null;
  const m = panel.kind === "loading" ? null : panel.market, held = panel.kind === "held-receipt-hero";
  const stats = m ? held ? [{ label: copy.MAX_LOSS, value: `-${m.loss}` }, { label: copy.MAX_GAIN, value: `+${m.gain}` }] : [{ label: copy.CHANCE, value: m.chance }, { label: copy.MULTIPLE, value: m.multiple }, { label: copy.MAX_LOSS, value: `-${m.loss}` }] : panel.kind === "loading" ? panel.stats : [];
  return <><section className={`ln-market-hero mk-hero ${!m ? "ln-market-hero--loading" : ""}`} aria-label={m ? `${m.city} · ${perilById(m.peril)!.label}` : "Markets quote loading"}>
    <div className="ln-market-stage mk-stage"><MarketInstrument peril={m?.peril ?? "rain"} market={m ?? undefined} drawLine={drawLine}/><div className="mk-hero-text">
      {m ? <><h2 className="mk-strong mk-title-line">{held ? <Tick/> : <Glyph name={m.peril} size={20}/>}<span>{held ? copy.COVERED_WORD : `${perilById(m.peril)!.label} · ${m.station}`}</span></h2><Countdown salesCloseAt={m.quote.salesCloseAt} nowSeconds={nowSeconds}/></> : <div style={{ height: 40 }}/>}
      <div className="mk-numeral-line"><span className={`mk-hero-number ${!m ? "mk-secondary" : ""}`}>{m ? m.trigger : "--"}</span>{m ? <span className="mk-unit">{m.unit}</span> : null}</div>
      {panel.kind === "open" || panel.kind === "held-receipt-hero" ? <p className="mk-sentence">{panel.sentence}</p> : null}
    </div></div>
    <div className="ln-stat-strip mk-stats">{stats.map((s) => <div key={s.label}><p className="ln-label">{s.label}</p><p className={`mk-stat-value ${!m ? "ln-placeholder-value" : ""} ${held && s.label === copy.MAX_GAIN ? "mk-payout" : ""}`}>{s.value}</p></div>)}</div>
    <button className={`ln-cta ${held ? "mk-outlined" : ""}`} disabled={!m} onClick={() => { if (m) held ? onWallet() : onSelect(m); }}>{panel.cta}</button>
  </section>{panel.kind === "held-receipt-hero" ? <p className="mk-label mk-receipt-note">{panel.note}</p> : null}</>;
}
function Card({ card, index, onSelect, onPreview, onCold, animate, drawLine }: { card: OpenCard | PendingCard | typeof coldCard; index: number; onSelect: (m: MarketSelection) => void; onPreview: (m: PreviewSelection) => void; onCold: () => void; animate: boolean; drawLine: boolean }) {
  return <div className="mk-card-reveal" style={{ animation: animate ? undefined : "none", "--mk-delay": `${Math.min(index, M.maxSteps - 1) * M.stagger}ms` } as CSSProperties}><button className="mk-card" data-kind={card.kind} data-card-id={card.id} onClick={() => card.kind === "open" ? onSelect(card.selection) : card.kind === "pending" ? onPreview(card.selection) : onCold()}>
    <strong className="mk-card-title">{card.label}</strong><span className="mk-label">{card.city}</span>
    <span className="mk-card-body"><MarketInstrument peril={card.peril} tile drawLine={drawLine} market={card.kind === "open" ? { rungs: card.rungs, trigger: card.selection.trigger } : undefined}/><span className="mk-card-figure">
      {card.kind === "open" ? <><span className="mk-card-number">{card.trigger}</span><span className="mk-label">{card.unit}</span></> : card.kind === "pending" && card.month ? <><span className="mk-label">{copy.FROM}</span><span className="mk-card-number mk-foreground">{card.month}</span></> : <span className="mk-body mk-secondary">{card.kind === "pending" ? copy.NOT_OPEN_YET : card.status}</span>}
    </span></span><span className="mk-card-footer mk-label"><span>{card.kind === "open" && card.windowCount > 1 && !card.held ? <>{card.footer.split(" · ")[0]} <span className="mk-window-count">· {card.footer.split(" · ")[1]}</span></> : card.footer}</span>{card.kind === "open" ? card.held ? <Tick/> : null : <Glyph name="chevron" size={16}/>}</span>
  </button></div>;
}
export function MarketsScreen({ markets, receipts = [], loading = false, failed = false, reason, onSelect, onPreview, onReceipt, onWallet, onRetry = () => {}, quoteWindows = [], nowSeconds = Math.floor(Date.now() / 1000), selectedCity, onCity, technical }: {
  markets: MarketModel[]; receipts?: ReceiptModel[]; loading?: boolean; failed?: boolean; reason?: string; onSelect: (m: MarketSelection) => void; onPreview: (m: PreviewSelection) => void; onReceipt: (id: string) => void; onWallet?: () => void; onRetry?: () => void; quoteWindows?: readonly QuoteWindow[]; nowSeconds?: number; selectedCity?: string | null; onCity?: (city: string) => void; technical?: ReactNode;
}) {
  const [localCity, setLocalCity] = useState<string | null>(null);
  const startedLoading = useRef(loading).current;
  const seenLines = useRef(new Set<string>()).current;
  const [citySwitches, setCitySwitches] = useState(0);
  const [sheet, setSheet] = useState<"city" | "cold" | null>(null);
  const held = new Set(receipts.filter((r) => r.kind === "open" || r.kind === "pending").map((r) => r.market));
  const data = markets.map((m) => ({ ...m, held: m.held || held.has(m.id) }));
  const city = selectedCity ?? localCity ?? (loading ? "new-york" : featuredCity(data, quoteWindows, undefined, nowSeconds));
  const name = cityById(city)?.name ?? city, pending = pendingCards(data, quoteWindows, nowSeconds);
  const panel = marketsPanel({ cityId: city, markets: data, pending, loading, failed, reason, receipts });
  const rows = moreInCity(city, data, quoteWindows, nowSeconds), cards = elsewhereCards(city, data);
  const lineIds = cards.map((c) => c.id).join("|");
  const firstLines = new Set(cards.filter((c) => !seenLines.has(c.id)).map((c) => c.id));
  useEffect(() => { for (const id of lineIds.split("|")) if (id) seenLines.add(id); }, [lineIds, seenLines]);
  const active = receipts.filter((r) => r.kind === "open"), wallet = onWallet ?? (() => onReceipt(active[0]?.id ?? ""));
  const geometry = { "--mk-header": `${L.header}px`, "--mk-hero": `${L.hero.height}px`, "--mk-content": `${L.hero.content}px`, "--mk-top": `${L.hero.top}px`, "--mk-bottom": `${L.hero.bottom}px`, "--mk-stats-gap": `${L.hero.beforeStats}px`, "--mk-stats": `${L.hero.stats}px`, "--mk-cta-gap": `${L.hero.beforeCta}px`, "--mk-cta": `${L.hero.cta}px`, "--mk-card-height": `${L.card.height}px`, "--mk-card-radius": `${L.card.radius}px`, "--mk-gap": `${L.card.gap}px`, "--mk-row": `${L.row}px`, "--mk-city-row": `${L.cityRow}px`, "--mk-hero-line": `${M.heroLine}ms`, "--mk-card-line": `${M.cardLine}ms`, "--mk-city-motion": `${M.city}ms` } as CSSProperties;
  return <section className="ln ln-browse mk-markets" aria-label="Weather markets" style={geometry}>
    <header className="mk-header"><button className="mk-city-button" aria-label={`${copy.CHOOSE_CITY}, ${name}`} aria-expanded={sheet === "city"} onClick={() => setSheet("city")}><h1>{name}</h1><span className="mk-down"><Glyph name="chevron" size={20}/></span></button><span className="mk-label">{copy.DEVNET_TAG}</span></header>
    {active.length ? <button className="ln-covers-summary" onClick={wallet}><strong>{copy.openCoversCount(active.length)}</strong><span><small>{copy.MAX_LOSS}</small><b>-{sumAmounts(active, "loss")}</b></span><span><small>{copy.MAX_GAIN}</small><b className="mk-payout">+{sumAmounts(active, "gain")}</b></span><Glyph name="chevron" size={20}/></button> : null}
    <div key={`${city}-${loading}`} className="mk-city-content">
      {failed && data.length ? <p role="alert" className="mk-label">{copy.MARKETS_PARTIAL}</p> : null}
      {panel.kind === "error" ? <div role="alert" className="mk-message"><h2 className="mk-strong">{panel.title}</h2>{panel.reason ? <p className="mk-label">{panel.reason}</p> : null}<button className="mk-close" onClick={onRetry}>{panel.cta}</button></div> : panel.kind === "empty" ? <p className="mk-strong mk-message">{panel.title}</p> : <Hero panel={panel} onSelect={onSelect} onPreview={onPreview} onWallet={wallet} nowSeconds={nowSeconds} drawLine={!startedLoading || citySwitches > 0}/>}
      {(panel.kind === "open" || panel.kind === "held-receipt-hero") && panel.honesty ? <p className="mk-label">{panel.honesty}</p> : null}
      {loading ? <div className="mk-grid mk-loading-grid">{Array.from({ length: 4 }, (_, i) => <div key={i} className="mk-card mk-shell"/>)}</div> : <>
        {rows.length && panel.kind !== "error" ? <section><h2 className="mk-zone">{copy.moreInCityLabel(name)}</h2>{rows.map((row) => <button className="mk-row ln-market-row" key={row.id} onClick={() => row.kind === "open" ? onSelect(row.selection) : onPreview(row.selection)}><Glyph name={row.peril} size={24}/><span className="mk-row-main">{row.kind === "open" ? <><span className="mk-row-trigger">{row.trigger}</span> <span className="mk-row-end">{row.end}</span></> : <span className="mk-row-end">{row.label}</span>}</span><span className="mk-row-status mk-label">{row.status}{row.kind === "open" && row.held ? <Tick/> : null}</span><Glyph name="chevron" size={20}/></button>)}</section> : null}
        {cards.length ? <section><h2 className="mk-zone">{copy.OPEN_ELSEWHERE}</h2><div className="mk-grid" data-grid="open">{cards.map((card, index) => <Card key={card.id} card={card} index={index} animate={!startedLoading && citySwitches === 0} drawLine={!startedLoading && firstLines.has(card.id)} onSelect={onSelect} onPreview={onPreview} onCold={() => setSheet("cold")}/>)}</div></section> : null}
        {panel.kind !== "empty" ? <section><h2 className="mk-zone">{copy.COMING_UP}</h2><div className="mk-grid" data-grid="pending">{[...pending.filter((p) => p.cityId !== city || panel.kind === "error"), coldCard].map((card, index) => <Card key={card.id} card={card} index={index + cards.length} animate={!startedLoading && citySwitches === 0} drawLine={false} onSelect={onSelect} onPreview={onPreview} onCold={() => setSheet("cold")}/>)}</div></section> : null}
      </>}
    </div>{technical}
    {sheet === "city" ? <Sheet title={copy.CHOOSE_CITY} onClose={() => setSheet(null)}>{citySheetRows(data, quoteWindows).map((row) => <button className="mk-city-row" key={row.id} aria-pressed={city === row.id} onClick={() => { if (row.id !== city) setCitySwitches((count) => count + 1); setLocalCity(row.id); onCity?.(row.id); setSheet(null); }}><span className="mk-row-main"><strong className="mk-strong">{row.name}</strong><span className="mk-label">{row.subtitle}</span></span>{row.glyphs.map((p) => <Glyph key={p} name={p} size={20}/>)}{city === row.id ? <Tick/> : null}</button>)}</Sheet> : sheet === "cold" ? <Sheet title={coldCard.label} onClose={() => setSheet(null)}><div className="mk-cold-art"><MarketInstrument peril="cold" tile/></div><p className="mk-body">{coldCard.explanation}</p></Sheet> : null}
  </section>;
}
function sumAmounts(receipts: ReceiptModel[], key: "loss" | "gain") {
  const total = receipts.reduce((sum, r) => { const [whole, fraction = ""] = (r[key] ?? "0").replaceAll(",", "").split("."); return sum + BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0")); }, 0n);
  return `${total / 1000000n}.${((total % 1000000n) / 10000n).toString().padStart(2, "0")}`;
}
