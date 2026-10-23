import React, { useEffect, useRef, useState } from "react";
import { COVER_CHIPS, HOW_IT_SETTLES, HOW_IT_SETTLES_TITLE, HOW_IT_WORKS, LANDING_FINE, LANDING_HERO_LEAD, LANDING_HERO_TITLE, LANDING_OPEN_APP, type CoverChip } from "../../shared/protect-copy.ts";
import { payGet } from "../../shared/pay-get.ts";
import { RainGauge as Tube } from "./rain-gauge";
import { Animated, Easing, Linking, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { C, F, glass, MIN_TOUCH, motion, space as S, type as T } from "./theme";
import { Enter, SpringPress } from "./motion";
import { ActionButton, AppIcon, Text } from "./ui";
import { useReducedMotion } from "./liquid-glass";
import { PerilSelector, ScreenTop } from "./journey";
import { groupCounts, type CatalogMarket } from "./markets-catalog";
import { marketListChipTone } from "./presentation";

const TAB = ["tabular-nums" as const];

/** Flat surface card. The name stays so existing screens keep one pane. */
export function GlassCard({ children, style, delay }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; accent?: string; delay?: number }) {
  const reduced = useReducedMotion();
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { enter.setValue(1); return; }
    Animated.timing(enter, { toValue: 1, duration: reduced ? 120 : 120, delay: delay ?? 0, easing: Easing.linear, useNativeDriver: true }).start();
  }, [enter, reduced, delay]);
  return <Animated.View style={[g.card, style, { opacity: enter }]}>{children}</Animated.View>;
}

export function StatusTag({ status, label }: { status: CatalogMarket["status"]; label?: string }) {
  const tone = marketListChipTone(status, label);
  const col = tone === "live" ? C.rain : C.dryText;
  return <View accessible accessibilityLabel={label ?? statusLabel(status)}>
    <Text style={[g.tagText, { color: col }]}>{label ?? statusLabel(status)}</Text>
  </View>;
}
export const statusLabel = (s: CatalogMarket["status"]) => (s === "live" ? "Live" : s === "ready" ? "Ready to open" : s === "soon" ? "Opens soon" : "Concept");

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
      <View style={[StyleSheet.absoluteFill, { backgroundColor: color }]} />
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
export function Landing(props: { onConnect: () => void; onBrowse: () => void; busy: boolean; live: boolean; openLabel?: string; quote?: { premiumRateBps: number; probabilityBps: number; triggerMm: number } | null }) {
  const [cover, setCover] = useState<CoverChip>(100);
  const reduced = useReducedMotion();
  const deal = props.quote ? payGet({ coverageSkyt: cover, premiumRateBps: props.quote.premiumRateBps, probabilityBps: props.quote.probabilityBps }) : null;
  const trigger = props.quote?.triggerMm ?? null;
  const fade = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { fade.setValue(1); return; }
    Animated.timing(fade, { toValue: 1, duration: motion.slow + 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [fade, reduced]);
  return <Animated.View style={{ opacity: fade }}>
    <ScreenTop brand />
    <Text style={g.hero}>{LANDING_HERO_TITLE}</Text>
    <Text style={g.heroLead}>{LANDING_HERO_LEAD}</Text>
    {trigger != null && deal ? <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: S.lg }}>
      <Tube width={120} height={168} level={0} maxMm={trigger * 1.25} showMm ticks={[{ mm: trigger, selected: true }]} label={`New York trigger line at ${trigger} mm`} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {COVER_CHIPS.map((chip) => <Pressable key={chip} accessibilityRole="radio" accessibilityState={{ selected: chip === cover }} onPress={() => setCover(chip)} style={{ minHeight: MIN_TOUCH, flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: chip === cover ? C.rainSoft : C.surfaceRaised, borderWidth: chip === cover ? 1.5 : 0, borderColor: C.rain }}>
            <Text style={{ color: C.ink, fontFamily: F.bodySemi }}>{chip}</Text>
          </Pressable>)}
        </View>
        <Text style={g.caption}>You pay <Text style={{ fontFamily: F.mono, color: C.ink }}>{deal.payLabel.split(".")[0]}</Text><Text style={{ fontFamily: F.mono, color: C.muted }}>{deal.payLabel.includes(".") ? `.${deal.payLabel.split(".")[1]} SKYT` : " SKYT"}</Text></Text>
        <Text style={g.caption}>You get <Text style={{ fontFamily: F.mono, fontSize: 32, lineHeight: 36, color: C.payout }}>{deal.getLabel}</Text><Text style={{ fontFamily: F.mono, color: C.muted }}> SKYT</Text></Text>
      </View>
    </View> : null}
    <GlassCard style={{ marginTop: S.xl }}>
      <Text style={g.body}>How it works</Text>
      {HOW_IT_WORKS.map((title) => <Text key={title} style={[g.caption, { marginTop: S.sm }]}>{title}</Text>)}
    </GlassCard>
    <GlassCard>
      <Text style={g.overline}>{HOW_IT_SETTLES_TITLE}</Text>
      <Text style={g.caption}>{HOW_IT_SETTLES}</Text>
    </GlassCard>
    <GlassCard>
      <View style={g.marketLine}>
        <Text style={g.marketName} android_hyphenationFrequency="none">New York</Text>
        <StatusTag status={props.live ? "live" : "soon"} label={props.live ? "Open" : "Not open yet"} />
      </View>
    </GlassCard>
    <Text style={[g.caption, { textAlign: "center" }]}>{LANDING_FINE}</Text>
    <View style={{ marginTop: S.xl }}><ActionButton label={LANDING_OPEN_APP} icon="arrow-right" busy={props.busy} onPress={props.onBrowse} /></View>
    <SpringPress accessibilityRole="button" onPress={props.onConnect} style={g.linkBtn}><Text style={g.link}>Connect wallet</Text></SpringPress>
  </Animated.View>;
}

