import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View, Vibration, useWindowDimensions } from "react-native";
import { perilById } from "../../../shared/peril-registry.ts";
import { GETTING_QUOTE, MAX_GAIN, MAX_LOSS, TRY_AGAIN, WAITING_WALLET, infoSheetTitle } from "../../../shared/ui-copy.ts";
import { coldCard } from "../../../shared/ui-markets.ts";
import { chanceBarWidth } from "../../../shared/ui-payoff.ts";
import { lineTokens as C, MARKET_CAP_SKYT } from "../../../shared/ui-tokens.ts";
import type { MoneyFigure, TicketModel } from "../../../shared/ui-view.ts";
import type { LineController } from "./use-line.ts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { F } from "../theme.ts";
import { LinePressable } from "./pressable.tsx";
import { CityPill, EqualPair, Group, LineSheet, PerilTiles, Pill, PillSegmented, Row, lineType, ui } from "./primitives.tsx";
import { PayoffChart, usePayoutTween } from "./payout-graphics.tsx";

import { dismissMultipleTip, shouldShowMultipleTip } from "../round3.ts";
import { multipleTipStorage } from "../multiple-tip-store.ts";
import { HowPayout } from "./HowPayout.tsx";

export function ProtectBody(props: { line: LineController; onCity: (cityId: string) => void; onWallet: () => void; onRetry: () => void }) {
  const { line } = props, model = line.model;
  const [coldSheet, setColdSheet] = useState(false), [payoutSheet, setPayoutSheet] = useState(false), [showTip, setShowTip] = useState(false);
  const [screenReader, setScreenReader] = useState<boolean | null>(null);
  useEffect(() => { let live = true; void AccessibilityInfo.isScreenReaderEnabled().then(v => { if (live) setScreenReader(v); }); const listener = AccessibilityInfo.addEventListener("screenReaderChanged", setScreenReader); return () => { live = false; listener.remove(); }; }, []);
  const { height } = useWindowDimensions(), insets = useSafeAreaInsets();
  const [chainY, setChainY] = useState(450), [tipHeight, setTipHeight] = useState(140);
  const buyable = line.approveTarget != null;
  useEffect(() => { let live = true; if (buyable) void shouldShowMultipleTip(multipleTipStorage).then(show => { if (live) setShowTip(show); }); return () => { live = false; }; }, [buyable]);
  const dismissTip = () => { setShowTip(false); void dismissMultipleTip(multipleTipStorage).catch(() => {}); };
  const pay = model.ticket ? `${model.ticket.loss.whole}.${model.ticket.loss.fraction}` : "—";
  const payout = model.ticket?.payout ?? "—";
  const station = model.signRows.find(r => r.label === "Station")?.value ?? model.cityName;

  const prior = useRef(model);
  if (model.ticket) prior.current = model;
  const chartModel = model.ticket ? model : model.peril === "cold" && prior.current.cityName === model.cityName && prior.current.tenor === model.tenor ? prior.current : model;
  const dim = model.panel.kind === "closed" || model.panel.kind === "not-open";
  const end = chartModel.signRows.find(r => r.label === "Window")?.value.split(/ to | – /).pop() ?? "";
  const high = chartModel.rows.find(r => r.topTag);
  const highLabel = `${chartModel.payoff?.maximum ?? ""} ${chartModel.unit}${high?.topTag ? ` · ${high.topTag}` : ""}`;
  const selectedRow = model.rows.findIndex(r => r.selected);
  const multiple = model.rows.find(r => r.selected)?.multiple ?? "—";
  const tipText = `${multiple} means pay ${pay} and get ${payout} SKYT if ${station} gets ${model.signRows.find(r => r.label === "Trigger")?.value ?? "the trigger"} by ${end}. If not, you lose the ${pay}.`;
  useEffect(() => { if (showTip && screenReader === true) { AccessibilityInfo.announceForAccessibility(tipText); dismissTip(); } }, [showTip, screenReader]);
  return <View onStartShouldSetResponderCapture={() => { if (showTip) dismissTip(); return false; }}>
    <View style={styles.head}><CityPill city={model.cityName} onPress={() => line.setSheet("city")}/><PillSegmented items={[{ value: "weekly", label: "Week" }, { value: "monthly", label: "Month" }]} value={model.tenor} onChange={line.setTenor} height={40}/></View>
    <Text numberOfLines={1} style={styles.sub}>{model.subline}</Text>
    <View style={styles.tiles}><PerilTiles size="xs" value={model.peril} onChange={peril => { line.setPeril(peril); if (peril === "cold") setColdSheet(true); }}/></View>
    <View style={styles.hero}>
      <View style={styles.heroHead}><View style={{ flex: 1 }}><Text style={[ui.label, { lineHeight: 20 }]}>Pays out at</Text><View style={styles.numeralRow}>{model.panel.kind === "not-open" ? <Text style={[ui.figure, { fontSize: 19 }]}>Not available yet</Text> : chartModel.hero ? <><TriggerFigure value={Number(chartModel.hero.numeral)}/><Text style={styles.unit}>{chartModel.unit} {perilById(chartModel.peril)?.direction === "down" ? "or less" : "or more"}</Text></> : <Text style={styles.unit}>—</Text>}</View></View><View style={{ marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 6 }}><LinePressable accessibilityRole="button" accessibilityLabel="How payout works" onPress={() => { dismissTip(); setPayoutSheet(true); }} style={{ width: 48, height: 48, justifyContent: "center", alignItems: "center" }}><View style={[styles.infoDot, { width: 28, height: 28, borderRadius: 14 }]}><Text style={ui.figure}>i</Text></View></LinePressable><Pill devnet compact/></View></View>
      {chartModel.payoff && chartModel.selected != null ? <PayoffChart diagram={chartModel.payoff} trigger={chartModel.selected} unit={chartModel.unit} peril={chartModel.peril} highLabel={highLabel} dim={dim} triggerColor={C.fg2}/> : <View style={{ height: 172, justifyContent: "center" }}><Text style={ui.body}>{model.panel.kind === "loading" ? GETTING_QUOTE : "Not available yet"}</Text></View>}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: 6, flexWrap: "wrap" }}><Text style={[ui.figure, { fontSize: 15 }]}>Pay {pay} · get {payout} if it hits</Text><Text style={ui.label}>by {end}</Text></View>
      {model.panel.kind === "closed" ? <View style={{ position: "absolute", top: 12, right: 16 }}><Pill>{model.panel.line}</Pill></View> : null}
      {model.panel.kind === "not-open" ? <View style={{ marginTop: 8 }}><Text style={ui.body}>{model.peril === "cold" ? null : model.panel.line}</Text>{model.peril === "cold" ? <LinePressable onPress={() => setColdSheet(true)} style={styles.textButton}><Text style={styles.link}>See why</Text></LinePressable> : model.panel.go ? <LinePressable onPress={() => { if (model.panel.kind !== "not-open" || !model.panel.go) return; props.onCity(model.panel.go.cityId); if (model.panel.go.tenor) line.setTenor(model.panel.go.tenor); }} style={styles.textButton}><Text style={styles.link}>{model.panel.go.label}</Text></LinePressable> : null}</View> : null}
    </View>
    {model.showChain ? <View onLayout={e => setChainY(e.nativeEvent.layout.y)} style={{ position: "relative", zIndex: showTip ? 10 : 0 }}><Group style={styles.chain}><View accessibilityLabel="Trigger chain">
      <View style={styles.chainHead}>{["Trigger", "Chance", "Multiple", "Max loss"].map((label, index) => <Text key={label} style={[ui.label, column(index), index > 0 && styles.right]}>{label}</Text>)}</View>
      {model.rows.map((row, index) => <LinePressable key={row.trigger} disabled={row.inert || dim} accessibilityRole={row.inert ? "text" : "radio"} accessibilityState={{ selected: row.selected, disabled: row.inert || dim }} accessibilityLabel={`${row.name}${row.tag ? `. ${row.tag}` : ""}`} onPress={() => { dismissTip(); Vibration.vibrate(10); line.setSelectedTrigger(row.trigger); }} style={[styles.row, row.selected && styles.rowOn]}>
        {index > 0 && !row.selected && !model.rows[index - 1].selected ? <View style={styles.divider}/> : null}
        <View style={column(0)}><View style={styles.triggerRow}>{row.open ? <View style={[styles.radio, row.selected && styles.radioOn]}/> : null}<Text numberOfLines={1} style={[ui.figure, !row.open && styles.dry]}>{row.triggerLabel}</Text></View>{row.topTag ? <Text style={styles.dryLabel}>{row.topTag}</Text> : null}{row.tag ? <Text style={ui.label}>{row.tag}</Text> : null}</View>
        <View style={[column(1), styles.chance]}><Text style={[ui.figure, !row.open && styles.dry]}>{row.chance}</Text><ChanceBar chance={parseFloat(row.chance) / 100} selected={row.selected}/></View>
        <Text style={[ui.figure, column(2), styles.right, !row.open && styles.dry]}>{row.multiple}</Text>
        <View style={[column(3), { alignItems: "flex-end" }]}>{row.maxLoss === "Not open" ? <Pill>Not open</Pill> : <Text style={[ui.figure, !row.open && styles.dry]}>{row.maxLoss.replace("-", "−")}</Text>}</View>
        {row.selected ? <View pointerEvents="none" style={styles.innerRing}/> : null}
      </LinePressable>)}
    </View></Group>{showTip && screenReader === false && selectedRow >= 0 ? <>
      <View onLayout={e => setTipHeight(e.nativeEvent.layout.height)} accessibilityLiveRegion="polite" style={{ position: "absolute", top: Math.max(0, Math.min(10 + 32 + (selectedRow + 1) * 52 + 10, height - insets.top - 180 - tipHeight - chainY - 16)), left: 0, right: 0, borderRadius: 18, backgroundColor: C.bgRaised, borderWidth: 1, borderColor: "rgba(169,180,194,.25)", padding: 14, flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ position: "absolute", top: -7, right: "29%", width: 12, height: 12, backgroundColor: C.bgRaised, transform: [{ rotate: "45deg" }], borderTopWidth: 1, borderLeftWidth: 1, borderColor: "rgba(169,180,194,.25)" }}/><View style={{ flex: 1 }}><Text style={[ui.figure, { fontSize: 15 }]}>What {multiple} means</Text><Text style={[ui.label, { lineHeight: 19, marginTop: 4 }]}>{tipText}</Text></View><LinePressable onPress={dismissTip} style={{ minWidth: 48, minHeight: 48, justifyContent: "center" }}><Text style={styles.link}>Got it</Text></LinePressable></View></> : null}</View> : null}
    <View style={styles.belowFold}>
      {model.footnotes.filter(note => !model.readOnly || note !== model.optionAFootnote).map(note => <Text key={note} style={styles.note}>{note}</Text>)}
      {model.ticket ? <>
        {model.coveredRow ? <View style={styles.coveredRow}><Text style={[ui.figure, { flex: 1 }]}>{model.coveredRow.label}</Text></View> : null}
        {!model.readOnly ? <><View style={styles.sizeHead}><Text style={ui.label}>Cover size, SKYT</Text><Pressable accessibilityRole="button" accessibilityLabel={infoSheetTitle()} onPress={() => line.setSheet("info")} style={styles.info}><View style={styles.infoDot}><Text style={ui.label}>i</Text></View></Pressable></View><PillSegmented items={model.chips.map(chip => ({ value: chip.cover, label: String(chip.cover), disabled: chip.disabled }))} value={model.chips.find(c => c.selected)?.cover ?? 100} onChange={line.setCover}/></> : null}
        {model.capMessage ? <Text style={styles.note}>{model.capMessage}</Text> : null}
        <Group style={{ marginTop: 12 }}>{model.ticket.signRows.slice(3).filter(r => r.value && !r.value.includes("—")).map((row, index) => <TicketRow key={row.label} {...row} divider={index > 0}/>)}</Group>
        <Text style={[ui.body, { marginTop: 14, marginHorizontal: 4 }]}>{model.ticket.sentence}</Text>
        <Text style={styles.note}>{model.ticket.salesClose}</Text><Text style={styles.note}>{model.ticket.refund}</Text>{model.ticket.honesty ? <Text style={styles.note}>{model.ticket.honesty}</Text> : null}
        <LinePressable onPress={() => line.setSheet("info")} style={styles.textButton}><Text style={styles.link}>{infoSheetTitle()}</Text></LinePressable>
      </> : null}
    </View>
    {line.sheet === "city" ? <LineSheet title="Choose city" onClose={() => line.setSheet(null)}>{line.cities.map(city => <Row key={city.id} onPress={() => { props.onCity(city.id); line.setSheet(null); }}><Text style={ui.figure}>{city.name}</Text></Row>)}</LineSheet> : null}
    {line.sheet === "info" && model.ticket?.sheet ? <LineSheet title={infoSheetTitle()} onClose={() => line.setSheet(null)}><Text style={[ui.figure, { marginBottom: 12 }]}>Up to {MARKET_CAP_SKYT} SKYT per market</Text><Text style={ui.body}>{model.ticket.sheet}</Text></LineSheet> : null}
    {payoutSheet ? <HowPayout explanation={{ station, peril: perilById(model.peril)?.label.toLowerCase() ?? "weather", end, pay, payout }} onClose={() => setPayoutSheet(false)}/> : null}
    {coldSheet ? <LineSheet title="Not available yet" onClose={() => setColdSheet(false)}><Text style={ui.body}>{coldCard.explanation}</Text></LineSheet> : null}
  </View>;
}
function TriggerFigure({ value }: { value: number }) {
  const { frame: [number], previous, opacity } = usePayoutTween([value]);
  const format = (n: number) => Number.isInteger(value) ? Math.round(n) : n.toFixed(1);
  return <View><Animated.Text style={[styles.numeral, { opacity }]}>{format(number)}</Animated.Text>{previous ? <Animated.Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.numeral, StyleSheet.absoluteFill, { opacity: opacity.interpolate({ inputRange: [0,1], outputRange: [1,0] }) }]}>{format(previous[0])}</Animated.Text> : null}</View>;
}
function ChanceBar({ chance, selected }: { chance: number; selected: boolean }) { const { frame: [on] } = usePayoutTween([selected ? 1 : 0], 0, 150); return <View style={styles.chanceTrack}><View style={{ width: chanceBarWidth(chance), height: 4, borderRadius: 2, backgroundColor: `rgba(${Math.round(169 - 45 * on)},${Math.round(180 + 16 * on)},${Math.round(194 + 61 * on)},${.55 + .45 * on})` }}/></View>; }
export function LinePay(props: { line: LineController; onConnect: () => void; onReview: () => void; onWallet: () => void; onRetry: () => void; onCity: (cityId: string) => void; sheetOpen?: boolean }) {
  const panel = props.line.model.panel;
  if (panel.kind === "error") return <View style={styles.pay}><Text style={ui.body}>{panel.message}</Text><LinePressable onPress={props.onRetry} style={styles.textButton}><Text style={styles.link}>{TRY_AGAIN}</Text></LinePressable></View>;
  if (panel.kind === "paid" || panel.kind === "dry") return <View style={styles.pay}><Text style={ui.figure}>{panel.result}</Text><Text style={ui.label}>{panel.kind === "paid" ? "Paid out" : "Expired"}</Text></View>;
  const loading = panel.kind === "loading", signing = panel.kind === "signing", closed = panel.kind === "closed" || panel.kind === "not-open";
  const loss = "loss" in panel ? panel.loss : props.line.model.ticket?.loss ?? null, gain = "gain" in panel ? panel.gain : props.line.model.ticket?.gain ?? null;
  const label = loading ? GETTING_QUOTE : signing ? WAITING_WALLET : panel.kind === "closed" ? "Sales closed" : panel.kind === "not-open" ? "Not available yet" : panel.kind === "covered" ? "View cover" : panel.cta;
  return <View style={styles.pay} pointerEvents={props.sheetOpen ? "none" : "auto"} accessibilityElementsHidden={props.sheetOpen} importantForAccessibility={props.sheetOpen ? "no-hide-descendants" : "auto"}>
    <View style={styles.payFigs}>{([[MAX_LOSS, loss], [MAX_GAIN, gain]] as const).map(([title, fig], index) => <Text key={title} style={ui.label}>{title} <Text style={[ui.figure, { fontSize: 13, lineHeight: 16 }]}>{fig ? figure(fig) : "…"}</Text>{index === 1 ? " SKYT" : ""}</Text>)}</View>
    <LinePressable accessibilityRole="button" disabled={loading || signing || closed || props.sheetOpen || (panel.kind === "ready" && !props.line.approveTarget)} onPress={panel.kind === "covered" ? props.onWallet : panel.kind === "connect" ? props.onConnect : props.onReview} style={[ui.cta, (loading || signing || closed) && { backgroundColor: C.surface2 }]}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={13 / 16} style={[ui.ctaText, (loading || signing || closed) && { color: C.fg2 }]}>{label}</Text></LinePressable>
  </View>;
}
export function MoneyCells({ ticket }: { ticket: Pick<TicketModel, "loss" | "gain"> }) { return <EqualPair loss={figure(ticket.loss)} gain={figure(ticket.gain)}/>; }
export function TicketRow({ label, value, divider = false }: { label: string; value: string; payout?: boolean; divider?: boolean }) { return <Row divider={divider}><Text style={[ui.body, { flex: 1 }]}>{label}</Text><Text style={[ui.figure, { fontSize: 15 }]}>{value}</Text></Row>; }
function figure(fig: MoneyFigure) { return `${fig.sign === "-" ? "−" : fig.sign}${fig.whole}.${fig.fraction}`; }
function column(index: number) { return { flex: [1.25, 1.15, .8, 1][index], minWidth: 0 }; }
const styles = StyleSheet.create({
  head: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  sub: { ...ui.label, marginHorizontal: 4, marginTop: -4, height: 16 }, tiles: { marginTop: 10 },
  hero: { marginTop: 10, backgroundColor: C.surface1, borderRadius: 24, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 12 },
  heroHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }, numeralRow: { height: 56, flexDirection: "row", alignItems: "baseline", gap: 4 },
  numeral: { ...lineType, color: C.slicker, fontFamily: "Inter_750", fontSize: 44, lineHeight: 46, letterSpacing: -1.4, includeFontPadding: false }, unit: { ...lineType, fontFamily: F.bodySemi, color: C.fg2, fontSize: 19, letterSpacing: -.3 },
  caption: { ...ui.label, color: C.dryText, marginTop: 6 }, chain: { marginTop: 10, paddingBottom: 4 }, chainHead: { height: 32, flexDirection: "row", alignItems: "center", paddingHorizontal: 14 },
  row: { height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 14 }, rowOn: { marginHorizontal: 4, paddingHorizontal: 10, backgroundColor: C.bgRaised, borderRadius: 16 }, innerRing: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, borderRadius: 16, borderWidth: 1.5, borderColor: C.fg },
  divider: { position: "absolute", left: 14, right: 14, top: 0, height: 1, backgroundColor: C.divider }, right: { textAlign: "right" }, triggerRow: { flexDirection: "row", alignItems: "center", gap: 10 }, radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.dryText }, radioOn: { borderColor: C.fg, borderWidth: 5 }, dry: { color: C.fg2 }, dryLabel: { ...ui.label, color: C.dryText }, chance: { alignItems: "flex-end", gap: 5 }, chanceTrack: { width: 64, height: 4, borderRadius: 2, backgroundColor: "rgba(169,180,194,.14)", overflow: "hidden" },
  belowFold: { marginTop: 10 }, note: { ...ui.label, color: C.dryText, marginHorizontal: 4, marginBottom: 8 }, sizeHead: { marginTop: 4, marginHorizontal: 4, height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, info: { width: 48, height: 48, justifyContent: "center", alignItems: "flex-end" }, infoDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.bgRaised, alignItems: "center", justifyContent: "center" }, coveredRow: { flexDirection: "row", alignItems: "center", minHeight: 56 }, textButton: { minHeight: 48, justifyContent: "center" }, link: { ...ui.figure, color: C.glacier, fontSize: 15 },
  pay: { minHeight: 98, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.divider, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 }, payFigs: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
});

