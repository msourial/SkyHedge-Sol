import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { WindowEvidencePackage } from "../../shared/window-chain.ts";
import {
  expiryChipCopy,
  matchingWindowPackage,
  pricedTriggers,
  sortByExpiry,
  triggerRows,
} from "../../shared/window-chain.ts";
import { payGet } from "../../shared/pay-get.ts";
import { RainGauge } from "./rain-gauge";
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
  amounts?: readonly { id: string; label: string; on: boolean; onPress: () => void }[];
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

  return <View>
    {props.cities?.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll} style={styles.chipScroller} accessibilityRole="radiogroup" accessibilityLabel="City">
      {props.cities.map((city) => {
        const on = city.slug === props.city;
        return <Pressable key={city.slug} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => props.onCity?.(city.slug)} style={[styles.chip, on && styles.chipOn]}>
          <Text numberOfLines={1} style={[styles.chipLabel, on && styles.chipLabelOn]}>{city.label}</Text>
        </Pressable>;
      })}
    </ScrollView> : null}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll} style={styles.chipScroller} accessibilityRole="radiogroup" accessibilityLabel="Expiry">
      {windows.length ? windows.map((window) => {
        const on = window.address === selected?.address;
        const label = expiryChipCopy(window, props.nowSeconds) ?? "Expiry";
        return <Pressable key={window.address} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={() => props.onSelectWindow(window.address)} style={[styles.chip, on && styles.chipOn]}>
          <Text numberOfLines={1} android_hyphenationFrequency="none" style={[styles.chipLabel, on && styles.chipLabelOn]}>{label}</Text>
        </Pressable>;
      }) : <Text style={styles.muted}>Next window opening shortly</Text>}
    </ScrollView>
    {props.amounts?.length ? <View accessibilityRole="radiogroup" accessibilityLabel="Coverage amount in SKYT" style={styles.amounts}>
      {props.amounts.map((amount) => <Pressable key={amount.id} accessibilityRole="radio" accessibilityState={{ selected: amount.on }} onPress={amount.onPress} style={[styles.chip, amount.on && styles.chipOn]}>
        <Text style={[styles.chipLabel, amount.on && styles.chipLabelOn]}>{amount.label}</Text>
      </Pressable>)}
    </View> : null}
    {props.evidenceLoading ? <Text style={styles.muted}>Checking NOAA analogue history…</Text> : null}
    {!props.evidenceLoading && !pkg ? <Text style={styles.muted}>Not ready to price yet. A validated NOAA evidence package is not available.</Text> : null}
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: S.sm, marginTop: S.sm }}>
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
    </View>
    <Text style={styles.footnote}>Wind, snow and heat coming</Text>
  </View>;
}

const styles = StyleSheet.create({
  eyebrow: { ...T.overline, color: C.quiet, marginBottom: 2 },
  city: { ...T.hero, fontFamily: F.headingBold, color: C.ink, marginBottom: S.xs },
  settle: { ...T.body, color: C.muted, marginBottom: S.md },
  footnote: { ...T.caption, color: C.quiet, marginTop: S.md },
  rowOn: { borderColor: "#F2C230" },
  amounts: { flexDirection: "row", flexWrap: "wrap", gap: S.sm, marginBottom: S.sm },
  chipScroller: { marginHorizontal: -18 },
  chipScroll: { gap: S.sm, paddingBottom: S.md, paddingLeft: 18, paddingRight: 32 },
  chip: { minHeight: MIN_TOUCH, minWidth: 108, justifyContent: "center", paddingHorizontal: S.md, paddingVertical: S.xs, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceRaised },
  chipOn: { borderColor: "#F2C230", backgroundColor: C.surfaceRaised },
  chipLabel: { ...T.bodyStrong, color: C.ink },
  chipLabelOn: { color: C.rainBright },
  chipDays: { ...T.caption, color: C.quiet },
  chipDaysOn: { color: C.rain },
  head: { flexDirection: "row", gap: 4, paddingBottom: S.xs },
  headText: { ...T.caption, color: C.quiet },
  row: { flexDirection: "row", gap: 8, alignItems: "center", alignSelf: "flex-start", minHeight: 36, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 8 },
  rowPopular: { backgroundColor: C.rainSoft, borderWidth: 1, borderColor: C.rain },
  rowSoon: { opacity: 0.55 },
  cell: { ...T.bodyStrong, color: C.ink, fontVariant: ["tabular-nums"] },
  soonText: { color: C.quiet, fontFamily: F.body },
  colTrigger: { flex: 1.05, minWidth: 0 },
  colChance: { flex: 0.7, minWidth: 0 },
  colPrice: { flex: 1.25, minWidth: 0, textAlign: "right" },
  colPayout: { flex: 0.95, minWidth: 0, textAlign: "right" },
  muted: { ...T.body, color: C.muted, marginBottom: S.md },
});
