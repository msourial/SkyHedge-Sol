import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View, Vibration, Easing } from "react-native";
import Svg, { Path } from "react-native-svg";
import { PERILS, perilById } from "../../../shared/peril-registry.ts";
import * as copy from "../../../shared/ui-copy.ts";
import { marketModels, type MarketModel } from "../../../shared/ui-discovery.ts";
import { instrumentArt } from "../../../shared/ui-instrument.ts";
import { lineGlyphs } from "../../../shared/ui-glyphs.ts";
import { lineTokens as C } from "../../../shared/ui-tokens.ts";
import type { CoverSize, PerilId, WindowQuote } from "../../../shared/ui-types.ts";
import { LineArt } from "./art.tsx";
import { F } from "../theme.ts";
import { useReducedMotion } from "../liquid-glass.tsx";
import { Enter, SpringPress } from "../motion.tsx";

function Glyph({ name, color = C.fg2 }: { name: keyof typeof lineGlyphs; color?: string }) { return <Svg width={24} height={24} viewBox="0 0 24 24">{lineGlyphs[name].map((d) => <Path key={d} d={d} stroke={color} strokeWidth={1.75} fill="none" strokeLinecap="round"/>)}</Svg>; }
function Instrument({ peril, rungs = [], trigger = null, reading = null, size = "stage", state = "idle" }: { peril: PerilId; rungs?: number[]; trigger?: number | null; reading?: number | null; size?: "mini" | "stage" | "tile" | "hero"; state?: "ghost" | "idle" | "covered" | "paid" | "dry" | "loading" }) {
  const art = instrumentArt({ peril, rungs, selected: trigger, reading, state, size, unit: perilById(peril)?.unit ?? "" });
  return <LineArt {...art}/>;
}
function Filter({ value, onChange, markets, all = true, perilIds }: { value: PerilId | "all"; onChange: (id: PerilId | "all") => void; markets: MarketModel[]; all?: boolean; perilIds?: PerilId[] }) {
  const items = [...(all ? [{ id: "all" as const, label: copy.ALL }] : []), ...(perilIds ? PERILS.filter((p) => perilIds.includes(p.id)) : PERILS)];
  const index = Math.max(0, items.findIndex((p) => p.id === value));
  const x = useRef(new Animated.Value(index)).current;
  const reducedMotion = useReducedMotion();
  useEffect(() => { const a = Animated.timing(x, { toValue: index, duration: reducedMotion ? 0 : 240, easing: Easing.bezier(.23,1,.32,1), useNativeDriver: true }); a.start(); return () => a.stop(); }, [index, x, reducedMotion]);
  return <View style={s.switcher} accessibilityRole="tablist">{items.map((peril) => { const selected = value === peril.id; const open = peril.id === "all" || markets.some((m) => m.peril === peril.id); const color = open ? selected ? C.fg : C.fg2 : C.dryText; return <Pressable key={peril.id} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(peril.id)} style={s.segment}>
    <Glyph name={peril.id === "all" ? "markets" : peril.id} color={color}/><Text style={[s.label, { color }]}>{peril.id === "all" ? copy.ALL : peril.label}</Text>
  </Pressable>; })}<Animated.View pointerEvents="none" style={[s.tick, { width: `${100/items.length}%`, transform: [{ translateX: Animated.multiply(x, 361/items.length) }] }]}/></View>;
}
export function FigurePair({ loss, gain, across = false, caption }: { loss: string; gain: string; across?: boolean; caption?: string }) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    opacity.stopAnimation();
    if (reduced) { opacity.setValue(1); return; }
    opacity.setValue(0);
    const animation = Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [loss, gain, reduced, opacity]);
  return <View>{<Animated.View style={[s.cells, across && s.walletTotals, { opacity }]}>{[{ label: across ? copy.LOSS_OPEN : copy.MAX_LOSS, amount: `-${loss}` }, { label: across ? copy.GAIN_OPEN : copy.MAX_GAIN, amount: `+${gain}` }].map((item) => <View key={item.label} style={[s.cell, across && s.walletTotalCell]}><Text numberOfLines={1} style={s.label}>{item.label}</Text><View style={s.inlineFigure}><Text style={[s.figure, across && s.totalFigure]}>{item.amount}</Text>{!across ? <Text style={s.label}>SKYT</Text> : null}</View></View>)}</Animated.View>}{caption ? <Text style={s.label}>{caption}</Text> : null}</View>;
}
export function FirstRunStrip({ onDismiss }: { onDismiss: () => void }) { return null; }
export { MarketsLine } from "./MarketsLine.tsx";