/** Existing claim action, presented with the same flat Protect surfaces. */
export function LineClaimBar({ label, busy, busyLabel, onPress }: { label: string; busy: boolean; busyLabel?: string; onPress: () => void }) {
  return <View style={styles.pay}><Text style={[ui.label, { marginBottom: 8 }]}>{busy ? "Waiting for your wallet" : "Ready to collect"}</Text><LinePressable disabled={busy} onPress={onPress} style={[ui.cta, busy && { backgroundColor: C.surface2 }]}><Text numberOfLines={1} style={[ui.ctaText, busy && { color: C.fg2 }]}>{busy ? busyLabel ?? WAITING_WALLET : label}</Text></LinePressable></View>;
}
export function LineCollectPayout({ observedMm, triggerMm, source, windowLabel, amountLabel, walletLabel, onBack }: { observedMm: number | null; triggerMm: number | null; source: string; windowLabel: string | null; amountLabel: string | null; walletLabel: string | null; onBack: () => void }) {
  const max = Math.max(triggerMm ?? 0, observedMm ?? 0) * 1.15 || 1;
  return <View><View style={styles.head}><Text style={[ui.section, { fontFamily: "Inter_750", fontSize: 28 }]}>Collect payout</Text><Pill devnet/></View><LinePressable onPress={onBack} style={styles.textButton}><Text style={styles.link}>Back to markets</Text></LinePressable><Text style={ui.body}>No claims form. Verified station data hit your trigger, so the payout is ready.</Text><View style={styles.hero}><Text style={ui.figure}>Trigger hit · Verified · Collect</Text><View style={{ flexDirection: "row", marginTop: 16 }}><View style={{ flex: 1 }}><Text style={ui.label}>Observed</Text><Text style={[ui.figure, { fontSize: 32, lineHeight: 40 }]}>{observedMm ?? "—"} mm</Text></View><View><Text style={ui.label}>Trigger</Text><Text style={[ui.figure, { fontSize: 32, lineHeight: 40, color: C.slicker }]}>{triggerMm ?? "—"} mm</Text></View></View><View style={{ height: 8, backgroundColor: C.surface2, borderRadius: 4, marginVertical: 16 }}><View style={{ height: 8, borderRadius: 4, width: `${Math.min(1, Math.max(0, (observedMm ?? 0) / max)) * 100}%`, backgroundColor: C.glacier }}/></View><Text style={ui.label}>{source}{windowLabel ? ` · ${windowLabel}` : ""}</Text></View><View style={[styles.hero, { alignItems: "center", paddingVertical: 20 }]}><Text style={ui.label}>Payout</Text><Text style={[ui.figure, { fontFamily: "Inter_750", fontSize: 52, lineHeight: 60 }]}>{amountLabel ? `+${amountLabel}` : "—"}</Text><Text style={ui.label}>SKYT</Text>{walletLabel ? <Text style={[ui.label, { marginTop: 12 }]}>To {walletLabel}</Text> : null}</View><Text style={[ui.label, { marginTop: 16 }]}>One tap · approve once in your wallet via Mobile Wallet Adapter</Text></View>;
}
