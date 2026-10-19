import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { WindowEvidencePackage } from "../../shared/window-chain.ts";
import {
  chanceLabel,
  daysToExpiry,
  daysToExpiryLabel,
  expiryChipLabel,
  matchingWindowPackage,
  pricePer100Label,
  payoutMultipleLabel,
  settlementLine,
  sortByExpiry,
  triggerRows,
} from "../../shared/window-chain.ts";
import { consumerCityBySlug } from "../../shared/consumer-cities.ts";
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
}) {
  const windows = sortByExpiry(props.windows);
  const selected = windows.find((window) => window.address === props.selectedAddress) ?? windows[0] ?? null;
  const source = consumerCityBySlug(props.city)?.source ?? "NOAA station";
  const pkg = selected ? matchingWindowPackage(props.evidence, props.city, selected.observationStart, selected.observationEnd) : null;
  const onChainMm = selected?.thresholdMmX100 && /^\d+$/.test(selected.thresholdMmX100) ? Number(selected.thresholdMmX100) / 100 : null;
  const rows = pkg ? triggerRows({
    totalsMm: pkg.analogueTotalsMm,
    forecastCumulativeMm: pkg.forecastCumulativeMm,
    onChainThresholdMm: onChainMm,
    onChainProbabilityBps: selected?.quoteProbabilityBps ?? null,
    onChainPremiumRateBps: selected?.premiumRateBps ?? null,
  }) : [];

  return <View>
    <Text style={styles.settle} android_hyphenationFrequency="none">{settlementLine(source)}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll} style={styles.chipScroller} accessibilityRole="radiogroup" accessibilityLabel="Expiry">
      {windows.length ? windows.map((window) => {
        const on = window.address === selected?.address;
        const label = expiryChipLabel(window) ?? "Expiry";
        const days = daysToExpiryLabel(daysToExpiry(window.observationEnd, props.nowSeconds));
        return <Pressable key={window.address} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${label}, ${days}`} onPress={() => props.onSelectWindow(window.address)} style={[styles.chip, on && styles.chipOn]}>
          <Text numberOfLines={1} android_hyphenationFrequency="none" style={[styles.chipLabel, on && styles.chipLabelOn]}>{label}</Text>
          <Text numberOfLines={1} android_hyphenationFrequency="none" style={[styles.chipDays, on && styles.chipDaysOn]}>{days}</Text>
        </Pressable>;
      }) : <Text style={styles.muted}>Next window opening shortly</Text>}
    </ScrollView>
    <View accessibilityRole="list" accessibilityLabel="Rain triggers">
      <View style={styles.head}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} android_hyphenationFrequency="none" style={[styles.headText, styles.colTrigger]}>Trigger</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} android_hyphenationFrequency="none" style={[styles.headText, styles.colChance]}>Chance</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} android_hyphenationFrequency="none" style={[styles.headText, styles.colPrice]}>Per 100 SKYT</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} android_hyphenationFrequency="none" style={[styles.headText, styles.colPayout]}>Payout</Text>
      </View>
      {props.evidenceLoading ? <Text style={styles.muted}>Checking NOAA analogue history…</Text> : null}
      {!props.evidenceLoading && !pkg ? <Text style={styles.muted}>Not ready to price yet. A validated NOAA evidence package is not available.</Text> : null}
      {rows.map((row) => {
        const price = row.onChain ? pricePer100Label(row.premiumRateBps) : null;
        const multiple = row.onChain ? payoutMultipleLabel(row.premiumRateBps) : null;
        const chance = chanceLabel(row.probabilityBps);
        return <Pressable
          key={row.thresholdMm}
          accessibilityRole={row.onChain ? "button" : "text"}
          accessibilityState={{ disabled: !row.onChain, selected: row.onChain }}
          disabled={!row.onChain}
          onPress={() => { if (selected && row.onChain) props.onSelectWindow(selected.address); }}
          style={[styles.row, row.onChain && styles.rowPopular, !row.onChain && styles.rowSoon]}
        >
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} android_hyphenationFrequency="none" style={[styles.cell, styles.colTrigger, !row.onChain && styles.soonText]}>{`≥ ${row.thresholdMm} mm`}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} android_hyphenationFrequency="none" style={[styles.cell, styles.colChance, !row.onChain && styles.soonText]}>{chance ?? "—"}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} android_hyphenationFrequency="none" style={[styles.cell, styles.colPrice, !row.onChain && styles.soonText]}>{price ?? "Coming soon"}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} android_hyphenationFrequency="none" style={[styles.cell, styles.colPayout, !row.onChain && styles.soonText]}>{multiple ?? "—"}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  settle: { ...T.body, color: C.muted, marginBottom: S.md },
  chipScroller: { marginHorizontal: -18 },
  chipScroll: { gap: S.sm, paddingBottom: S.md, paddingLeft: 18, paddingRight: 32 },
  chip: { minHeight: MIN_TOUCH, minWidth: 108, justifyContent: "center", paddingHorizontal: S.md, paddingVertical: S.xs, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceRaised },
  chipOn: { borderColor: C.rain, backgroundColor: C.rainSoft },
  chipLabel: { ...T.bodyStrong, color: C.ink },
  chipLabelOn: { color: C.rainBright },
  chipDays: { ...T.caption, color: C.quiet },
  chipDaysOn: { color: C.rain },
  head: { flexDirection: "row", gap: 4, paddingBottom: S.xs },
  headText: { ...T.caption, color: C.quiet },
  row: { flexDirection: "row", gap: 4, alignItems: "center", minHeight: MIN_TOUCH, borderRadius: 12, paddingHorizontal: 2 },
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