export { WalletLine } from "./WalletLine.tsx";
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
  body: { color: C.fg, fontFamily: F.body, fontSize: 15, lineHeight: 22 },
  label: { color: C.fg2, fontFamily: F.bodyMedium, fontSize: 13, lineHeight: 18 }, note: { color: C.fg2, fontFamily: F.body, fontSize: 13, lineHeight: 18, marginVertical: 12 },
  link: { color: C.glacier, fontFamily: F.bodySemi, fontSize: 15 }, textButton: { minHeight: 48, justifyContent: "center" },
  zone: { color: C.fg2, fontFamily: F.heading, fontSize: 15, lineHeight: 18, letterSpacing: .5, marginTop: 32, marginBottom: 8, textTransform: "uppercase" },
  switcher: { flexDirection: "row", height: 56, marginBottom: 0, position: "relative" }, segment: { flex: 1, minWidth: 0, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 2 }, segmentOn: {}, tick: { position: "absolute", bottom: 0, left: 0, height: 3, backgroundColor: C.glacier },
  stage: { flexDirection: "row", minHeight: 152, alignItems: "center", gap: 8, marginTop: 16 },
  mono: { color: C.fg, fontFamily: F.mono, fontSize: 17, lineHeight: 24 }, figure: { color: C.fg, fontFamily: F.mono, fontSize: 28, lineHeight: 36 }, balance: { color: C.fg, fontFamily: F.mono, fontSize: 44, lineHeight: 52, marginVertical: 8 }, balanceRow: { flexDirection: "row", alignItems: "baseline", gap: 8 }, balanceUnit: { color: C.fg2, fontFamily: F.bodyMedium, fontSize: 13 }, address: { color: C.fg2, fontFamily: F.mono, fontSize: 15, lineHeight: 22, flex: 1 }, copyAddress: { minHeight: 48, flexDirection: "row", gap: 12, alignItems: "center" }, copyIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" }, copyGlyph: { color: C.glacier, fontSize: 22 },
  cta: { minHeight: 56, borderRadius: 999, backgroundColor: C.glacier, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }, ctaText: { color: C.onGlacier, fontFamily: F.bodySemi, fontSize: 15 },
  cells: { flexDirection: "row", gap: 16, marginVertical: 12 }, cell: { flex: 1, minHeight: 88, padding: 12, backgroundColor: C.bgRaised, borderRadius: 14 }, walletTotals: { gap: 16 }, walletTotalCell: { flex: 1, width: undefined, height: 88, minHeight: 88, padding: 8 }, inlineFigure: { flexDirection: "row", alignItems: "baseline", gap: 6 }, totalFigure: { fontSize: 28, lineHeight: 32 },
  walletRow: { flexDirection: "row", gap: 8, minHeight: 96, alignItems: "center", backgroundColor: C.surface1, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 10, marginVertical: 4 }, walletGlyph: { width: 24 }, walletMain: { flex: 1, minWidth: 0, gap: 2 }, walletTrigger: { color: C.fg, fontFamily: F.mono, fontSize: 17, lineHeight: 24 }, windowZone: { color: C.fg2, fontFamily: F.body, fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 4, fontWeight: "400" }, walletFigures: { flexDirection: "row", gap: 8 }, walletFigure: { flex: 1, minWidth: 80 }, walletAmount: { color: C.fg, fontFamily: F.mono, fontSize: 15, lineHeight: 20 }, walletState: { color: C.fg2, fontFamily: F.body, fontSize: 13 }, walletPaid: { color: C.slicker }, disconnect: { minHeight: 48, justifyContent: "center" }, notOpen: { minHeight: 56, justifyContent: "center" },
  empty: { minHeight: 220, justifyContent: "center", alignItems: "center", gap: 12 },
  lead: { color: C.fg2, fontFamily: F.body, fontSize: 17, lineHeight: 26, marginBottom: 24 }, step: { color: C.fg, fontFamily: F.body, fontSize: 15, lineHeight: 22, marginTop: 20 }, chips: { flexDirection: "row", gap: 8 }, chip: { minHeight: 48, minWidth: 64, alignItems: "center", justifyContent: "center", borderRadius: 999 },
});
