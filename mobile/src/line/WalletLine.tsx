import { useState, type ReactNode } from "react";
import { Clipboard, StyleSheet, Text, View } from "react-native";
import { Copy, CaretRight } from "phosphor-react-native";
import { perilById } from "../../../shared/peril-registry.ts";
import * as copy from "../../../shared/ui-copy.ts";
import { walletPerils, type ReceiptModel } from "../../../shared/ui-discovery.ts";
import { payoffDomain } from "../../../shared/ui-payoff.ts";
import { lineTokens as C } from "../../../shared/ui-tokens.ts";
import { F } from "../theme.ts";
import { TabGlyph } from "./TabGlyph.tsx";
import { PerilAvatar } from "./PerilAvatar.tsx";
import { LinePressable } from "./pressable.tsx";
import { CoverSparkline, SplitBar } from "./payout-graphics.tsx";
import { EqualPair, Group, Pill, Row, lineType, ui } from "./primitives.tsx";
const number = (value: string | null) => Number((value ?? "0").replaceAll(",", ""));
const lossLabel = (value: string | null) => value == null ? "—" : `−${value}`;
const gainLabel = (value: string | null) => value == null ? "—" : `+${value}`;
const triggerLabel = (r: ReceiptModel) => r.trigger == null ? r.status : `${r.peril && perilById(r.peril)?.direction === "down" ? "≤" : "≥"} ${r.trigger} ${r.unit}`;
function receiptStatus(r: ReceiptModel) { return r.kind === "paid" ? "Paid out" : r.kind === "dry" ? "Expired" : r.kind === "refunded" ? "Refunded, NOAA data unavailable" : r.status; }
export function WalletLine({ wallet, balance, receipts, totals, loading, failed, onConnect, onRetry, onDisconnect, onMarkets, technical }: { wallet: string | null; balance: string | null; receipts: ReceiptModel[]; totals: { loss: string; gain: string } | null; loading: boolean; failed: boolean; onConnect: () => void; onRetry: () => void; onDisconnect: () => void; onMarkets: () => void; technical?: ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null), [details, setDetails] = useState(false);
  const [filter, setFilter] = useState<string | null>(null), [copyStatus, setCopyStatus] = useState<string | null>(null);
  const receipt = receipts.find(r => r.id === selected);
  const active = receipts.filter(r => r.kind === "open"), perils = walletPerils(active), allPerils = walletPerils(receipts);
  const mixed = allPerils.length > 1;
  const visibleReceipts = receipts.filter(r => !filter || r.peril === filter);
  const firstWindow = visibleReceipts[0];
  const commonWindow = firstWindow?.windowKey && firstWindow.windowLabel && visibleReceipts.every(r => r.windowKey === firstWindow.windowKey && r.windowLabel)
    ? firstWindow.windowLabel.replace(" to ", " – ") : null;
  const domain = payoffDomain(receipts.map(r => ({ loss: number(r.loss), gain: number(r.gain) })));
  return <View><View style={s.header}><Text style={s.title}>Wallet</Text><Pill devnet/></View>
    {receipt ? <Receipt receipt={receipt} domain={domain} onClose={() => setSelected(null)}/> : <>
      <View style={s.hero}>
        <View style={s.stack}>{perils.map((p, i) => <View key={p} style={{ marginLeft: i ? -10 : 0, borderRadius: 18, borderWidth: mixed ? 2 : 0, borderColor: C.surface1 }}><PerilAvatar peril={p} size={32}/></View>)}{!perils.length ? <TabGlyph name="wallet" size={32} color={C.fg2}/> : null}</View>
        <Text style={[ui.label, s.center, { marginTop: 10, lineHeight: 20 }]}>Open covers</Text><Text style={s.count}>{wallet && (loading || failed) && !receipts.length ? "—" : wallet ? active.length : "0"}</Text><Text style={[ui.label, s.center]}>Totals in SKYT</Text>
        {wallet && active.length > 0 && totals ? <><SplitBar loss={number(totals.loss)} gain={number(totals.gain)}/><View style={{ marginTop: 12 }}><EqualPair loss={lossLabel(totals.loss)} gain={gainLabel(totals.gain)}/></View></> : wallet && active.length > 0 ? <View style={{ marginTop: 12 }}><EqualPair loss="—" gain="—"/></View> : null}
        {!wallet ? <><Text style={[ui.body, s.center, { marginVertical: 16 }]}>{copy.WALLET_INTRO}</Text><LinePressable onPress={onConnect} style={ui.cta}><Text style={ui.ctaText}>{copy.CONNECT_WALLET}</Text></LinePressable></> : !active.length && !loading && !failed ? <LinePressable onPress={onMarkets} style={[ui.cta, { marginTop: 18 }]}><Text style={ui.ctaText}>Find a market</Text></LinePressable> : null}
      </View>
      {loading ? <Text accessibilityLiveRegion="polite" style={s.note}>{copy.READING_WALLET}</Text> : null}
      {failed ? <Group style={{ marginTop: 12 }}><Row><Text accessibilityRole="alert" style={[ui.body, { flex: 1 }]}>{copy.CHAIN_ERROR}</Text><LinePressable onPress={onRetry} style={s.action}><Text style={s.link}>{copy.TRY_AGAIN}</Text></LinePressable></Row></Group> : null}
      {wallet ? <>
        {mixed ? <View style={s.filters}>{[{ id: null, label: "All" }, ...allPerils.map(p => ({ id: p, label: perilById(p)!.label }))].map(p => <LinePressable key={p.id ?? "all"} onPress={() => setFilter(p.id)} accessibilityState={{ selected: filter === p.id }} style={[s.filter, filter === p.id && { backgroundColor: C.bgRaised }]}><Text style={ui.label}>{p.label}</Text></LinePressable>)}</View> : null}
        {visibleReceipts.length ? <>
          <View style={s.section}><Text style={ui.section}>Your covers</Text>{commonWindow ? <Text numberOfLines={1} style={[ui.label, { flexShrink: 1, textAlign: "right" }]}>{[!mixed && allPerils[0] ? perilById(allPerils[0])?.label : null, commonWindow].filter(Boolean).join(" · ")}</Text> : null}</View>
          <Group><View style={s.columnHeader}><View style={{ flex: 1 }}/><View style={s.values}><Text style={s.columnLabel}>Max loss</Text><Text style={s.columnLabel}>Max gain</Text></View></View>{visibleReceipts.map(r => <Row key={r.id} height={64} onPress={() => setSelected(r.id)} style={s.coverRow}>
            <View style={s.coverDivider}/>{r.peril ? <PerilAvatar peril={r.peril} size={36}/> : <TabGlyph name="wallet" size={36} color={C.fg2}/>}
            <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.85} style={ui.figure}>{triggerLabel(r)}</Text><Text style={[ui.label, { marginTop: 2 }]}>{mixed ? `${r.peril ? perilById(r.peril)?.label : "Weather"} · ${r.city}` : r.city}{!commonWindow && r.windowLabel ? `\n${r.windowLabel.replace(" to ", " – ")}` : ""}</Text></View>
            <CoverSparkline available={r.loss != null && r.gain != null && r.peril != null} loss={number(r.loss)} gain={number(r.gain)} domain={domain} peril={r.peril ?? "rain"} state={r.kind}/>
            {r.kind === "open" || r.kind === "pending" ? <View style={s.values}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={13 / 15} style={s.amount}>{lossLabel(r.loss)}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={13 / 15} style={s.amount}>{gainLabel(r.gain)}</Text></View> : <View style={[s.values, { flexDirection: "column", alignItems: "flex-end" }]}>{r.kind !== "refunded" ? <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={13 / 15} style={[s.amount, { width: "100%", color: r.kind === "paid" ? C.slicker : C.fg2 }]}>{r.kind === "paid" ? `${r.payout ?? "—"} SKYT` : r.kind === "dry" ? lossLabel(r.loss) : r.result ?? "—"}</Text> : null}<Text style={[ui.label, { textAlign: "right" }]}>{receiptStatus(r)}</Text></View>}
          </Row>)}</Group>
        </> : !loading && !failed ? <Text style={s.note}>{copy.EMPTY_COVERS}</Text> : null}
      </> : null}
      <Row onPress={() => setDetails(!details)} style={{ marginTop: 22, paddingHorizontal: 4 }}><Text style={[ui.body, { flex: 1, fontFamily: F.bodySemi }]}>{copy.TECHNICAL_DETAILS}</Text><CaretRight size={16} color={C.dryText} weight="bold"/></Row>
      {details ? <Group><View style={{ padding: 14 }}><Text style={s.note}>{copy.CONTRACT_LABEL}</Text><Text style={s.note}>{copy.SETTLED_UNITS}</Text><Text style={s.note}>{copy.TECH_CONTEXT}</Text>{technical}{wallet ? <><Text style={ui.label}>{copy.BALANCE} {balance ?? "—"} SKYT</Text><Row><Text selectable style={[ui.body, { flex: 1 }]}>{wallet.slice(0,4)}…{wallet.slice(-4)}</Text><LinePressable accessibilityLabel={copy.COPY_ADDRESS} onPress={() => { try { Clipboard.setString(wallet); setCopyStatus(copy.COPIED); } catch { setCopyStatus(copy.COPY_FAILED); } }} style={s.action}><Copy size={20} weight="bold" color={C.glacier}/></LinePressable></Row>{copyStatus ? <Text accessibilityLiveRegion="polite" style={ui.label}>{copyStatus}</Text> : null}<Row onPress={onDisconnect}><Text style={s.link}>{copy.DISCONNECT}</Text></Row></> : null}</View></Group> : null}
    </>}
  </View>;
}
function Receipt({ receipt: r, domain, onClose }: { receipt: ReceiptModel; domain: { loss: number; gain: number }; onClose: () => void }) { return <View><LinePressable onPress={onClose} style={s.action}><Text style={s.link}>Done</Text></LinePressable><Text style={ui.section}>{r.title}</Text><Text style={[ui.body, { marginVertical: 12, color: r.kind === "paid" ? C.slicker : C.fg2 }]}>{receiptStatus(r)}</Text><View style={{ alignItems: "center", marginVertical: 16, gap: 16 }}>{r.peril ? <PerilAvatar peril={r.peril} size={44}/> : null}<Text style={ui.figure}>{triggerLabel(r)}</Text><CoverSparkline available={r.loss != null && r.gain != null && r.peril != null} loss={number(r.loss)} gain={number(r.gain)} domain={domain} peril={r.peril ?? "rain"} state={r.kind}/></View>{r.loss && r.gain ? <EqualPair loss={lossLabel(r.loss)} gain={gainLabel(r.gain)}/> : null}<Group style={{ marginTop: 16 }}>{[["Window", r.windowLabel], ["Final reading", r.reading == null ? copy.FINAL_READING_UNAVAILABLE : `${r.reading} ${r.unit}`], ["NOAA window ended", r.settled], ["Payout", `${r.payout ?? "—"} SKYT`], ["Result", r.result]].filter(([,v]) => v).map(([label,value],i) => <Row key={label} divider={i > 0}><Text style={[ui.body, { flex: 1 }]}>{label}</Text><Text style={[ui.figure, { fontSize: 15, color: label === "Payout" && r.kind === "paid" ? C.slicker : C.fg, flexShrink: 1 }]}>{value}</Text></Row>)}</Group>{!r.diagram ? <Text style={s.note}>{copy.RECEIPT_DATA_UNAVAILABLE}</Text> : null}<Text selectable style={s.note}>{r.station} · {r.market}</Text></View>; }
const s = StyleSheet.create({
  header: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, title: { ...lineType, color: C.fg, fontFamily: "Inter_750", fontSize: 28, letterSpacing: -.6 },
  hero: { backgroundColor: C.surface1, borderRadius: 24, marginTop: 8, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 16 }, stack: { flexDirection: "row", justifyContent: "center", height: 32 }, center: { textAlign: "center" }, count: { ...lineType, color: C.fg, fontFamily: "Inter_750", fontSize: 52, lineHeight: 58, letterSpacing: -1.6, textAlign: "center" },
  section: { marginTop: 28, marginBottom: 10, marginHorizontal: 4, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }, columnHeader: { height: 36, paddingHorizontal: 14, flexDirection: "row", alignItems: "center" }, values: { width: 122, flexDirection: "row" }, columnLabel: { ...ui.label, flex: 1, textAlign: "right" }, amount: { ...ui.figure, flex: 1, fontSize: 15, lineHeight: 20, textAlign: "right" }, coverRow: { minHeight: 64, paddingVertical: 8 }, coverDivider: { position: "absolute", top: 0, left: 66, right: 0, height: 1, backgroundColor: C.divider },
  note: { ...ui.body, fontSize: 13, marginVertical: 12 }, link: { ...ui.figure, color: C.glacier, fontSize: 15 }, action: { minHeight: 48, minWidth: 48, justifyContent: "center", alignItems: "center" }, filters: { flexDirection: "row", marginTop: 12, flexWrap: "wrap", gap: 8 }, filter: { minHeight: 48, paddingHorizontal: 14, justifyContent: "center", borderRadius: 999, backgroundColor: C.surface1 },
});
