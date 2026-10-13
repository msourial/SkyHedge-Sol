import React, { useEffect, useRef } from "react";
import { Animated, Easing, Linking, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, F, MIN_TOUCH } from "./theme";
import { ActionButton, AppIcon, Text } from "./ui";
import { useReducedMotion } from "./liquid-glass";
import { BrandMark } from "./BrandMark";
import { GlassCard, RainGauge, CountUp, Ticker } from "./revamp";

const TAB = ["tabular-nums" as const];

/** Screen title row replacing the old persistent header: back/brand on the left, Devnet pill top-right. */
export function ScreenTop(props: { onBack?: () => void; backIcon?: "chevron-left" | "x"; eyebrow?: string; title?: string; lead?: string; brand?: boolean }) {
  return <View style={j.top}>
    <View style={j.topRow}>
      {props.onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={props.onBack} style={j.back}><AppIcon name={props.backIcon ?? "chevron-left"} color={C.rain} size={24} /></Pressable>
        : props.brand ? <View style={j.brand}><BrandMark size={34} /><Text style={j.brandText}>SkyHedge</Text></View>
        : <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><BrandMark size={20} tile={false} /><Text style={j.eyebrowCaps}>SkyHedge</Text></View>}
      <DevnetPill />
    </View>
    {props.eyebrow ? <Text style={j.eyebrow}>{props.eyebrow}</Text> : null}
    {props.title ? <Text accessibilityRole="header" style={j.title}>{props.title}</Text> : null}
    {props.lead ? <Text style={j.lead}>{props.lead}</Text> : null}
  </View>;
}

export function DevnetPill() {
  return <View style={j.devnet} accessible accessibilityLabel="Solana Devnet, test token"><Text style={j.devnetText}>Devnet · test token</Text></View>;
}

/** Clearly-labelled banner for the hidden demo preview states. */
export function DemoBanner() {
  return <View style={j.demo} accessibilityRole="alert"><Text style={j.demoTitle}>DEMO PREVIEW</Text><Text style={j.demoBody}>Sample values for design review — not your wallet, not real market data. Nothing can be signed here.</Text></View>;
}

