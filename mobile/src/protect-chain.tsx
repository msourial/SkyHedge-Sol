import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { WindowEvidencePackage } from "../../shared/window-chain.ts";
import {
  expiryChipCopy,
  expiryChipLabel,
  matchingWindowPackage,
  measuredAtLine,
  pricedTriggers,
  sortByExpiry,
  triggerRows,
} from "../../shared/window-chain.ts";
import { consumerCityBySlug } from "../../shared/consumer-cities.ts";
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
  const ladder = pricedTriggers(rows);
  const expiry = selected ? expiryChipLabel(selected)?.split(" · ")[0] ?? "" : "";
  const maxMm = Math.max(1, ...rows.map((row) => row.thresholdMm));

  return <View>
    <Text style={styles.settle} android_hyphenationFrequency="none">{expiry ? measuredAtLine(source, expiry) : "Rain"}</Text>
    <Text style={styles.muted}>Wind, snow and heat coming</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll} style={styles.chipScroller} accessibilityRole="radiogroup" accessibilityLabel="Expiry">
      {windows.length ? windows.map((window) => {
        const on = window.address === selected?.address;
        const label = expiryChipCopy(window, props.nowSeconds) ?? "Expiry";
        return <Pressable key={window.address} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={() => props.onSelectWindow(window.address)} style={[styles.chip, on && styles.chipOn]}>
          <Text numberOfLines={1} android_hyphenationFrequency="none" style={[styles.chipLabel, on && styles.chipLabelOn]}>{label}</Text>
        </Pressable>;
      }) : <Text style={styles.muted}>Next window opening shortly</Text>}
    </ScrollView>
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: S.md }}>
      <RainGauge level={onChainMm ? onChainMm / maxMm : 0} ticks={ladder.priced.map((row) => ({ mm: row.thresholdMm, selected: row.thresholdMm === onChainMm }))} label="Rain gauge" />
      <View style={{ flex: 1 }} accessibilityRole="list" accessibilityLabel="Rain triggers">
        {props.evidenceLoading ? <Text style={styles.muted}>Checking NOAA analogue history…</Text> : null}
        {!props.evidenceLoading && !pkg ? <Text style={styles.muted}>Not ready to price yet. A validated NOAA evidence package is not available.</Text> : null}
        {ladder.priced.map((row) => {
          const quote = payGet({ coverageSkyt: 100, premiumRateBps: row.premiumRateBps, probabilityBps: row.probabilityBps });
          return <View key={row.thresholdMm} style={styles.row}>
            <Text style={styles.cell}>{`≥ ${row.thresholdMm} mm`}</Text>
            <Text style={styles.cell}>{quote ? `${quote.chance} · ${quote.multiple}` : "—"}</Text>
          </View>;
        })}
        {ladder.soonCount > 0 ? <Text style={styles.muted}>{ladder.soonCount} more triggers open soon</Text> : null}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  settle: { ...T.body, color: C.muted, marginBottom: S.md },
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