/* ───────────── Toronto / concept detail ───────────── */
export function MarketDetail(props: { market: CatalogMarket; onBack: () => void; onExploreLive: () => void; notified: boolean; onNotify: () => void }) {
  const m = props.market;
  const soon = m.status === "soon";
  const ready = m.status === "ready";
  const liveCity = m.status === "live";
  const col = soon ? C.amber : C.rain;
  return <>
    <ScreenTop onBack={props.onBack} />
    <View style={g.detailHead}>
      <View style={[g.shield, { borderColor: col + "66" }]}><AppIcon name="umbrella" color={col} size={20} /></View>
      <View style={{ flex: 1 }}><Text style={g.caption}>{m.source} · {m.station ? m.station.replace("GHCND:", "") : `${m.code} station`}</Text><Text style={g.detailTitle}>{m.name}</Text><Text style={g.caption}>{m.region} · {m.lat.toFixed(2)}°, {m.lon.toFixed(2)}°</Text></View>
    </View>
    <PerilSelector value="rain" available={[]} />
    <Text style={[g.caption, { marginTop: -4, marginBottom: 8 }]}>{m.country} · {m.group}</Text>
    <GlassCard accent={col}>
      <View style={g.rowBetween}><StatusTag status={m.status} label={soon ? "Opens soon" : liveCity ? "Next window opening shortly" : ready ? "Ready to open" : "Concept market"} /></View>
      <View style={{ flexDirection: "row", gap: 16, marginTop: 14 }}>
        <RainGauge observedMm={null} triggerMm={null} color={col} height={130} />
        <View style={{ flex: 1 }}>
          <Text style={g.overline}>Trigger</Text>
          <Text style={[g.big, { color: col }]}>{soon ? "Set per window" : "Not yet defined"}</Text>
          <Text style={g.caption}>{soon ? "Windows, triggers and prices are published when the market opens." : liveCity ? "Payout follows that window's NOAA rainfall threshold. No price until the window is open." : ready ? "NOAA rain data is wired in. No Devnet market exists yet, so there is no window, trigger or price." : "Concept only — no window, trigger or price exists yet."}</Text>
          <View style={g.hr} />
          <Text style={g.overline}>Weather data</Text>
          <Text style={g.body}>{m.source}</Text>
          <Text style={g.caption}>{m.station ? `GHCND ${m.station.replace("GHCND:", "")}` : `${m.name} station`}</Text>
        </View>
      </View>
    </GlassCard>
    <GlassCard>
      <Text style={g.overline}>How payout works</Text>
      {[["Pick a window", "Choose the days you want covered."], ["Weather is measured", `${m.source} data at ${m.code}.`], ["Payout settles automatically", "If the trigger is hit, it goes to your wallet. No claims forms."]].map(([t, d], i) => <View key={t} style={g.how}>
        <View style={g.howN}><Text style={g.howNText}>{i + 1}</Text></View><View style={{ flex: 1 }}><Text style={g.body}>{t}</Text><Text style={g.caption}>{d}</Text></View>
      </View>)}
    </GlassCard>
    {soon || ready ? <Pressable accessibilityRole="button" accessibilityLabel={props.notified ? `Interest saved for ${m.name}. Tap to undo.` : `Notify me when ${m.name} opens`} accessibilityState={{ checked: props.notified }} onPress={props.onNotify} style={[g.notify, props.notified && g.notifyOn]}>
      <AppIcon name={props.notified ? "check" : "bell"} color={props.notified ? C.amber : C.actionText} size={18} />
      <Text style={[g.notifyText, props.notified && { color: C.amber }]}>{props.notified ? "Interest saved on this phone" : "Notify me when it opens"}</Text>
    </Pressable> : null}
    {(soon || ready) && props.notified ? <Text style={[g.caption, { textAlign: "center", marginTop: 6 }]}>Kept in the app on this device only. No notification is scheduled yet and nothing was sent.</Text> : null}
    <Pressable accessibilityRole="button" onPress={props.onExploreLive} style={g.secondary}><View style={[g.tagDot, { backgroundColor: C.mint }]} /><Text style={g.secondaryText}>See New York</Text></Pressable>
    <Text style={[g.caption, { textAlign: "center", marginTop: 8 }]}>{soon ? "Concept preview · not yet open" : ready ? "Ready to open · not tradable yet" : "Concept market · not tradable"}</Text>
  </>;
}

