import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { WindowEvidencePackage } from "../../shared/window-chain.ts";
import {
  expiryChipCopy,
  matchingWindowPackage,
  pricedTriggers,
  sortByExpiry,
  triggerRows,
} from "../../shared/window-chain.ts";
import { gaugeMarkPlan, gaugeStateLine, ladderTicks, moreTriggersSoon, MARKETS_FOOTER } from "../../shared/protect-copy.ts";
import { coverageChipOn, gaugeMode, gaugeReading, type ProtectSurface } from "../../shared/protect-surface.ts";
import { windowStartLabel } from "../../shared/window-chain.ts";
import { RainGauge } from "./rain-gauge";
import { useReducedMotion } from "./liquid-glass";
import { C, MIN_TOUCH, space as S, type as T } from "./theme";
import { Text } from "./ui";
import type { SellingWindow } from "./windows";

export function ProtectChain(props: {
  city: string;
  windows: readonly SellingWindow[];
  selectedAddress: string | null;
  nowSeconds: number;
  evidence: readonly WindowEvidencePackage[] | null;
  evidenceLoading: boolean;
  onSelectWindow: (address: string) => void;
  cities?: readonly { slug: string; label: string }[];
  onCity?: (slug: string) => void;
  amounts?: readonly { id: string; label: string; onPress: () => void }[];
  selectedAmountId?: string | null;
  surface: ProtectSurface;
  nextOpenCopy: string | null;
  openCity: { slug: string; label: string } | null;
  onRefresh: () => void;
}) {
  const [triggerMm, setTriggerMm] = useState<number | null>(null);
  const windows = sortByExpiry(props.windows);
  const selected = windows.find((window) => window.address === props.selectedAddress) ?? windows[0] ?? null;
  const pkg = selected ? matchingWindowPackage(props.evidence, props.city, selected.observationStart, selected.observationEnd) : null;
  const onChainMm = selected?.thresholdMmX100 && /^\d+$/.test(selected.thresholdMmX100) ? Number(selected.thresholdMmX100) / 100 : null;
  const rows = pkg ? triggerRows({
    totalsMm: pkg.analogueTotalsMm,
    forecastCumulativeMm: pkg.forecastCumulativeMm,
    onChainThresholdMm: onChainMm,
    onChainProbabilityBps: selected?.quoteProbabilityBps ?? null,
    onChainPremiumRateBps: selected?.premiumRateBps ?? null,
  }) : [];
  const ladder = pricedTriggers(rows);
  const chosen = ladder.priced.find((row) => row.thresholdMm === triggerMm) ?? ladder.priced[0] ?? null;
  const ticks = ladderTicks(rows, chosen?.thresholdMm ?? null);
  const reading = gaugeReading({ forecastMm: pkg?.forecastCumulativeMm, observationStart: selected?.observationStart, nowSeconds: props.nowSeconds, startLabel: selected ? windowStartLabel(selected) : null });
  // Water and ticks share one scale, with headroom above the highest line.
  const gaugeMax = Math.max(1, reading.levelMm, ...ticks.map((tick) => tick.thresholdMm)) * 1.2;
  const priced = ladder.priced.length > 0 && props.surface === "ready";
  const mode = gaugeMode({ surface: props.surface, evidenceLoading: props.evidenceLoading, pricedRowCount: ladder.priced.length });

  return <View>
    {props.cities?.length ? <View style={styles.chipWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll} style={styles.chipScroller} accessibilityRole="radiogroup" accessibilityLabel="City">
        {props.cities.map((city) => {
          const on = city.slug === props.city;
          return <Pressable key={city.slug} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => props.onCity?.(city.slug)} style={[styles.chip, on && styles.chipOn]}>
            <Text numberOfLines={1} style={[styles.chipLabel, on && styles.chipLabelOn]}>{city.label}</Text>
          </Pressable>;
        })}
      </ScrollView>
    </View> : null}
    {windows.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll} style={styles.chipScroller} accessibilityRole="radiogroup" accessibilityLabel="Expiry">
      {windows.map((window) => {
        const on = window.address === selected?.address;
        const label = expiryChipCopy(window, props.nowSeconds) ?? "Expiry";
        return <Pressable key={window.address} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={() => props.onSelectWindow(window.address)} style={[styles.chip, on && styles.chipOn]}>
          <Text numberOfLines={1} android_hyphenationFrequency="none" style={[styles.chipLabel, on && styles.chipLabelOn]}>{label}</Text>
        </Pressable>;
      })}
    </ScrollView> : null}
    {priced && props.amounts?.length ? <View accessibilityRole="radiogroup" accessibilityLabel="Coverage amount in SKYT" style={styles.amounts}>
      {props.amounts.map((amount) => {
        const on = coverageChipOn(priced, amount.id, props.selectedAmountId ?? null);
        return <Pressable key={amount.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={amount.onPress} style={[styles.chip, on && styles.chipOn]}>
          <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{amount.label}</Text>
        </Pressable>;
      })}
    </View> : null}
    {mode === "skeleton" ? <GaugeSkeleton /> : null}
    {mode === "gauge" ? <View style={{ flexDirection: "row", alignItems: "flex-end", gap: S.sm, marginTop: S.sm }}>
      <View style={{ alignItems: "center" }}>
        <RainGauge showMm width={172} height={220} maxMm={gaugeMax} level={0} ticks={gaugeMarkPlan(ticks.map((tick) => ({ mm: tick.thresholdMm, priced: tick.state !== "soon" })), chosen?.thresholdMm ?? null).map((mark) => ({ mm: mark.mm, selected: mark.selected, labelled: mark.labelled }))} label={`Rain gauge. Trigger line at ${chosen?.thresholdMm ?? "—"} mm.`} />
        <Text style={styles.gaugeCaption} numberOfLines={2}>{gaugeStateLine({ observedMm: null, updated: null, windowStart: selected ? windowStartLabel(selected) : null })}</Text>
      </View>
      <View accessibilityRole="list" accessibilityLabel="Rain triggers" style={{ flex: 1 }}>
        {ticks.filter((tick) => tick.tappable).map((tick) => <Pressable key={tick.thresholdMm} accessibilityRole="button" accessibilityState={{ selected: tick.state === "selected" }} onPress={() => setTriggerMm(tick.thresholdMm)} style={[styles.row, tick.state === "selected" && styles.rowOn]}>
          <Text style={styles.cell}>{tick.label}</Text>
        </Pressable>)}
        {moreTriggersSoon(ladder.soonCount) ? <Text style={styles.muted}>{moreTriggersSoon(ladder.soonCount)}</Text> : null}
      </View>
    </View> : null}
    {props.surface === "closed" ? <CalmCard
      title={props.nextOpenCopy ?? "The next weekly window is not on the schedule yet."}
      action="Refresh"
      onAction={props.onRefresh}
      link={props.openCity}
      onLink={props.openCity ? () => props.onCity?.(props.openCity!.slug) : undefined}
    /> : null}
    {props.surface === "error" ? <CalmCard title="Couldn't load prices" action="Retry" onAction={props.onRefresh} /> : null}
    {props.surface === "ready" && mode === "hidden" ? <CalmCard title="Not ready to price yet. A validated NOAA evidence package is not available." action="Refresh" onAction={props.onRefresh} /> : null}
    <Text style={styles.footnote}>{MARKETS_FOOTER}</Text>
  </View>;
}

