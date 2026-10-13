import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Linking, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, F, MIN_TOUCH } from "./theme";
import { ActionButton, AppIcon, Text } from "./ui";
import { useReducedMotion } from "./liquid-glass";
import { groupCounts, MARKETS, type CatalogMarket } from "./markets-catalog";

const TAB = ["tabular-nums" as const];

/** Frosted glass card: translucent graphite, hairline glacier border, soft top sheen. */
export function GlassCard({ children, style, accent }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; accent?: string }) {
  return <View style={[g.card, accent ? { borderColor: accent + "55" } : null, style]}>
    <LinearGradient pointerEvents="none" colors={["rgba(255,255,255,0.06)", "rgba(255,255,255,0)"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.6 }} style={StyleSheet.absoluteFill} />
    {children}
  </View>;
}

export function StatusTag({ status, label }: { status: CatalogMarket["status"]; label?: string }) {
  const col = status === "live" ? C.mint : status === "soon" ? C.amber : C.rain;
  return <View style={[g.tag, { borderColor: col + "66", backgroundColor: col + "1A" }]} accessible accessibilityLabel={label ?? statusLabel(status)}>
    {status !== "concept" ? <View style={[g.tagDot, { backgroundColor: col }]} /> : <View style={[g.tagDot, { borderWidth: 1.5, borderColor: col }]} />}
    <Text style={[g.tagText, { color: col }]}>{label ?? statusLabel(status)}</Text>
  </View>;
}
export const statusLabel = (s: CatalogMarket["status"]) => (s === "live" ? "Live" : s === "soon" ? "Opens soon" : "Concept");