/* ───────────── Global list ───────────── */
export function GlobalGroups({ onPick }: { onPick: (group: CatalogMarket["group"]) => void }) {
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
  const reducedPop = useReducedMotion();
  useEffect(() => { if (reducedPop) { pop.setValue(1); return; } Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start(); }, [pop, reducedPop]);
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
  testNote: { flexDirection: "row", gap: 8, borderWidth: 1, borderStyle: "dashed", borderColor: C.amber, borderRadius: 14, padding: S.md, marginTop: S.lg },
  testNoteText: { ...T.label, fontFamily: F.body, flex: 1, color: C.amber },
  card: { backgroundColor: C.surface, borderWidth: 0, borderRadius: 14, padding: S.lg, marginBottom: S.lg, overflow: "hidden" },
  cardEdge: { position: "absolute", top: 0, left: 24, right: 24, height: 1 },
  tag: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, borderWidth: 1, borderRadius: 14, paddingHorizontal: 11, minHeight: 28 },
  tagDot: { width: 7, height: 7, borderRadius: 4 },
  tagText: { fontFamily: F.bodyBold, fontSize: 12, letterSpacing: 0.3 },
  gauge: { width: 52, borderRadius: 16, borderWidth: 1.5, borderColor: C.tick, backgroundColor: C.dryFill, overflow: "hidden", justifyContent: "flex-end" },
  gaugeFill: { width: "100%", overflow: "hidden" },
  gaugeLine: { position: "absolute", left: -2, right: -2, flexDirection: "row", justifyContent: "space-between" },
  gaugeDash: { width: 4, height: 2, backgroundColor: C.payout },
  ticker: { overflow: "hidden", borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, paddingVertical: 8, marginVertical: 12 },
  tickerRow: { flexDirection: "row" },
  tickerText: { ...T.unit, fontSize: 12, color: C.muted },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 22 },
  brandMark: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.rainSoft, alignItems: "center", justifyContent: "center" },
  brandText: { flex: 1, color: C.ink, fontFamily: F.headingBold, fontSize: 18 },
  devnet: { borderWidth: 1, borderColor: C.amber + "66", backgroundColor: C.amberSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  devnetText: { color: C.amber, fontFamily: F.bodySemi, fontSize: 12 },
  hero: { ...T.hero, color: C.ink, marginTop: S.xs },
  heroLead: { ...T.lead, color: C.muted, marginTop: S.md },
  marketLine: { alignItems: "flex-start", gap: 8 },
  marketName: { ...T.bodyStrong, color: C.ink, alignSelf: "stretch" },
  steps: { flexDirection: "row", gap: 8 },
  step: { flex: 1, padding: 12 },
  stepN: { color: C.rain, fontFamily: F.mono, fontSize: 13, fontWeight: "700" },
  stepT: { color: C.ink, fontFamily: F.bodyBold, fontSize: 15, marginTop: 4 },
  linkBtn: { minHeight: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
  link: { ...T.label, fontSize: 14, lineHeight: 20, color: C.rain },
  caption: { ...T.caption, color: C.quiet },
  body: { ...T.bodyStrong, color: C.ink },
  overline: { ...T.overline, color: C.quiet, marginBottom: S.sm },
  big: { ...T.title },
  hr: { height: 1, backgroundColor: C.border, marginVertical: S.md },
  back: { minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 2 },
  detailHead: { flexDirection: "row", gap: S.md, alignItems: "center", marginBottom: S.lg },
  shield: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  detailTitle: { ...T.display, fontSize: 30, lineHeight: 36, color: C.ink },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  how: { flexDirection: "row", gap: S.md, alignItems: "flex-start", paddingVertical: S.sm },
  howN: { width: 24, height: 24, marginTop: -1, borderRadius: 8, backgroundColor: C.rainSoft, alignItems: "center", justifyContent: "center" },
  howNText: { color: C.rain, fontFamily: F.mono, fontSize: 13, lineHeight: 16, fontWeight: "700", fontVariant: TAB, textAlign: "center" },
  notify: { minHeight: 58, borderRadius: 16, backgroundColor: C.amber, boxShadow: `0px 6px 24px ${C.amber}73`, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  notifyOn: { backgroundColor: C.amberSoft, borderWidth: 1, borderColor: C.amber },
  notifyText: { color: C.actionText, fontFamily: F.bodyBold, fontSize: 16 },
  secondary: { minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: glass.border, backgroundColor: C.surfaceRaised, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 },
  secondaryText: { ...T.label, fontSize: 14, lineHeight: 20, color: C.ink },
  groupRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12 },
  groupBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  groupN: { ...T.amountS, color: C.rain, fontVariant: TAB, textShadowColor: C.rain + "80", textShadowRadius: 10 },
  check: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.mintSoft, borderWidth: 1, borderColor: C.mint, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 10 },
  receiptBig: { ...T.amountXL, fontSize: 50, lineHeight: 60, color: C.mint, textShadowColor: "rgba(52,211,153,0.55)", textShadowRadius: 18, textAlign: "center", fontVariant: TAB, letterSpacing: -1 },
  fact: { flexDirection: "row", justifyContent: "space-between", minHeight: 40, alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  factV: { ...T.unit, color: C.ink, fontVariant: TAB },
});