function CalmCard(props: { title: string; action: string; onAction: () => void; link?: { slug: string; label: string } | null; onLink?: () => void }) {
  return <View style={styles.calm} accessibilityRole="summary">
    <Text style={styles.calmTitle}>{props.title}</Text>
    <Pressable accessibilityRole="button" onPress={props.onAction} style={styles.secondary}>
      <Text style={styles.secondaryLabel}>{props.action}</Text>
    </Pressable>
    {props.link && props.onLink ? <Pressable accessibilityRole="link" onPress={props.onLink} style={styles.linkHit}>
      <Text style={styles.linkLabel}>{props.link.label}</Text>
    </Pressable> : null}
  </View>;
}

function GaugeSkeleton() {
  const reduced = useReducedMotion();
  const shimmer = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    if (reduced) {
      shimmer.setValue(1);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(shimmer, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(shimmer, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduced, shimmer]);
  return <Animated.View accessibilityLabel="Loading prices" style={[styles.skeletonWrap, { opacity: shimmer }]}>
    <View style={styles.skeletonGauge}>
      <View style={[styles.tick, { top: 36 }]} />
      <View style={[styles.tick, { top: 78 }]} />
      <View style={[styles.tick, { top: 120 }]} />
    </View>
    <View style={{ gap: 10 }}>
      <View style={styles.skeletonRow} />
      <View style={styles.skeletonRow} />
      <View style={styles.skeletonRow} />
    </View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  footnote: { ...T.caption, color: C.quiet, marginTop: S.md },
  gaugeCaption: { ...T.caption, color: C.muted, maxWidth: 172, textAlign: "center", marginTop: S.xs },
  rowOn: { borderWidth: 1.5, borderColor: C.rain, backgroundColor: C.rainSoft },
  amounts: { flexDirection: "row", flexWrap: "wrap", gap: S.sm, marginBottom: S.sm },
  chipWrap: { position: "relative" },
  chipScroller: { marginHorizontal: -18 },
  chipScroll: { gap: S.sm, paddingBottom: S.md, paddingLeft: 18, paddingRight: 18 },
  chip: { minHeight: MIN_TOUCH, minWidth: 108, justifyContent: "center", paddingHorizontal: S.md, paddingVertical: S.xs, borderRadius: 999, borderWidth: 0, backgroundColor: C.surfaceRaised },
  chipOn: { borderWidth: 1.5, borderColor: C.rain, backgroundColor: C.rainSoft },
  chipLabel: { ...T.bodyStrong, color: C.ink },
  chipLabelOn: { color: C.ink },
  row: { flexDirection: "row", gap: 8, alignItems: "center", alignSelf: "flex-start", minHeight: MIN_TOUCH, borderRadius: 10, borderWidth: 1, borderColor: C.tick, paddingHorizontal: 8 },
  cell: { ...T.bodyStrong, color: C.ink, fontVariant: ["tabular-nums"] },
  muted: { ...T.body, color: C.muted, marginBottom: S.md },
  calm: { backgroundColor: C.surface, borderWidth: 0, borderRadius: 14, padding: S.lg, marginBottom: S.md, gap: S.sm },
  calmTitle: { ...T.body, color: C.ink },
  secondary: { alignSelf: "flex-start", minHeight: MIN_TOUCH, justifyContent: "center", paddingHorizontal: S.lg, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceRaised },
  secondaryLabel: { ...T.bodyStrong, color: C.ink },
  linkHit: { alignSelf: "flex-start", minHeight: MIN_TOUCH, justifyContent: "center" },
  linkLabel: { ...T.bodyStrong, color: C.rainBright },
  skeletonWrap: { flexDirection: "row", alignItems: "flex-end", gap: S.md, marginTop: S.sm, marginBottom: S.md },
  skeletonGauge: { width: 56, height: 180, borderRadius: 18, backgroundColor: C.surfaceRaised, borderWidth: 1, borderColor: C.border },
  tick: { position: "absolute", right: -12, width: 18, height: 2, borderRadius: 1, backgroundColor: C.tick },
  skeletonRow: { width: 148, height: 28, borderRadius: 10, backgroundColor: C.mutedSurface },
});
