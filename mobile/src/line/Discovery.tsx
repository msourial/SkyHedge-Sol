import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Clipboard, Pressable, ScrollView, StyleSheet, Text, View, Vibration, Easing } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { PERILS, perilById } from "../../../shared/peril-registry.ts";
import * as copy from "../../../shared/ui-copy.ts";
import { marketModels, unavailableMarkets, type MarketModel, type MarketSelection, type ReceiptModel } from "../../../shared/ui-discovery.ts";
import { instrumentArt } from "../../../shared/ui-instrument.ts";
import { lineGlyphs } from "../../../shared/ui-glyphs.ts";
import { lineTokens as C } from "../../../shared/ui-tokens.ts";
import type { CoverSize, PerilId, WindowQuote } from "../../../shared/ui-types.ts";
import { LineArt } from "./art.tsx";
import { F } from "../theme.ts";
import { useReducedMotion } from "../liquid-glass.tsx";
import { Enter, SpringPress } from "../motion.tsx";

function Glyph({ name, color = C.fg2 }: { name: keyof typeof lineGlyphs; color?: string }) { return <Svg width={24} height={24} viewBox="0 0 24 24">{lineGlyphs[name].map((d) => <Path key={d} d={d} stroke={color} strokeWidth={1.75} fill="none" strokeLinecap="round"/>)}</Svg>; }
function Instrument({ peril, rungs = [], trigger = null, reading = null, size = "stage", state = "idle" }: { peril: PerilId; rungs?: number[]; trigger?: number | null; reading?: number | null; size?: "mini" | "stage" | "tile"; state?: "ghost" | "idle" | "covered" | "paid" | "dry" | "loading" }) {
  const art = instrumentArt({ peril, rungs, selected: trigger, reading, state, size, unit: perilById(peril)?.unit ?? "" });
  return <LineArt {...art}/>;
}
function Filter({ value, onChange, markets, all = true }: { value: PerilId | "all"; onChange: (id: PerilId | "all") => void; markets: MarketModel[]; all?: boolean }) {
  const items = [...(all ? [{ id: "all" as const, label: copy.ALL }] : []), ...PERILS];
  const index = Math.max(0, items.findIndex((p) => p.id === value));
  const x = useRef(new Animated.Value(index)).current;
  useEffect(() => { const a = Animated.timing(x, { toValue: index, duration: useReducedMotion() ? 0 : 240, easing: Easing.bezier(.23,1,.32,1), useNativeDriver: true }); a.start(); return () => a.stop(); }, [index, x]);
  return <View style={s.switcher} accessibilityRole="tablist">{items.map((peril) => { const selected = value === peril.id; const open = peril.id === "all" || markets.some((m) => m.peril === peril.id); const color = open ? selected ? C.fg : C.fg2 : C.dryText; return <Pressable key={peril.id} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(peril.id)} style={s.segment}>
    <Glyph name={peril.id === "all" ? "markets" : peril.id} color={color}/><Text style={[s.label, { color }]}>{peril.label}</Text>
  </Pressable>; })}<Animated.View pointerEvents="none" style={[s.tick, { width: `${100/items.length}%`, transform: [{ translateX: Animated.multiply(x, 361/items.length) }] }]}/></View>;
}
export function FigurePair({ loss, gain, across = false }: { loss: string; gain: string; across?: boolean }) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    opacity.stopAnimation();
    if (reduced) { opacity.setValue(1); return; }
    opacity.setValue(0);
    const animation = Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [loss, gain, reduced, opacity]);
  return <Animated.View style={[s.cells, across && s.walletTotals, { opacity }]}>{[{ label: across ? copy.LOSS_OPEN : copy.MAX_LOSS, amount: `-${loss}` }, { label: across ? copy.GAIN_OPEN : copy.MAX_GAIN, amount: `+${gain}` }].map((item) => <View key={item.label} style={[s.cell, across && s.walletTotalCell]}><Text numberOfLines={1} style={s.label}>{item.label}</Text><View style={s.inlineFigure}><Text style={[s.figure, across && s.totalFigure]}>{item.amount}</Text><Text style={s.label}>SKYT</Text></View></View>)}</Animated.View>;
}
export function FirstRunStrip({ onDismiss }: { onDismiss: () => void }) { return null; }
export function MarketsLine({ markets, receipts, loading, failed, onSelect, onWallet }: { markets: MarketModel[]; receipts: ReceiptModel[]; loading: boolean; failed: boolean; onSelect: (m: MarketSelection) => void; onWallet: () => void }) {
  const [filter, setFilter] = useState<PerilId | "all">("all");
  const [expanded, setExpanded] = useState(false);
  const visible = markets.filter((m) => filter === "all" || m.peril === filter);
  const active = receipts.filter((r) => r.kind === "open" && (filter === "all" || r.peril === filter));
  const hero = [...visible].sort((a, b) => Number(a.chance.replace("%", "")) - Number(b.chance.replace("%", "")))[0];
  const unavailable = unavailableMarkets(markets, filter);
  return <Enter><View style={s.head}><Text style={s.title}>{copy.MARKETS_TITLE}</Text><Text style={s.label}>{copy.DEVNET_TAG}</Text></View><Filter value={filter} onChange={setFilter} markets={markets}/>
    {failed && filter !== "cold" ? <Text accessibilityRole="alert" style={s.note}>{markets.length ? copy.PARTIAL_MARKETS : copy.CHAIN_ERROR}</Text> : null}
    {loading && filter !== "cold" ? <Text style={s.note}>{copy.GETTING_QUOTE}</Text> : hero ? <>
      <View style={s.stage}><Instrument peril={hero.peril} rungs={hero.rungs} trigger={hero.trigger} size="tile"/><View style={{ flex: 1 }}><Text style={s.strong}>{hero.city} · {perilById(hero.peril)?.label}</Text><Text style={s.label}>{hero.station}</Text><Text style={s.marketTrigger}>{hero.trigger} <Text style={s.monoSmall}>{hero.unit}</Text></Text></View></View>
      <View style={s.stats}>{[{ label: copy.CHANCE, value: hero.chance }, { label: copy.MULTIPLE, value: hero.multiple }, { label: copy.MAX_LOSS, value: `-${hero.loss}` }].map((item) => <View key={item.label} style={{ flex: 1 }}><Text style={s.label}>{item.label}</Text><Text style={s.mono}>{item.value}</Text></View>)}</View>
      <Text style={s.salesNote}>{hero.close}</Text><SpringPress onPress={() => onSelect(hero)} style={s.cta}><Text style={s.ctaText}>{copy.COVER_THIS}</Text></SpringPress>
    </> : <View style={s.notOpen}><Text style={s.body}>{filter === "cold" ? copy.notOpenLine("cold", "") : failed ? copy.CHAIN_ERROR : copy.EMPTY_MARKETS}</Text>{failed ? <Pressable onPress={() => {}} style={s.textButton}><Text style={s.label}>{copy.TRY_AGAIN}</Text></Pressable> : null}</View>}
    {active.length ? <Pressable onPress={onWallet} style={s.coversSummary}><Text style={s.strong}>{active.length} open covers</Text><Text style={s.label}>Max loss   Max gain</Text><Glyph name="chevron"/></Pressable> : null}
    {visible.length ? <View style={s.zoneHead}><Text style={s.zone}>{copy.OPEN_NOW}</Text><Text style={s.label}>Chance       Multiple</Text></View> : null}{visible.map((m) => <SpringPress key={m.id} onPress={() => onSelect(m)} style={s.marketRow}><View style={s.marketGlyph}><Glyph name={m.peril}/><View style={s.tint}/></View><View style={{ flex: 1 }}><Text style={s.strong}>{m.city} · {perilById(m.peril)?.label}</Text><Text style={s.triggerCopy}>{m.triggerLabel}</Text><Text style={s.label}>{copy.MAX_LOSS} {m.loss} · {m.close}</Text></View><View style={s.odds}><Text style={s.mono}>{m.chance}</Text><Text style={s.label}>{m.multiple}</Text></View></SpringPress>)}
    {(!loading && !failed || filter === "cold") ? <Pressable onPress={() => setExpanded(!expanded)} accessibilityRole="button" accessibilityState={{ expanded }} style={s.textButton}><Text style={s.body}>{copy.notOpenMarkets(unavailable.length)} ›</Text></Pressable> : null}
    {expanded ? unavailable.map((u) => <View key={u.id} style={s.unavailable}><Glyph name={u.peril}/><Text style={s.dry}>{u.label} · {copy.NOT_OPEN_YET}</Text></View>) : null}
  </Enter>;
}
function Receipt({ receipt: r, onClose }: { receipt: ReceiptModel; onClose: () => void }) {
  const d = r.diagram, step = d ? 20 + d.step * 320 : 0;
  return <View><Pressable style={s.textButton} onPress={onClose}><Text style={s.link}>{copy.DONE}</Text></Pressable><Text style={s.title}>{r.title}</Text><Text style={[s.zone, { color: r.kind === "paid" ? C.slicker : C.fg2 }]}>{r.status}</Text>
    <View style={{ alignItems: "center" }}>{r.peril ? <Instrument peril={r.peril} rungs={r.rungs} trigger={r.trigger} reading={r.reading} state={r.trigger == null ? "ghost" : r.kind === "paid" ? "paid" : r.kind === "dry" ? "dry" : "covered"}/> : null}</View>
    {r.loss && r.gain ? <FigurePair loss={r.loss} gain={r.gain}/> : null}
    {d ? <Svg width="100%" height={112} viewBox="0 0 361 112" accessibilityLabel={`${copy.MAX_LOSS} ${d.loss} · ${copy.MAX_GAIN} ${d.gain}`}><Line x1={16} x2={345} y1={56} y2={56} stroke={C.tick}/><Path d={`M20 ${56 + d.lossPx} H${step}`} stroke={C.fg2} strokeWidth={3}/><Path d={`M${step} ${56 + d.lossPx} V${56 - d.gainPx}`} stroke={C.slicker} strokeWidth={2}/><Path d={`M${step} ${56 - d.gainPx} H345`} stroke={C.fg} strokeWidth={3}/>{d.ticks.map((fraction, i) => <Line key={i} x1={20 + fraction * 320} x2={20 + fraction * 320} y1={56} y2={64} stroke={C.tick}/>)}{d.reading != null ? <Circle cx={20 + d.reading * 320} cy={56} r={3} fill={C.glacier}/> : null}<SvgText x={20} y={110} fill={C.fg2} fontSize={13}>{d.loss} SKYT</SvgText><SvgText x={345} y={14} textAnchor="end" fill={C.fg} fontSize={13}>{d.gain} SKYT</SvgText><SvgText x={step} y={80} textAnchor="middle" fill={C.fg2} fontSize={13}>{d.trigger}</SvgText></Svg> : <Text style={s.note}>{copy.RECEIPT_DATA_UNAVAILABLE}</Text>}
    <Text style={s.note}>{r.reading == null ? copy.FINAL_READING_UNAVAILABLE : `${r.reading} ${r.unit}`}</Text>{r.settled ? <Text style={s.note}>{copy.NOAA_WINDOW_ENDED} · {r.settled}</Text> : null}<Text style={[s.mono, r.kind === "paid" && { color: C.slicker }]}>{copy.PAYOUT} {r.payout ?? "—"} SKYT</Text><Text style={s.mono}>{copy.MAX_LOSS} -{r.loss ?? "—"} SKYT</Text>{r.result ? <Text style={s.mono}>{r.result}</Text> : null}<Text selectable style={s.note}>{r.station} · {r.market}</Text>
  </View>;
}
export function WalletLine({ wallet, balance, receipts, totals, loading, failed, onConnect, onRetry, onDisconnect, technical }: { wallet: string | null; balance: string | null; receipts: ReceiptModel[]; totals: { loss: string; gain: string } | null; loading: boolean; failed: boolean; onConnect: () => void; onRetry: () => void; onDisconnect: () => void; technical?: ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null), [details, setDetails] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const receipt = receipts.find((r) => r.id === selected);
  return <Enter><View style={s.head}><Text style={s.title}>{copy.WALLET_TITLE}</Text><Text style={s.label}>{copy.DEVNET_TAG}</Text></View>{receipt ? <Receipt receipt={receipt} onClose={() => setSelected(null)}/> : <>
    {wallet ? <><Text style={s.label}>{copy.SKYT_BALANCE}</Text><Text style={s.balance}>{balance ?? "—"}</Text><Pressable accessibilityLabel={copy.COPY_ADDRESS} accessibilityRole="button" style={s.copyAddress} onPress={() => { try { Clipboard.setString(wallet); setCopyStatus(copy.COPIED); } catch { setCopyStatus(copy.COPY_FAILED); } }}><Text selectable style={s.address}>{wallet.slice(0, 4)}…{wallet.slice(-4)}</Text><Text style={s.label}>{copy.COPY_ADDRESS}</Text></Pressable>{copyStatus ? <Text accessibilityLiveRegion="polite" style={s.note}>{copyStatus}</Text> : null}
      {loading ? <Text style={s.note}>{copy.READING_WALLET}</Text> : null}{failed ? <View accessibilityRole="alert"><Text style={s.note}>{copy.CHAIN_ERROR}</Text><Pressable onPress={onRetry} style={s.textButton}><Text style={s.link}>{copy.TRY_AGAIN}</Text></Pressable></View> : null}
      {totals ? <FigurePair {...totals} across/> : null}<Text style={s.zone}>{copy.YOUR_COVERS}</Text>{!loading && !failed && !receipts.length ? <Text style={s.note}>{copy.EMPTY_COVERS}</Text> : null}
      {receipts.map((r) => <SpringPress key={r.id} onPress={() => setSelected(r.id)} style={s.walletRow}><View style={s.walletGlyph}><Glyph name={r.peril ?? "protect"}/></View><View style={s.walletMain}><Text numberOfLines={1} style={s.strong}>{r.peril ? `${perilById(r.peril)?.label} · ${r.city}` : r.title}</Text><Text numberOfLines={1} style={s.label}>{r.trigger != null ? `${r.trigger} ${r.unit} or more · Nov 1 to Dec 1` : r.status}</Text><View style={s.walletFigures}>{r.kind === "open" || r.kind === "pending" ? <><View style={s.walletFigure}><Text style={s.label}>{copy.MAX_LOSS}</Text><Text style={s.mono} numberOfLines={1}>-{r.loss ?? "—"}</Text></View><View style={s.walletFigure}><Text style={s.label}>{copy.MAX_GAIN}</Text><Text style={s.mono} numberOfLines={1}>+{r.gain ?? "—"}</Text></View></> : <View><Text style={s.mono}>{r.result ?? r.status}</Text><Text style={s.label}>{r.status}</Text></View>}</View></View><Text style={s.walletState}>{r.kind === "open" ? "✓ Open" : r.status}</Text><Glyph name="chevron"/></SpringPress>)}
      </> : <View style={s.empty}><Glyph name="wallet"/><Text style={s.body}>{copy.WALLET_INTRO}</Text><SpringPress onPress={onConnect} style={s.cta}><Text style={s.ctaText}>{copy.CONNECT_WALLET}</Text></SpringPress></View>}
    <Pressable style={s.textButton} accessibilityState={{ expanded: details }} onPress={() => setDetails(!details)}><Text style={s.body}>{copy.TECHNICAL_DETAILS} ›</Text></Pressable>{details ? <View><Text style={s.note}>{copy.CONTRACT_LABEL}</Text><Text style={s.note}>{copy.SETTLED_UNITS}</Text><Text style={s.note}>{copy.TECH_CONTEXT}</Text>{technical}{wallet ? <Pressable onPress={onDisconnect} style={s.disconnect}><Text style={s.label}>{copy.DISCONNECT}</Text></Pressable> : null}</View> : null}
  </>}</Enter>;
}
export function LandingLine({ quotes, loading, failed, onBrowse, onConnect }: { quotes: WindowQuote[]; loading: boolean; failed: boolean; onBrowse: () => void; onConnect: () => void }) {
  const [peril, setPeril] = useState<PerilId>(PERILS[0].id), [cover, setCover] = useState<CoverSize>(100);
  const markets = marketModels(quotes, Math.floor(Date.now() / 1000), cover), market = markets.find((m) => m.peril === peril);
  return <Enter><View style={s.head}><Text style={s.title}>SkyHedge</Text><Pressable onPress={onBrowse} style={s.textButton}><Text style={s.link}>{copy.OPEN_APP}</Text></Pressable></View><Text style={s.display}>{copy.LANDING_TITLE}</Text><Text style={s.lead}>{copy.LANDING_SUB}</Text><Filter all={false} value={peril} onChange={(id) => { if (id !== "all") setPeril(id); }} markets={markets}/>
    {market ? <><Text style={s.note}>{market.city} · {market.station}</Text><View style={s.stage}><Instrument peril={peril} rungs={market.rungs} trigger={market.trigger}/><View><Text style={s.label}>{copy.TRIGGER}</Text><Text style={s.mono}>{market.trigger} {market.unit}</Text><Text style={s.label}>{copy.CHANCE}</Text><Text style={s.mono}>{market.chance}</Text></View></View><View style={s.chips}>{([50,100,250] as const).map((size) => <Pressable key={size} style={[s.chip, size === cover && s.segmentOn]} onPress={() => setCover(size)} accessibilityState={{ selected: size === cover }}><Text style={s.body}>{size}</Text></Pressable>)}</View><FigurePair loss={market.loss} gain={market.gain}/><Text style={s.note}>{market.note}</Text></> : <View style={s.notOpen}><Text style={s.body}>{peril === "cold" ? copy.notOpenLine("cold", "") : loading ? copy.GETTING_QUOTE : failed ? copy.CHAIN_ERROR : `${perilById(peril)?.label} · ${copy.NOT_OPEN_YET}`}</Text>{failed ? <Pressable onPress={() => {}} style={s.textButton}><Text style={s.label}>{copy.TRY_AGAIN}</Text></Pressable> : null}</View>}
    <SpringPress onPress={() => { Vibration.vibrate(10); onConnect(); }} style={s.cta}><Text style={s.ctaText}>{copy.CONNECT_WALLET}</Text></SpringPress>{copy.HOW_IT_WORKS.map((step, index) => <Text key={step} style={s.step}>{index + 1}. {step}</Text>)}<Text style={s.zone}>{copy.HOW_SETTLES_TITLE}</Text><Text style={s.note}>{copy.HOW_IT_SETTLES}</Text>
  </Enter>;
}
const s = StyleSheet.create({
  head: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: C.fg, fontFamily: F.heading, fontSize: 32, lineHeight: 34 }, display: { color: C.fg, fontFamily: F.heading, fontSize: 52, lineHeight: 50, marginVertical: 24 },
  body: { color: C.fg, fontFamily: F.body, fontSize: 15, lineHeight: 22 }, strong: { color: C.fg, fontFamily: F.bodySemi, fontSize: 15, lineHeight: 22 },
  label: { color: C.fg2, fontFamily: F.bodyMedium, fontSize: 13, lineHeight: 18 }, note: { color: C.fg2, fontFamily: F.body, fontSize: 13, lineHeight: 18, marginVertical: 12 },
  link: { color: C.glacier, fontFamily: F.bodySemi, fontSize: 15 }, textButton: { minHeight: 48, justifyContent: "center" },
  zone: { color: C.fg2, fontFamily: F.heading, fontSize: 15, lineHeight: 18, letterSpacing: .5, marginTop: 32, marginBottom: 8, textTransform: "uppercase" },
  switcher: { flexDirection: "row", height: 56, marginBottom: 0, position: "relative" }, segment: { flex: 1, minWidth: 0, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 2 }, segmentOn: {}, tick: { position: "absolute", bottom: 0, left: 0, height: 3, backgroundColor: C.glacier },
  stage: { flexDirection: "row", minHeight: 120, alignItems: "center", gap: 8 }, stats: { flexDirection: "row", minHeight: 44, gap: 4, marginTop: 8 }, marketTrigger: { color: C.slicker, fontFamily: F.heading, fontSize: 40, lineHeight: 42 }, monoSmall: { color: C.fg2, fontFamily: F.mono, fontSize: 15, lineHeight: 20 }, salesNote: { color: C.fg2, fontFamily: F.body, fontSize: 13, lineHeight: 18, minHeight: 24 },
  mono: { color: C.fg, fontFamily: F.mono, fontSize: 17, lineHeight: 24 }, figure: { color: C.fg, fontFamily: F.mono, fontSize: 28, lineHeight: 36 }, balance: { color: C.fg, fontFamily: F.mono, fontSize: 44, lineHeight: 52, marginVertical: 8 }, address: { color: C.fg2, fontFamily: F.mono, fontSize: 15, lineHeight: 22 }, copyAddress: { minHeight: 48, flexDirection: "row", gap: 12, alignItems: "center" },
  cta: { minHeight: 56, borderRadius: 999, backgroundColor: C.glacier, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }, ctaText: { color: C.onGlacier, fontFamily: F.bodySemi, fontSize: 15 },
  cells: { flexDirection: "row", gap: 16, marginVertical: 12 }, cell: { flex: 1, minHeight: 88, padding: 12, backgroundColor: C.bgRaised, borderRadius: 14 }, walletTotals: { gap: 16 }, walletTotalCell: { flex: 0, width: 172, height: 88, minHeight: 88, padding: 8 }, inlineFigure: { flexDirection: "row", alignItems: "baseline", gap: 6 }, totalFigure: { fontSize: 28, lineHeight: 32 },
  marketRow: { flexDirection: "row", gap: 8, minHeight: 88, alignItems: "center", borderBottomWidth: 1, borderBottomColor: C.tick, paddingVertical: 8 }, triggerCopy: { color: C.fg, fontFamily: F.mono, fontSize: 15, lineHeight: 20 }, marketGlyph: { width: 40, height: 40, alignItems: "center", justifyContent: "center" }, tint: { position: "absolute", width: 8, height: 8, borderRadius: 4, right: 0, bottom: 2, backgroundColor: C.rain }, odds: { width: 56, alignItems: "flex-end" }, zoneHead: { marginTop: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }, coversSummary: { minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: C.tick },
  walletRow: { flexDirection: "row", gap: 8, minHeight: 104, alignItems: "center", backgroundColor: C.surface1, borderRadius: 14, padding: 10, marginVertical: 4 }, walletGlyph: { width: 24 }, walletMain: { flex: 1, minWidth: 0, gap: 2 }, walletFigures: { flexDirection: "row", gap: 8 }, walletFigure: { flex: 1, minWidth: 80 }, walletState: { color: C.fg2, fontFamily: F.body, fontSize: 13 }, status: { color: C.fg2, fontFamily: F.body, fontSize: 13 }, result: { color: C.fg, fontFamily: F.mono, fontSize: 13, lineHeight: 20 }, disconnect: { minHeight: 48, justifyContent: "center" }, notOpen: { minHeight: 56, justifyContent: "center" },
  empty: { minHeight: 220, justifyContent: "center", alignItems: "center", gap: 12 }, unavailable: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12 }, dry: { color: C.dryText, fontFamily: F.body, fontSize: 13 },
  tile: { width: 168, minHeight: 216, padding: 12, backgroundColor: C.surface1, borderRadius: 14 }, intro: { backgroundColor: C.surface1, borderRadius: 14, padding: 12 },
  lead: { color: C.fg2, fontFamily: F.body, fontSize: 17, lineHeight: 26, marginBottom: 24 }, step: { color: C.fg, fontFamily: F.body, fontSize: 15, lineHeight: 22, marginTop: 20 }, chips: { flexDirection: "row", gap: 8 }, chip: { minHeight: 48, minWidth: 64, alignItems: "center", justifyContent: "center", borderRadius: 999 },
});