/** Animates a real number up from zero. Renders "—" when the value is unknown. */
export function CountUp({ value, decimals = 1, style }: { value: number | null; decimals?: number; style?: any }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(value == null ? null : reduced ? value : 0);
  useEffect(() => {
    if (value == null) { setShown(null); return; }
    if (reduced) { setShown(value); return; }
    const id = v.addListener(({ value: x }) => setShown(x));
    v.setValue(0);
    Animated.timing(v, { toValue: value, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, [value, reduced, v]);
  return <Text style={[{ fontVariant: TAB }, style]}>{shown == null ? "—" : shown.toFixed(decimals)}</Text>;
}

/** Vertical gauge: fills to observed rain; dashed line marks the trigger. Empty (no fill) when rain is unknown. */
export function RainGauge({ observedMm, triggerMm, color = C.rain, height = 150 }: { observedMm: number | null; triggerMm: number | null; color?: string; height?: number }) {
  const reduced = useReducedMotion();
  const fill = useRef(new Animated.Value(0)).current;
  const max = Math.max(1, (triggerMm ?? 0) * 1.4, (observedMm ?? 0) * 1.1);
  const target = observedMm == null ? 0 : Math.min(1, observedMm / max);
  useEffect(() => {
    if (reduced) { fill.setValue(target); return; }
    Animated.timing(fill, { toValue: target, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [target, reduced, fill]);
  const h = fill.interpolate({ inputRange: [0, 1], outputRange: [0, height] });
  return <View style={[g.gauge, { height }]} accessible accessibilityLabel={`Rain gauge: ${observedMm == null ? "no observed rain yet" : `${observedMm.toFixed(1)} mm observed`}${triggerMm != null ? `, trigger ${triggerMm} mm` : ""}`}>
    <Animated.View style={[g.gaugeFill, { height: h }]}>
      <LinearGradient colors={[color, color + "55"]} style={StyleSheet.absoluteFill} />
    </Animated.View>
    {triggerMm != null ? <View style={[g.gaugeLine, { bottom: (triggerMm / max) * height }]}>{Array.from({ length: 8 }).map((_, i) => <View key={i} style={g.gaugeDash} />)}</View> : null}
  </View>;
}

/** Horizontally scrolling strip of verified facts (no invented values). */
export function Ticker({ items }: { items: string[] }) {
  const reduced = useReducedMotion();
  const x = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  useEffect(() => {
    if (reduced || !w) return;
    const a = Animated.loop(Animated.timing(x, { toValue: -w, duration: w * 28, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
    a.start();
    return () => a.stop();
  }, [w, reduced, x]);
  const row = (k: string) => <View key={k} style={g.tickerRow} onLayout={k === "a" ? (e) => setW(e.nativeEvent.layout.width) : undefined}>
    {items.map((t, i) => <Text key={i} style={g.tickerText}>{t}<Text style={{ color: C.border }}>   ◆   </Text></Text>)}
  </View>;
  return <View style={g.ticker} accessible accessibilityLabel={items.join(". ")}>
    <Animated.View style={{ flexDirection: "row", transform: [{ translateX: x }] }}>{row("a")}{row("b")}</Animated.View>
  </View>;
}

/* ───────────── Landing ───────────── */
export function Landing(props: { onConnect: () => void; onBrowse: () => void; busy: boolean; live: boolean }) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start(); }, [fade]);
  const concepts = MARKETS.filter((m) => m.status === "concept").length;
  return <Animated.View style={{ opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
    <View style={g.brandRow}><View style={g.brandMark}><AppIcon name="cloud-drizzle" color={C.rain} size={20} /></View><Text style={g.brandText}>SkyHedge</Text><View style={g.devnet}><Text style={g.devnetText}>Devnet · test token</Text></View></View>
    <Text style={g.hero}>Rain protection{"\n"}<Text style={{ color: C.rain }}>that pays itself.</Text></Text>
    <Text style={g.heroLead}>Pick a covered window. If verified station data shows rain hit the trigger, your payout settles automatically. No claims forms.</Text>
    <GlassCard style={{ marginTop: 18 }}>
      <View style={g.marketLine}><View style={[g.tagDot, { backgroundColor: C.mint }]} /><Text style={g.marketName}>Des Moines, IA</Text><StatusTag status={props.live ? "live" : "soon"} label={props.live ? "Live" : "Not selling now"} /></View>
      <View style={g.marketLine}><View style={[g.tagDot, { backgroundColor: C.amber }]} /><Text style={g.marketName}>Toronto Pearson</Text><StatusTag status="soon" /></View>
      <Text style={g.caption}>+{concepts} concept markets across 6 regions</Text>
    </GlassCard>
    <View style={g.steps}>
      {[["01", "Pick a zone", "NOAA station"], ["02", "Set trigger", "mm of rain"], ["03", "Auto payout", "to your wallet"]].map(([n, t, d]) => <GlassCard key={n} style={g.step}>
        <Text style={g.stepN}>{n}</Text><Text style={g.stepT}>{t}</Text><Text style={g.caption}>{d}</Text>
      </GlassCard>)}
    </View>
    <View style={{ marginTop: 18 }}><ActionButton label="Connect wallet" icon="credit-card" busy={props.busy} onPress={props.onConnect} /></View>
    <Pressable accessibilityRole="button" onPress={props.onBrowse} style={g.linkBtn}><Text style={g.link}>Browse markets first →</Text></Pressable>
  </Animated.View>;
}

/* ───────────── Toronto / concept detail ───────────── */
export function MarketDetail(props: { market: CatalogMarket; onBack: () => void; onExploreLive: () => void; notified: boolean; onNotify: () => void }) {
  const m = props.market;
  const soon = m.status === "soon";
  const col = soon ? C.amber : C.rain;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to markets" onPress={props.onBack} style={g.back}><AppIcon name="chevron-left" color={C.rain} size={22} /><Text style={g.link}>Markets</Text></Pressable>
    <View style={g.detailHead}>
      <View style={[g.shield, { borderColor: col + "66" }]}><AppIcon name="umbrella" color={col} size={20} /></View>
      <View style={{ flex: 1 }}><Text style={g.caption}>{m.source} · {m.code} station</Text><Text style={g.detailTitle}>{m.name}</Text><Text style={g.caption}>{m.region} · {m.lat.toFixed(2)}°, {m.lon.toFixed(2)}°</Text></View>
    </View>
    <GlassCard accent={col}>
      <View style={g.rowBetween}><StatusTag status={m.status} label={soon ? "Coming soon" : "Concept market"} /></View>
      <View style={{ flexDirection: "row", gap: 16, marginTop: 14 }}>
        <RainGauge observedMm={null} triggerMm={null} color={col} height={130} />
        <View style={{ flex: 1 }}>
          <Text style={g.overline}>Trigger</Text>
          <Text style={[g.big, { color: col }]}>{soon ? "Set per window" : "Not yet defined"}</Text>
          <Text style={g.caption}>{soon ? "Windows, triggers and prices are published when the market opens." : "Concept only — no window, trigger or price exists yet."}</Text>
          <View style={g.hr} />
          <Text style={g.overline}>Rain data</Text>
          <Text style={g.body}>{m.source}</Text>
          <Text style={g.caption}>{m.name} station</Text>
        </View>
      </View>
    </GlassCard>
    <GlassCard>
      <Text style={g.overline}>How payout works</Text>
      {[["Pick a window", "Choose the days you want covered."], ["Rain is measured", `${m.source} data at ${m.code}.`], ["Payout settles automatically", "If the trigger is hit, it goes to your wallet. No claims forms."]].map(([t, d], i) => <View key={t} style={g.how}>
        <View style={g.howN}><Text style={g.howNText}>{i + 1}</Text></View><View style={{ flex: 1 }}><Text style={g.body}>{t}</Text><Text style={g.caption}>{d}</Text></View>
      </View>)}
    </GlassCard>
    {soon ? <Pressable accessibilityRole="button" accessibilityState={{ checked: props.notified }} onPress={props.onNotify} style={[g.notify, props.notified && g.notifyOn]}>
      <AppIcon name={props.notified ? "check" : "bell"} color={props.notified ? C.amber : "#1A1205"} size={18} />
      <Text style={[g.notifyText, props.notified && { color: C.amber }]}>{props.notified ? "We’ll remind you on this phone" : "Notify me when it opens"}</Text>
    </Pressable> : null}
    {soon && props.notified ? <Text style={[g.caption, { textAlign: "center", marginTop: 6 }]}>Saved on this device only — nothing was sent anywhere.</Text> : null}
    <Pressable accessibilityRole="button" onPress={props.onExploreLive} style={g.secondary}><View style={[g.tagDot, { backgroundColor: C.mint }]} /><Text style={g.secondaryText}>Explore Des Moines (live)</Text></Pressable>
    <Text style={[g.caption, { textAlign: "center", marginTop: 8 }]}>{soon ? "Concept preview · not yet open" : "Concept market · not tradable"}</Text>
  </>;
}

/* ───────────── Global list ───────────── */
export function GlobalGroups({ onPick }: { onPick: (group: string) => void }) {
  return <GlassCard style={{ paddingVertical: 6 }}>
    {groupCounts().map((gc, i) => <Pressable key={gc.group} accessibilityRole="button" onPress={() => onPick(gc.group)} style={[g.groupRow, i > 0 && g.groupBorder]}>
      <View style={{ flex: 1 }}><Text style={g.body}>{gc.group}</Text><Text style={g.caption} numberOfLines={1}>{gc.sources.join(" · ")}</Text></View>
      <Text style={g.groupN}>{gc.count}</Text>
    </Pressable>)}
  </GlassCard>;
}

/* ───────────── Receipt ───────────── */
export function Receipt(props: { title: string; amountLabel: string | null; facts: Array<[string, string]>; ticker: string[]; signature: string; onAgain: () => void; onMarkets: () => void }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start(); }, [pop]);
  return <GlassCard accent={C.mint}>
    <Animated.View style={[g.check, { transform: [{ scale: pop }] }]}><AppIcon name="check" color={C.mint} size={26} /></Animated.View>
    <Text style={[g.overline, { textAlign: "center" }]}>{props.title}</Text>
    {props.amountLabel ? <Text style={g.receiptBig}>{props.amountLabel}</Text> : null}
    <Ticker items={props.ticker} />
    {props.facts.map(([k, v]) => <View key={k} style={g.fact}><Text style={g.caption}>{k}</Text><Text style={g.factV}>{v}</Text></View>)}
    <View style={{ marginTop: 12 }}><ActionButton label="Protect again" icon="shield" onPress={props.onAgain} /></View>
    <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
      <Pressable accessibilityRole="button" onPress={props.onMarkets} style={[g.secondary, { flex: 1, marginTop: 0 }]}><Text style={g.secondaryText}>Back to markets</Text></Pressable>
      <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(`https://explorer.solana.com/tx/${encodeURIComponent(props.signature)}?cluster=devnet`); }} style={[g.secondary, { flex: 1, marginTop: 0 }]}><Text style={[g.secondaryText, { color: C.rain }]}>View on explorer ↗</Text></Pressable>
    </View>
  </GlassCard>;
}

const g = StyleSheet.create({
  card: { backgroundColor: "rgba(17,22,29,0.78)", borderColor: "rgba(94,200,255,0.14)", borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 12, overflow: "hidden" },
  tag: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, minHeight: 26, alignSelf: "flex-start" },
  tagDot: { width: 7, height: 7, borderRadius: 4 },
  tagText: { fontFamily: F.bodySemi, fontSize: 12 },
  gauge: { width: 44, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: "#0B0F14", overflow: "hidden", justifyContent: "flex-end" },
  gaugeFill: { width: "100%", overflow: "hidden" },
  gaugeLine: { position: "absolute", left: -2, right: -2, flexDirection: "row", justifyContent: "space-between" },
  gaugeDash: { width: 4, height: 2, backgroundColor: C.payout },
  ticker: { overflow: "hidden", borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, paddingVertical: 8, marginVertical: 12 },
  tickerRow: { flexDirection: "row" },
  tickerText: { color: C.muted, fontFamily: F.mono, fontSize: 12 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 22 },
  brandMark: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(94,200,255,0.12)", alignItems: "center", justifyContent: "center" },
  brandText: { flex: 1, color: C.ink, fontFamily: F.headingBold, fontSize: 18 },
  devnet: { borderWidth: 1, borderColor: C.amber + "66", backgroundColor: C.amberSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  devnetText: { color: C.amber, fontFamily: F.bodySemi, fontSize: 11 },
  hero: { color: C.ink, fontFamily: F.headingBold, fontSize: 36, lineHeight: 42, letterSpacing: -1 },
  heroLead: { color: C.muted, fontFamily: F.body, fontSize: 15, lineHeight: 22, marginTop: 10 },
  marketLine: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40 },
  marketName: { flex: 1, color: C.ink, fontFamily: F.bodySemi, fontSize: 15 },
  steps: { flexDirection: "row", gap: 8 },
  step: { flex: 1, padding: 12 },
  stepN: { color: C.rain, fontFamily: F.mono, fontSize: 12 },
  stepT: { color: C.ink, fontFamily: F.bodySemi, fontSize: 13, marginTop: 4 },
  linkBtn: { minHeight: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
  link: { color: C.rain, fontFamily: F.bodySemi, fontSize: 14 },
  caption: { color: C.quiet, fontFamily: F.body, fontSize: 12, lineHeight: 18 },
  body: { color: C.ink, fontFamily: F.bodySemi, fontSize: 15, lineHeight: 21 },
  overline: { color: C.quiet, fontFamily: F.bodySemi, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  big: { fontFamily: F.headingBold, fontSize: 22, lineHeight: 28 },
  hr: { height: 1, backgroundColor: C.border, marginVertical: 12 },
  back: { minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 2 },
  detailHead: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 14 },
  shield: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  detailTitle: { color: C.ink, fontFamily: F.headingBold, fontSize: 26, letterSpacing: -0.6 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  how: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 8 },
  howN: { width: 26, height: 26, borderRadius: 8, backgroundColor: C.rainSoft, alignItems: "center", justifyContent: "center" },
  howNText: { color: C.rain, fontFamily: F.mono, fontSize: 12 },
  notify: { minHeight: 56, borderRadius: 16, backgroundColor: C.amber, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  notifyOn: { backgroundColor: C.amberSoft, borderWidth: 1, borderColor: C.amber },
  notifyText: { color: "#1A1205", fontFamily: F.bodyBold, fontSize: 16 },
  secondary: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 },
  secondaryText: { color: C.ink, fontFamily: F.bodySemi, fontSize: 14 },
  groupRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12 },
  groupBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  groupN: { color: C.rain, fontFamily: F.headingBold, fontSize: 20, fontVariant: TAB },
  check: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.mintSoft, borderWidth: 1, borderColor: C.mint, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 10 },
  receiptBig: { color: C.mint, fontFamily: F.headingBold, fontSize: 44, lineHeight: 52, textAlign: "center", fontVariant: TAB, letterSpacing: -1 },
  fact: { flexDirection: "row", justifyContent: "space-between", minHeight: 34, alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  factV: { color: C.ink, fontFamily: F.mono, fontSize: 13 },
});
