import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { WindowEvidencePackage } from "../../shared/window-chain.ts";
import {
  expiryChipCopy,
  matchingWindowPackage,
  pricedTriggers,
  sortByExpiry,
  triggerRows,
} from "../../shared/window-chain.ts";
import { payGet } from "../../shared/pay-get.ts";
import { coverageChipOn, gaugeMode, type ProtectSurface } from "../../shared/protect-surface.ts";
import { RainGauge } from "./rain-gauge";
import { useReducedMotion } from "./liquid-glass";
import { C, F, MIN_TOUCH, space as S, type as T } from "./theme";
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
  const maxMm = Math.max(1, ...rows.map((row) => row.thresholdMm));
  const chosen = ladder.priced.find((row) => row.thresholdMm === triggerMm) ?? ladder.priced[0] ?? null;
  const priced = ladder.priced.length > 0 && props.surface === "ready";
  const mode = gaugeMode({ surface: props.surface, evidenceLoading: props.evidenceLoading, pricedRowCount: ladder.priced.length });

  return <View>
    {props.cities?.length ? <View style={styles.chipWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll} style={styles.chipScroller} accessibilityRole="radiogroup" accessibilityLabel="City, scroll for more">
        {props.cities.map((city) => {
          const on = city.slug === props.city;
          return <Pressable key={city.slug} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => props.onCity?.(city.slug)} style={[styles.chip, on && styles.chipOn]}>
            <Text numberOfLines={1} style={[styles.chipLabel, on && styles.chipLabelOn]}>{city.label}</Text>
          </Pressable>;
        })}
      </ScrollView>
      <LinearGradient pointerEvents="none" colors={["rgba(11,18,32,0)", C.canvas]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chipFade} />
      <View pointerEvents="none" style={styles.moreWrap}><Text style={styles.moreLabel}>More</Text></View>
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
      <RainGauge showMm width={172} height={220} level={chosen ? chosen.thresholdMm / maxMm : 0} ticks={ladder.priced.map((row) => ({ mm: row.thresholdMm, selected: row.thresholdMm === chosen?.thresholdMm }))} label="Rain gauge" />
      <View accessibilityRole="list" accessibilityLabel="Rain triggers">
        {ladder.priced.map((row) => {
          const quote = payGet({ coverageSkyt: 100, premiumRateBps: row.premiumRateBps, probabilityBps: row.probabilityBps });
          const on = row.thresholdMm === chosen?.thresholdMm;
          return <Pressable key={row.thresholdMm} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setTriggerMm(row.thresholdMm)} style={[styles.row, on && styles.rowOn]}>
            <Text style={styles.cell}>{`≥${row.thresholdMm} mm`}</Text>
            <Text style={styles.cell}>{quote ? quote.chance : "—"}</Text>
            <Text style={styles.cell}>{quote ? quote.multiple : "—"}</Text>
          </Pressable>;
        })}
        {ladder.soonCount > 0 ? <Text style={styles.muted}>{ladder.soonCount} more triggers open soon</Text> : null}
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
    <Text style={styles.footnote}>Wind, snow and heat coming</Text>
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
  rowOn: { borderColor: "#F2C230" },
  amounts: { flexDirection: "row", flexWrap: "wrap", gap: S.sm, marginBottom: S.sm },
  chipWrap: { position: "relative" },
  chipFade: { position: "absolute", right: -18, top: 0, bottom: S.md, width: 64 },
  moreWrap: { position: "absolute", right: -10, top: 0, bottom: S.md, justifyContent: "center" },
  moreLabel: { ...T.caption, color: C.muted, fontFamily: F.bodyMedium },
  chipScroller: { marginHorizontal: -18 },
  chipScroll: { gap: S.sm, paddingBottom: S.md, paddingLeft: 18, paddingRight: 48 },
  chip: { minHeight: MIN_TOUCH, minWidth: 108, justifyContent: "center", paddingHorizontal: S.md, paddingVertical: S.xs, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceRaised },
  chipOn: { borderColor: "#F2C230", backgroundColor: C.surfaceRaised },
  chipLabel: { ...T.bodyStrong, color: C.ink },
  chipLabelOn: { color: C.rainBright },
  row: { flexDirection: "row", gap: 8, alignItems: "center", alignSelf: "flex-start", minHeight: 36, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 8 },
  cell: { ...T.bodyStrong, color: C.ink, fontVariant: ["tabular-nums"] },
  muted: { ...T.body, color: C.muted, marginBottom: S.md },
  calm: { backgroundColor: C.mutedSurface, borderColor: C.border, borderWidth: 1, borderRadius: 16, padding: S.lg, marginBottom: S.md, gap: S.sm },
  calmTitle: { ...T.body, color: C.ink },
  secondary: { alignSelf: "flex-start", minHeight: MIN_TOUCH, justifyContent: "center", paddingHorizontal: S.lg, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceRaised },
  secondaryLabel: { ...T.bodyStrong, color: C.ink },
  linkHit: { alignSelf: "flex-start", minHeight: MIN_TOUCH, justifyContent: "center" },
  linkLabel: { ...T.bodyStrong, color: C.rainBright },
  skeletonWrap: { flexDirection: "row", alignItems: "flex-end", gap: S.md, marginTop: S.sm, marginBottom: S.md },
  skeletonGauge: { width: 56, height: 180, borderRadius: 18, backgroundColor: C.surfaceRaised, borderWidth: 1, borderColor: C.border },
  tick: { position: "absolute", right: -12, width: 18, height: 2, borderRadius: 1, backgroundColor: C.quiet },
  skeletonRow: { width: 148, height: 28, borderRadius: 10, backgroundColor: C.mutedSurface },
});
