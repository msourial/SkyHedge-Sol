import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { ArrowUpRight, CaretLeft } from "phosphor-react-native";
import { CITIES, perilById } from "../../../shared/peril-registry.ts";
import type { ReceiptModel } from "../../../shared/ui-discovery.ts";
import { lineTokens as C } from "../../../shared/ui-tokens.ts";
import type { PayoffModel } from "../../../shared/ui-view.ts";
import type { CoverProgress } from "../api.ts";
import { coverGauge, shortDate, windowDates } from "../round3.ts";
import { GaugeTrack } from "./CoverGauge.tsx";
import { HowPayout } from "./HowPayout.tsx";
import { PayoffChart } from "./payout-graphics.tsx";
import { LinePressable } from "./pressable.tsx";
import { EqualPair, Group, Pill, Row, ui } from "./primitives.tsx";
export function CoverDetail({ receipt: r, progress, now, signature, onClose, onCollect }: { receipt: ReceiptModel; progress?: CoverProgress | null; now?: number; signature?: string; onClose: () => void; onCollect?: () => void }) {
  const [explain, setExplain] = useState(false), g = coverGauge(r, progress, now);
  const station = CITIES.find(c => c.stationId.replace("GHCND:", "") === r.station?.replace("GHCND:", ""))?.station ?? r.station ?? "Station unavailable";
  const peril = perilById(r.peril ?? "rain"), loss = Number(r.loss?.replaceAll(",", "")), gain = Number(r.gain?.replaceAll(",", ""));
  const chart: PayoffModel | null = r.diagram && r.trigger != null ? { ...r.diagram, maximum: Math.max(...r.rungs, r.trigger, 1), openTriggers: r.rungs, domain: { loss, gain }, lossBase: String(Math.round(loss * 1e6)), gainBase: String(Math.round(gain * 1e6)), lossLabel: `−${r.loss}`, gainLabel: `+${r.gain}`, triggerLabel: `${r.trigger} ${r.unit}`, description: `Max loss ${r.loss}, max gain ${r.gain} SKYT` } : null;
  return <View><View style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 72 }}><LinePressable accessibilityLabel="Back to Wallet" onPress={onClose} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}><CaretLeft weight="bold" color={C.fg} size={24}/></LinePressable><View style={{ flex: 1 }}><Text style={[ui.figure, { fontSize: 17 }]}>{peril?.label} {peril?.direction === "down" ? "≤" : "≥"} {r.trigger ?? "—"} {r.unit}</Text><Text style={[ui.label, { lineHeight: 18 }]}>{station}, {r.city} · {windowDates(r.windowStart, r.windowEnd)}</Text></View><Pill>{g.label}</Pill></View>
    <View style={{ marginTop: 12, padding: 16, borderRadius: 24, backgroundColor: C.surface1 }}><Text style={ui.body}>{peril?.label} so far</Text>{g.value == null ? <Text style={[ui.figure, { marginVertical: 20 }]}>{g.reading}</Text> : <Text style={[ui.figure, { fontFamily: "Inter_750", fontSize: 44, lineHeight: 60, marginTop: 8, marginBottom: 12 }]}>{g.value.toFixed(1)} <Text style={[ui.body, { fontSize: 19 }]}>of {r.trigger ?? "—"} {r.unit}</Text></Text>}<GaugeTrack fraction={g.fraction} grey={g.grey} large/><View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8, marginTop: 8 }}><Text style={ui.label}>{g.value != null && r.trigger != null && g.value < r.trigger ? `${(r.trigger - g.value).toFixed(1)} ${r.unit} to go · ` : ""}{g.timing}</Text>{g.through ? <Text style={ui.label}>{g.through}</Text> : null}</View>{g.coverage ? <Text style={[ui.label, { marginTop: 8 }]}>{g.coverage}</Text> : null}
    {chart && r.trigger != null ? <View style={{ marginTop: 16 }}><Text style={ui.label}>Payout at the trigger</Text><PayoffChart diagram={chart} trigger={r.trigger} peril={r.peril ?? "rain"} unit={r.unit} highLabel={`${chart.maximum} ${r.unit}`}/></View> : null}</View>
    <View style={{ marginTop: 12 }}><EqualPair loss={r.loss == null ? "—" : `−${r.loss}`} gain={r.gain == null ? "—" : `+${r.gain}`}/></View>
    {g.state === "ready" && onCollect ? <LinePressable onPress={onCollect} style={[ui.cta, { marginTop: 12 }]}><Text style={ui.ctaText}>Collect {r.payout ?? ""} SKYT</Text></LinePressable> : null}
    <Group style={{ marginTop: 12 }}>{[["Window", windowDates(r.windowStart, r.windowEnd)], ["You paid", `${r.loss ?? "—"} SKYT`], ["Pays if it hits", `${r.payout ?? "—"} SKYT`], ["Station", `${station} · NOAA`]].map(([label, value], i) => <Row key={label} divider={i > 0}><Text style={[ui.body, { flex: 1 }]}>{label}</Text><Text style={[ui.figure, { fontSize: 15, flexShrink: 1, textAlign: "right" }]}>{value}</Text></Row>)}<Row divider onPress={() => { void Linking.openURL(`https://explorer.solana.com/${signature ? `tx/${signature}` : `address/${r.id}`}?cluster=devnet`); }}><Text style={[ui.body, { flex: 1 }]}>{signature ? "View transaction" : "View cover account"}</Text><ArrowUpRight size={20} color={C.fg2} weight="bold"/></Row><Row divider onPress={() => setExplain(true)}><Text style={ui.figure}>How payout works</Text></Row></Group><Text selectable style={[ui.label, { marginVertical: 12, lineHeight: 18 }]}>{g.source ?? "NOAA observations unavailable"}{r.station ? ` · ${r.station}` : ""}{progress?.reason ? `\n${progress.reason}` : ""}</Text>
    {explain ? <HowPayout explanation={{ station, peril: peril?.label.toLowerCase() ?? "weather", end: shortDate(r.windowEnd), pay: r.loss ?? "—", payout: r.payout ?? "—" }} onClose={() => setExplain(false)}/> : null}
  </View>;
}