/** Blue→amber gradient meter that animates to `fraction` (0..1). Optional tick marks the trigger. */
export function GradientMeter({ fraction, tick, height = 6 }: { fraction: number | null; tick?: number | null; height?: number }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => { if (!reduced) Animated.timing(v, { toValue: 1, duration: 1000, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, [v, reduced]);
  const f = fraction == null ? 0 : Math.max(0, Math.min(1, fraction));
  return <View style={[j.meter, { height, borderRadius: height / 2 }]}>
    <Animated.View style={{ width: `${f * 100}%`, height: "100%", transformOrigin: "left", transform: [{ scaleX: v }] }}>
      <LinearGradient colors={["#5EC8FF", "#9CCB9A", "#F5B841"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: height / 2 }]} />
    </Animated.View>
    {tick != null ? <View style={[j.tick, { left: `${Math.max(0, Math.min(1, tick)) * 100}%` }]} /> : null}
  </View>;
}

/** Three-step gradient progress (Trigger hit / Verified / Collect). */
export function ProgressSteps({ steps, done }: { steps: string[]; done: number }) {
  return <View style={j.steps} accessible accessibilityLabel={`${done} of ${steps.length} steps complete`}>
    {steps.map((s, i) => <View key={s} style={{ flex: 1 }}>
      {i < done ? <LinearGradient colors={["#5EC8FF", "#8FDDFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={j.stepBar} /> : <View style={[j.stepBar, { backgroundColor: C.border }]} />}
      <Text style={[j.stepLabel, i < done && { color: C.ink }]}>{s}</Text>
    </View>)}
  </View>;
}

export function LivePill({ label, tone = "live" }: { label: string; tone?: "live" | "warn" | "gold" }) {
  const col = tone === "live" ? C.mint : C.amber;
  return <View style={[j.livePill, { borderColor: col + "77", backgroundColor: col + "1F", boxShadow: `0px 0px 12px ${col}40` }]}>
    <View style={[j.liveDot, { backgroundColor: col, boxShadow: `0px 0px 6px ${col}` }]} />
    <Text style={[j.livePillText, { color: col }]}>{label}</Text>
  </View>;
}

/** Coverage-detail hero: gauge + big observed figure + trigger and gradient meter. */
export function CoverageHero(props: { live: boolean; stateLabel: string; windowLabel: string | null; observedMm: number | null; triggerMm: number | null; triggerSymbol: string; source: string; updated?: string | null }) {
  const toGo = props.observedMm != null && props.triggerMm != null ? Math.max(0, props.triggerMm - props.observedMm) : null;
  return <GlassCard accent={props.live ? C.rain : undefined}>
    <View style={j.rowCenter}><LivePill label={props.stateLabel.toUpperCase()} tone={props.live ? "live" : "warn"} />{props.windowLabel ? <Text style={j.caption}>  Window {props.windowLabel}</Text> : null}</View>
    <View style={{ flexDirection: "row", gap: 18, marginTop: 16, alignItems: "flex-end" }}>
      <RainGauge observedMm={props.observedMm} triggerMm={props.triggerMm} height={170} />
      <View style={{ flex: 1 }}>
        <Text style={j.overline}>Observed so far</Text>
        <View style={j.baseline}><CountUp value={props.observedMm} style={j.hero} /><Text style={j.unit}> mm</Text></View>
        {props.triggerMm != null ? <Text style={j.mono}><Text style={{ color: C.amber }}>■ </Text>Trigger {props.triggerSymbol} {props.triggerMm} mm{toGo != null ? <Text style={{ color: C.rain }}> · {toGo.toFixed(1)} mm to go</Text> : null}</Text> : null}
        <View style={{ marginVertical: 10 }}><GradientMeter fraction={props.observedMm != null && props.triggerMm ? props.observedMm / props.triggerMm : null} /></View>
        <Text style={j.caption}>{props.observedMm == null ? `Not reported yet · ${props.source}` : `${props.updated ? `Through ${props.updated} · ` : ""}${props.source}`}</Text>
      </View>
    </View>
  </GlassCard>;
}

export function StatPair(props: { leftLabel: string; left: string; leftUnit: string; rightLabel: string; right: string; rightUnit: string }) {
  return <View style={{ flexDirection: "row", gap: 12 }}>
    <GlassCard style={{ flex: 1 }}><Text style={j.overline}>{props.leftLabel}</Text><Text style={j.stat}>{props.left}</Text><Text style={[j.monoSm, { color: C.rain }]}>{props.leftUnit}</Text></GlassCard>
    <GlassCard style={{ flex: 1 }}><Text style={j.overline}>{props.rightLabel}</Text><Text style={j.stat}>{props.right}</Text><Text style={j.caption}>{props.rightUnit}</Text></GlassCard>
  </View>;
}

export function FactRows({ rows, mono = false }: { rows: Array<{ k: string; v: string; tone?: "gold" | "mint" | "rain"; onPress?: () => void }>; mono?: boolean }) {
  return <GlassCard style={{ paddingVertical: 4 }}>
    {rows.map((r, i) => {
      const col = r.tone === "gold" ? C.amber : r.tone === "mint" ? C.mint : r.tone === "rain" ? C.rain : C.ink;
      const V = <Text style={[mono ? j.factVMono : j.factV, { color: col }]}>{r.v}</Text>;
      return <View key={r.k} style={[j.fact, i > 0 && j.factBorder]}>
        <Text style={mono ? j.factKMono : j.factK}>{r.k}</Text>
        {r.onPress ? <Pressable accessibilityRole="link" onPress={r.onPress} hitSlop={8}>{V}</Pressable> : V}
      </View>;
    })}
  </GlassCard>;
}

/** Collect payout screen (one tap; payouts are automatic, there is no claims form). */
export function CollectPayoutView(props: { demo?: boolean; observedMm: number | null; triggerMm: number | null; source: string; windowLabel: string | null; amountLabel: string | null; walletLabel: string | null; onBack: () => void }) {
  const max = Math.max(props.triggerMm ?? 0, props.observedMm ?? 0) * 1.15 || 1;
  return <>
    <ScreenTop onBack={props.onBack} title="Collect payout" lead="No claims form. Verified station data hit your trigger, so the payout is ready." />
    {props.demo ? <DemoBanner /> : null}
    <ProgressSteps steps={["Trigger hit", "Verified", "Collect"]} done={3} />
    <GlassCard accent={C.amber}>
      <LivePill label="⚡ TRIGGER HIT" tone="warn" />
      <View style={[j.rowBetween, { marginTop: 14, alignItems: "flex-end" }]}>
        <View><Text style={j.overline}>Observed</Text><View style={j.baseline}><CountUp value={props.observedMm} style={j.hero} /><Text style={j.unit}> mm</Text></View></View>
        <View style={{ alignItems: "flex-end" }}><Text style={j.overline}>Trigger</Text><Text style={j.triggerFig}>{props.triggerMm != null ? `${props.triggerMm} mm` : "—"}</Text></View>
      </View>
      <View style={{ marginVertical: 12 }}><GradientMeter fraction={props.observedMm != null ? props.observedMm / max : null} tick={props.triggerMm != null ? props.triggerMm / max : null} height={8} /></View>
      <Text style={j.caption}>{props.source}{props.windowLabel ? ` · ${props.windowLabel}` : ""}</Text>
    </GlassCard>
    <GlassCard style={{ alignItems: "center", paddingVertical: 24 }}>
      <Text style={j.overline}>Payout</Text>
      <Text style={j.payout}>{props.amountLabel ? `+${props.amountLabel}` : "—"}</Text>
      <Text style={[j.overline, { fontSize: 13 }]}>SKYT</Text>
      {props.walletLabel ? <View style={j.walletChip}><AppIcon name="credit-card" color={C.rain} size={14} /><Text style={j.monoSm}>  To {props.walletLabel}</Text></View> : null}
    </GlassCard>
    <Text style={[j.caption, { textAlign: "center" }]}>One tap · approve once in your wallet via Mobile Wallet Adapter</Text>
  </>;
}

/** Settlement / confirmation receipt with scrolling ticker. */
export function ReceiptView(props: { demo?: boolean; title: string; badge: string; symbol: string; amount: string | null; caption: string | null; rows: Array<{ k: string; v: string; tone?: "gold" | "mint" | "rain"; onPress?: () => void }>; ticker: string[]; signature: string | null; onClose: () => void; onAgain: () => void; onMarkets: () => void }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start(); }, [pop]);
  return <>
    <ScreenTop onBack={props.onClose} backIcon="x" />
    {props.demo ? <DemoBanner /> : null}
    <Animated.View style={[j.check, { transform: [{ scale: pop }] }]}><AppIcon name="check" color={C.mint} size={28} /></Animated.View>
    <Text style={[j.overline, { textAlign: "center", marginBottom: 14 }]}>{props.title}</Text>
    <GlassCard>
      <View style={j.rowBetween}><Text style={j.symbol}>{props.symbol}</Text><LivePill label={`▲ ${props.badge}`} /></View>
      {props.amount ? <Text style={j.receiptBig} adjustsFontSizeToFit numberOfLines={1}>{props.amount}</Text> : null}
      {props.caption ? <Text style={[j.monoSm, { color: C.mint }]}>{props.caption}</Text> : null}
      <View style={{ height: 1, backgroundColor: C.border, marginVertical: 14 }} />
      {props.rows.map((r) => {
        const col = r.tone === "gold" ? C.amber : r.tone === "mint" ? C.mint : r.tone === "rain" ? C.rain : C.ink;
        const V = <Text style={[j.factVMono, { color: col }]}>{r.v}</Text>;
        return <View key={r.k} style={j.rRow}><Text style={j.factKMono}>{r.k}</Text>{r.onPress ? <Pressable accessibilityRole="link" onPress={r.onPress} hitSlop={8}>{V}</Pressable> : V}</View>;
      })}
    </GlassCard>
    <Ticker items={props.ticker} />
    <View style={{ marginTop: 4 }}><ActionButton label="Protect again" onPress={props.onAgain} disabled={props.demo} /></View>
    <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
      <Pressable accessibilityRole="button" onPress={props.onMarkets} style={j.ghost}><Text style={j.ghostText}>Back to markets</Text></Pressable>
      <Pressable accessibilityRole="link" disabled={!props.signature} onPress={() => { if (props.signature) void Linking.openURL(`https://explorer.solana.com/tx/${encodeURIComponent(props.signature)}?cluster=devnet`); }} style={[j.ghost, !props.signature && { opacity: 0.5 }]}><Text style={[j.ghostText, { color: C.rain }]}>View on explorer ↗</Text></Pressable>
    </View>
  </>;
}

const j = StyleSheet.create({
  perilRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  peril: { flex: 1, minHeight: 64, borderRadius: 16, borderWidth: 1, borderColor: "rgba(160,205,235,0.16)", backgroundColor: "rgba(24,32,42,0.6)", alignItems: "center", justifyContent: "center", gap: 3 },
  perilOn: { borderColor: C.rain, backgroundColor: "rgba(94,200,255,0.14)", boxShadow: "0px 0px 16px rgba(94,200,255,0.35)" },
  perilOff: { opacity: 0.6, borderStyle: "dashed" },
  perilText: { color: C.ink, fontFamily: F.bodySemi, fontSize: 13 },
  perilSoon: { color: C.amber, fontFamily: F.mono, fontSize: 9, letterSpacing: 1 },
  top: { marginBottom: 14 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44, marginBottom: 6 },
  back: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, justifyContent: "center", marginLeft: -8, paddingLeft: 4 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", boxShadow: "0px 0px 14px rgba(94,200,255,0.45)" },
  brandText: { color: C.ink, fontFamily: F.headingBold, fontSize: 19 },
  eyebrowCaps: { color: C.quiet, fontFamily: F.bodySemi, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase" },
  eyebrow: { color: C.muted, fontFamily: F.bodyMedium, fontSize: 13, marginBottom: 2 },
  title: { color: C.ink, fontFamily: F.headingBold, fontSize: 32, lineHeight: 38, letterSpacing: -1 },
  lead: { color: C.muted, fontFamily: F.body, fontSize: 15, lineHeight: 21, marginTop: 6 },
  devnet: { borderWidth: 1, borderColor: "rgba(245,184,65,0.55)", backgroundColor: "rgba(245,184,65,0.12)", borderRadius: 14, paddingHorizontal: 11, paddingVertical: 5, boxShadow: "0px 0px 12px rgba(245,184,65,0.18)" },
  devnetText: { color: C.amber, fontFamily: F.bodyBold, fontSize: 12 },
  demo: { borderWidth: 1, borderStyle: "dashed", borderColor: C.amber, backgroundColor: "rgba(245,184,65,0.10)", borderRadius: 14, padding: 12, marginBottom: 14 },
  demoTitle: { color: C.amber, fontFamily: F.mono, fontWeight: "700", fontSize: 13, letterSpacing: 1.5 },
  demoBody: { color: C.muted, fontFamily: F.body, fontSize: 12, lineHeight: 17, marginTop: 4 },
  meter: { width: "100%", backgroundColor: "rgba(160,200,230,0.12)", overflow: "visible" },
  tick: { position: "absolute", top: -4, bottom: -4, width: 2, marginLeft: -1, backgroundColor: C.ink },
  steps: { flexDirection: "row", gap: 8, marginBottom: 16 },
  stepBar: { height: 4, borderRadius: 2, marginBottom: 6 },
  stepLabel: { color: C.quiet, fontFamily: F.bodySemi, fontSize: 12 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 14, paddingHorizontal: 11, minHeight: 28, alignSelf: "flex-start" },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  livePillText: { fontFamily: F.bodyBold, fontSize: 12, letterSpacing: 0.8 },
  rowCenter: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  baseline: { flexDirection: "row", alignItems: "baseline" },
  overline: { color: C.quiet, fontFamily: F.bodyBold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
  hero: { color: C.ink, fontFamily: F.mono, fontWeight: "700", fontSize: 52, lineHeight: 60, letterSpacing: -1.5, fontVariant: TAB },
  unit: { color: C.muted, fontFamily: F.mono, fontSize: 16 },
  mono: { color: C.ink, fontFamily: F.mono, fontSize: 13 },
  monoSm: { color: C.muted, fontFamily: F.mono, fontSize: 13 },
  caption: { color: C.quiet, fontFamily: F.body, fontSize: 12, lineHeight: 18 },
  stat: { color: C.ink, fontFamily: F.mono, fontWeight: "700", fontSize: 36, lineHeight: 44, fontVariant: TAB },
  fact: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  factBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(160,200,230,0.18)" },
  factK: { color: C.muted, fontFamily: F.body, fontSize: 15 },
  factV: { fontFamily: F.bodySemi, fontSize: 15 },
  factKMono: { color: C.quiet, fontFamily: F.mono, fontSize: 13, letterSpacing: 0.8, textTransform: "uppercase" },
  factVMono: { fontFamily: F.mono, fontSize: 14, fontVariant: TAB },
  rRow: { minHeight: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  triggerFig: { color: C.amber, fontFamily: F.mono, fontWeight: "700", fontSize: 28, textShadowColor: "rgba(245,184,65,0.45)", textShadowRadius: 12 },
  payout: { color: C.mint, fontFamily: F.mono, fontWeight: "700", fontSize: 72, lineHeight: 84, letterSpacing: -2, textShadowColor: "rgba(52,211,153,0.6)", textShadowRadius: 22, fontVariant: TAB },
  walletChip: { flexDirection: "row", alignItems: "center", marginTop: 12, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: "rgba(94,200,255,0.10)" },
  check: { width: 62, height: 62, borderRadius: 31, backgroundColor: "rgba(52,211,153,0.14)", borderWidth: 1, borderColor: "rgba(52,211,153,0.6)", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 10, boxShadow: "0px 0px 24px rgba(52,211,153,0.35)" },
  symbol: { color: C.ink, fontFamily: F.mono, fontWeight: "700", fontSize: 15, letterSpacing: 1 },
  receiptBig: { color: C.mint, fontFamily: F.mono, fontWeight: "700", fontSize: 64, lineHeight: 76, letterSpacing: -2, marginTop: 6, textShadowColor: "rgba(52,211,153,0.55)", textShadowRadius: 20, fontVariant: TAB },
  ghost: { flex: 1, minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: "rgba(160,200,230,0.18)", backgroundColor: "rgba(30,40,52,0.6)", alignItems: "center", justifyContent: "center" },
  ghostText: { color: C.ink, fontFamily: F.bodySemi, fontSize: 15 },
});

/* ───────────── Peril selector ───────────── */
export type PerilId = "rain" | "wind" | "snow" | "heat";
export const PERILS: ReadonlyArray<{ id: PerilId; label: string; icon: "cloud-rain" | "wind" | "cloud-snow" | "thermometer" }> = [
  { id: "rain", label: "Rain", icon: "cloud-rain" },
  { id: "wind", label: "Wind", icon: "wind" },
  { id: "snow", label: "Snow", icon: "cloud-snow" },
  { id: "heat", label: "Heat", icon: "thermometer" },
];

/** A market is a place; the peril is chosen here. Only perils listed in `available` can be selected (Rain today). */
export function PerilSelector({ value, available, onChange }: { value: PerilId; available: ReadonlyArray<PerilId>; onChange?: (p: PerilId) => void }) {
  return <View style={{ marginBottom: 14 }}>
    <Text style={j.overline}>Choose a peril</Text>
    <View style={j.perilRow} accessibilityRole="radiogroup" accessibilityLabel="Weather peril">
      {PERILS.map((p) => {
        const ok = available.includes(p.id);
        const on = ok && p.id === value;
        return <Pressable key={p.id} disabled={!ok} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: !ok }} accessibilityLabel={ok ? p.label : `${p.label}, coming soon`} onPress={() => onChange?.(p.id)} style={[j.peril, on && j.perilOn, !ok && j.perilOff]}>
          <AppIcon name={p.icon} color={on ? C.rain : ok ? C.ink : C.quiet} size={18} />
          <Text style={[j.perilText, on && { color: C.rain }, !ok && { color: C.quiet }]}>{p.label}</Text>
          {!ok ? <Text style={j.perilSoon}>SOON</Text> : null}
        </Pressable>;
      })}
    </View>
    {available.length ? <Text style={j.caption}>Wind, snow and heat are coming soon — no prices or triggers exist for them yet.</Text> : <Text style={j.caption}>No peril is open here yet — every peril is coming soon.</Text>}
  </View>;
}
