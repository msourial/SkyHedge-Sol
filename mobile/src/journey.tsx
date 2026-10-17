import { useEffect, useRef } from "react";
import { Animated, Easing, Linking, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, F, glass, MIN_TOUCH, space as S, statusGlow, type as T } from "./theme";
import { ActionButton, AppIcon, Text } from "./ui";
import { useReducedMotion } from "./liquid-glass";
import { BrandMark } from "./BrandMark";
import { MARKETING_SHOTS } from "./marketing";
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

/** Hidden entirely when EXPO_PUBLIC_MARKETING_SHOTS=1 so landing mockups need no badge mask. */
export function DevnetPill() {
  if (MARKETING_SHOTS) return null;
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
      <LinearGradient colors={[C.rain, C.mint, C.payout]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: height / 2 }]} />
    </Animated.View>
    {tick != null ? <View style={[j.tick, { left: `${Math.max(0, Math.min(1, tick)) * 100}%` }]} /> : null}
  </View>;
}

/** Three-step gradient progress (Trigger hit / Verified / Collect). */
export function ProgressSteps({ steps, done }: { steps: string[]; done: number }) {
  return <View style={j.steps} accessible accessibilityLabel={`${done} of ${steps.length} steps complete`}>
    {steps.map((s, i) => <View key={s} style={{ flex: 1 }}>
      {i < done ? <LinearGradient colors={[C.rain, C.rainBright]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={j.stepBar} /> : <View style={[j.stepBar, { backgroundColor: C.border }]} />}
      <Text style={[j.stepLabel, i < done && { color: C.ink }]}>{s}</Text>
    </View>)}
  </View>;
}

export function LivePill({ label, tone = "live" }: { label: string; tone?: "live" | "warn" | "gold" | "closed" }) {
  const col = tone === "live" ? C.mint : tone === "gold" ? C.payout : tone === "closed" ? C.muted : C.amber;
  const soft = tone === "live" ? C.mintSoft : tone === "gold" ? C.payoutSoft : tone === "closed" ? C.mutedSurface : C.amberSoft;
  return <View style={[j.livePill, { borderColor: col + "77", backgroundColor: soft, boxShadow: statusGlow(col) }]}>
    <View style={[j.liveDot, { backgroundColor: col }]} />
    <Text style={[j.livePillText, { color: col }]}>{label}</Text>
  </View>;
}

/** Coverage-detail hero: gauge + big observed figure + trigger and gradient meter. */
export function CoverageHero(props: { live: boolean; stateLabel: string; windowLabel: string | null; observedMm: number | null; triggerMm: number | null; triggerSymbol: string; source: string; updated?: string | null }) {
  const toGo = props.observedMm != null && props.triggerMm != null ? Math.max(0, props.triggerMm - props.observedMm) : null;
  return <GlassCard accent={props.live ? C.mint : undefined}>
    <View style={j.rowCenter}><LivePill label={props.stateLabel} tone={props.stateLabel === "Sales closed" ? "closed" : props.live ? "live" : "warn"} />{props.windowLabel ? <Text style={j.caption}>  Window {props.windowLabel}</Text> : null}</View>
    <View style={{ flexDirection: "row", gap: S.lg + 2, marginTop: S.lg, alignItems: "flex-end" }}>
      <RainGauge observedMm={props.observedMm} triggerMm={props.triggerMm} height={170} />
      <View style={{ flex: 1 }}>
        <Text style={j.overline}>Observed so far</Text>
        <View style={j.baseline}><CountUp value={props.observedMm} style={j.hero} /><Text style={j.unit}> mm</Text></View>
        {props.triggerMm != null ? <Text style={j.mono}><Text style={{ color: C.payout }}>■ </Text>Trigger {props.triggerSymbol} {props.triggerMm} mm{toGo != null ? <Text style={{ color: C.rain }}> · {toGo.toFixed(1)} mm to go</Text> : null}</Text> : null}
        <View style={{ marginVertical: S.md - 2 }}><GradientMeter fraction={props.observedMm != null && props.triggerMm ? props.observedMm / props.triggerMm : null} /></View>
        <Text style={j.caption}>{props.observedMm == null ? `Not reported yet · ${props.source}` : `${props.updated ? `Through ${props.updated} · ` : ""}${props.source}`}</Text>
      </View>
    </View>
  </GlassCard>;
}

export function StatPair(props: { leftLabel: string; left: string; leftUnit: string; rightLabel: string; right: string; rightUnit: string }) {
  return <View style={{ flexDirection: "row", gap: S.md }}>
    <GlassCard style={{ flex: 1 }}><Text style={j.overline}>{props.leftLabel}</Text><Text style={j.stat}>{props.left}</Text><Text style={[j.monoSm, { color: C.rain }]}>{props.leftUnit}</Text></GlassCard>
    <GlassCard style={{ flex: 1 }}><Text style={j.overline}>{props.rightLabel}</Text><Text style={j.stat}>{props.right}</Text><Text style={j.caption}>{props.rightUnit}</Text></GlassCard>
  </View>;
}

export function FactRows({ rows, mono = false }: { rows: Array<{ k: string; v: string; tone?: "gold" | "mint" | "rain"; onPress?: () => void }>; mono?: boolean }) {
  return <GlassCard style={{ paddingVertical: S.xs }}>
    {rows.map((r, i) => {
      const col = r.tone === "gold" ? C.payout : r.tone === "mint" ? C.mint : r.tone === "rain" ? C.rain : C.ink;
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
    <GlassCard accent={C.mint}>
      <LivePill label="Trigger hit" tone="live" />
      <View style={[j.rowBetween, { marginTop: S.md, alignItems: "flex-end" }]}>
        <View><Text style={j.overline}>Observed</Text><View style={j.baseline}><CountUp value={props.observedMm} style={j.hero} /><Text style={j.unit}> mm</Text></View></View>
        <View style={{ alignItems: "flex-end" }}><Text style={j.overline}>Trigger</Text><Text style={j.triggerFig}>{props.triggerMm != null ? `${props.triggerMm} mm` : "—"}</Text></View>
      </View>
      <View style={{ marginVertical: S.md }}><GradientMeter fraction={props.observedMm != null ? props.observedMm / max : null} tick={props.triggerMm != null ? props.triggerMm / max : null} height={8} /></View>
      <Text style={j.caption}>{props.source}{props.windowLabel ? ` · ${props.windowLabel}` : ""}</Text>
    </GlassCard>
    <GlassCard style={{ alignItems: "center", paddingVertical: S.xl }}>
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
        const col = r.tone === "gold" ? C.payout : r.tone === "mint" ? C.mint : r.tone === "rain" ? C.rain : C.ink;
        const V = <Text style={[j.factVMono, { color: col }]}>{r.v}</Text>;
        return <View key={r.k} style={j.rRow}><Text style={j.factKMono}>{r.k}</Text>{r.onPress ? <Pressable accessibilityRole="link" onPress={r.onPress} hitSlop={8}>{V}</Pressable> : V}</View>;
      })}
    </GlassCard>
    <Ticker items={props.ticker} />
    <View style={{ marginTop: S.xs }}><ActionButton label="Protect again" onPress={props.onAgain} disabled={props.demo} /></View>
    <View style={{ flexDirection: "row", gap: S.md, marginTop: S.md }}>
      <Pressable accessibilityRole="button" onPress={props.onMarkets} style={j.ghost}><Text style={j.ghostText}>Back to markets</Text></Pressable>
      <Pressable accessibilityRole="link" disabled={!props.signature} onPress={() => { if (props.signature) void Linking.openURL(`https://explorer.solana.com/tx/${encodeURIComponent(props.signature)}?cluster=devnet`); }} style={[j.ghost, !props.signature && { opacity: 0.5 }]}><Text style={[j.ghostText, { color: C.rain }]}>View on explorer ↗</Text></Pressable>
    </View>
  </>;
}

const j = StyleSheet.create({
  perilRow: { flexDirection: "row", gap: S.sm, marginBottom: S.xs },
  peril: { flex: 1, minHeight: 64, borderRadius: 16, borderWidth: 1, borderColor: glass.border, backgroundColor: C.surfaceRaised, alignItems: "center", justifyContent: "center", gap: 3 },
  perilOn: { borderColor: C.rain, backgroundColor: C.rainSoft, boxShadow: `0px 0px 16px ${C.rain}59` },
  perilOff: { opacity: 0.9, borderColor: C.border, backgroundColor: C.surface },
  perilText: { ...T.label, color: C.ink },
  perilSoon: { ...T.overline, color: C.amber, fontSize: 10, lineHeight: 12, letterSpacing: 0.6 },
  top: { marginBottom: S.md },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: MIN_TOUCH - 4, marginBottom: S.xs },
  back: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, justifyContent: "center", marginLeft: -8, paddingLeft: 4 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", boxShadow: `0px 0px 14px ${C.rain}73` },
  brandText: { color: C.ink, fontFamily: F.headingBold, fontSize: 19 },
  eyebrowCaps: { ...T.overline, color: C.quiet, letterSpacing: 1.4 },
  eyebrow: { ...T.label, color: C.muted, fontFamily: F.bodyMedium, marginBottom: 2 },
  title: { ...T.display, color: C.ink },
  lead: { ...T.lead, color: C.muted, marginTop: S.xs },
  devnet: { borderWidth: 1, borderColor: C.amber + "8C", backgroundColor: C.amberSoft, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 5, boxShadow: statusGlow(C.amber) },
  devnetText: { ...T.label, color: C.amber, fontFamily: F.bodyBold, fontSize: 12, lineHeight: 16 },
  demo: { borderWidth: 1, borderStyle: "dashed", borderColor: C.amber, backgroundColor: C.amberSoft, borderRadius: 14, padding: S.md, marginBottom: S.md },
  demoTitle: { color: C.amber, fontFamily: F.mono, fontWeight: "700", fontSize: 13, letterSpacing: 1.5 },
  demoBody: { ...T.caption, color: C.muted, marginTop: S.xs },
  meter: { width: "100%", backgroundColor: C.mutedSurface, overflow: "visible" },
  tick: { position: "absolute", top: -4, bottom: -4, width: 2, marginLeft: -1, backgroundColor: C.ink },
  steps: { flexDirection: "row", gap: S.sm, marginBottom: S.lg },
  stepBar: { height: 4, borderRadius: 2, marginBottom: S.xs },
  stepLabel: { ...T.caption, color: C.quiet, fontFamily: F.bodySemi },
  livePill: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 14, paddingHorizontal: 11, minHeight: 28, alignSelf: "flex-start" },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  livePillText: { ...T.label, fontFamily: F.bodyBold, fontSize: 12, lineHeight: 16 },
  rowCenter: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  baseline: { flexDirection: "row", alignItems: "baseline" },
  overline: { ...T.overline, color: C.quiet, marginBottom: S.xs },
  hero: { ...T.amountXL, fontSize: 52, lineHeight: 60, letterSpacing: -1.5, color: C.ink },
  unit: { ...T.unit, color: C.muted, fontSize: 16 },
  mono: { color: C.ink, fontFamily: F.mono, fontSize: 13 },
  monoSm: { color: C.muted, fontFamily: F.mono, fontSize: 13 },
  caption: { ...T.caption, color: C.quiet },
  stat: { ...T.amountM, fontSize: 36, lineHeight: 44, color: C.ink },
  fact: { minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  factBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: glass.border },
  factK: { ...T.body, color: C.muted },
  factV: { ...T.bodyStrong },
  factKMono: { color: C.quiet, fontFamily: F.mono, fontSize: 13, letterSpacing: 0.8, textTransform: "uppercase" },
  factVMono: { fontFamily: F.mono, fontSize: 14, fontVariant: TAB },
  rRow: { minHeight: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  triggerFig: { ...T.amountS, fontSize: 28, lineHeight: 34, color: C.payout, textShadowColor: C.payout + "73", textShadowRadius: 12 },
  payout: { ...T.amountXL, fontSize: 72, lineHeight: 84, letterSpacing: -2, color: C.mint, textShadowColor: "rgba(52,211,153,0.6)", textShadowRadius: 22 },
  walletChip: { flexDirection: "row", alignItems: "center", marginTop: S.md, paddingHorizontal: S.md, paddingVertical: S.xs, borderRadius: 12, backgroundColor: C.rainSoft },
  check: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.mintSoft, borderWidth: 1, borderColor: C.mint, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: S.md - 2, boxShadow: statusGlow(C.mint) },
  symbol: { color: C.ink, fontFamily: F.mono, fontWeight: "700", fontSize: 15, letterSpacing: 1 },
  receiptBig: { ...T.amountXL, fontSize: 64, lineHeight: 76, letterSpacing: -2, marginTop: S.xs, color: C.mint, textShadowColor: "rgba(52,211,153,0.55)", textShadowRadius: 20 },
  ghost: { flex: 1, minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: glass.border, backgroundColor: C.surfaceRaised, alignItems: "center", justifyContent: "center" },
  ghostText: { ...T.label, fontSize: 15, lineHeight: 20, color: C.ink },
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
  return <View style={{ marginBottom: S.md }}>
    <Text style={j.overline}>Choose a peril</Text>
    <View style={j.perilRow} accessibilityRole="radiogroup" accessibilityLabel="Weather peril">
      {PERILS.map((p) => {
        const ok = available.includes(p.id);
        const on = ok && p.id === value;
        return <Pressable key={p.id} disabled={!ok} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: !ok }} accessibilityLabel={ok ? p.label : `${p.label}, coming soon`} onPress={() => onChange?.(p.id)} style={[j.peril, on && j.perilOn, !ok && j.perilOff]}>
          <AppIcon name={p.icon} color={on ? C.rain : ok ? C.ink : C.quiet} size={18} />
          <Text style={[j.perilText, on && { color: C.rain }, !ok && { color: C.quiet }]}>{p.label}</Text>
          {!ok ? <Text style={j.perilSoon}>soon</Text> : null}
        </Pressable>;
      })}
    </View>
    {available.length ? <Text style={j.caption}>Wind, snow and heat are coming soon — no prices or triggers exist for them yet.</Text> : <Text style={j.caption}>No peril is open here yet — every peril is coming soon.</Text>}
  </View>;
}
