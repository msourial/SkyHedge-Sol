import { useRef, useState, type ReactNode } from "react";
import { Clipboard, StyleSheet, Text, View } from "react-native";
import { Copy, CaretRight } from "phosphor-react-native";
import { perilById } from "../../../shared/peril-registry.ts";
import * as copy from "../../../shared/ui-copy.ts";
import { walletPerils, type ReceiptModel } from "../../../shared/ui-discovery.ts";
import type { CoverProgress } from "../api.ts";
import { useCoverProgress } from "./weather-hooks.ts";
import { CoverGauge } from "./CoverGauge.tsx";
import { CoverDetail } from "./CoverDetail.tsx";
import { lineTokens as C } from "../../../shared/ui-tokens.ts";
import { F } from "../theme.ts";
import { TabGlyph } from "./TabGlyph.tsx";
import { PerilAvatar } from "./PerilAvatar.tsx";
import { LinePressable } from "./pressable.tsx";
import { SplitBar } from "./payout-graphics.tsx";
import { EqualPair, Group, Pill, Row, lineType, ui } from "./primitives.tsx";
const number = (value: string | null) => Number((value ?? "0").replaceAll(",", ""));
const lossLabel = (value: string | null) => value == null ? "—" : `−${value}`;
const gainLabel = (value: string | null) => value == null ? "—" : `+${value}`;
const triggerLabel = (r: ReceiptModel) => r.trigger == null ? r.status : `${r.peril && perilById(r.peril)?.direction === "down" ? "≤" : "≥"} ${r.trigger} ${r.unit}`;
function receiptStatus(r: ReceiptModel) { return r.kind === "paid" ? "Paid out" : r.kind === "dry" ? "Expired" : r.kind === "refunded" ? "Refunded, NOAA data unavailable" : r.status; }
export function WalletLine({ wallet, balance, receipts, totals, loading, failed, onConnect, onRetry, onDisconnect, onMarkets, technical, progress: suppliedProgress, now, revision = 0, onCollect, transactions, focusMarket }: { wallet: string | null; balance: string | null; receipts: ReceiptModel[]; totals: { loss: string; gain: string } | null; loading: boolean; failed: boolean; onConnect: () => void; onRetry: () => void; onDisconnect: () => void; onMarkets: () => void; technical?: ReactNode; progress?: Record<string, CoverProgress | null>; now?: number; revision?: number; onCollect?: (market: string) => Promise<void>; transactions?: Record<string, string>; focusMarket?: string | null }) {
  const [selected, setSelected] = useState<string | null>(null), [details, setDetails] = useState(false);
  const [filter, setFilter] = useState<string | null>(null), [copyStatus, setCopyStatus] = useState<string | null>(null);
  const collectingRef = useRef(false);
  const [collecting, setCollecting] = useState(false), [collectError, setCollectError] = useState<string | null>(null);
  const collect = async (market: string) => {
    if (!onCollect || collectingRef.current) return;
    collectingRef.current = true;
    setCollecting(true); setCollectError(null);
    try { await onCollect(market); } catch (error) { setCollectError(error instanceof Error ? error.message : "Collection did not complete. Try again."); } finally { collectingRef.current = false; setCollecting(false); }
  };
  const receipt = receipts.find(r => r.id === selected);
  const active = receipts.filter(r => r.kind === "open"), perils = walletPerils(active), allPerils = walletPerils(receipts);
  const mixed = allPerils.length > 1;
  const visibleReceipts = receipts.filter(r => !filter || r.peril === filter).sort((a, b) => Number(b.market === focusMarket) - Number(a.market === focusMarket));
  const firstWindow = visibleReceipts[0];
  const commonWindow = firstWindow?.windowKey && firstWindow.windowLabel && visibleReceipts.every(r => r.windowKey === firstWindow.windowKey && r.windowLabel)
    ? firstWindow.windowLabel.replace(" to ", " – ") : null;
  const progress = useCoverProgress(receipts.map(r => r.market), suppliedProgress, revision);
  return <View>{collecting || collectError ? <Text accessibilityLiveRegion="polite" style={s.note}>{collectError ?? "Approve collection in Phantom…"}</Text> : null}{!receipt ? <View style={s.header}><Text style={s.title}>Wallet</Text><Pill devnet/></View> : null}
    {receipt ? <CoverDetail receipt={receipt} progress={progress[receipt.market]} now={now} signature={transactions?.[receipt.market]} onCollect={onCollect ? () => { void collect(receipt.market); } : undefined} onClose={() => setSelected(null)}/> : <>
      <View style={s.hero}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><View style={s.stack}>{perils.map((p, i) => <View key={p} style={{ marginLeft: i ? -10 : 0 }}><PerilAvatar peril={p} size={36}/></View>)}{!perils.length ? <TabGlyph name="wallet" size={32} color={C.fg2}/> : null}</View><View style={{ flex: 1 }}><Text style={ui.label}>Open covers · totals in SKYT</Text><Text style={s.count}>{wallet && (loading || failed) && !receipts.length ? "—" : wallet ? active.length : "0"}</Text></View></View>
        {wallet && active.length > 0 && totals ? <><SplitBar loss={number(totals.loss)} gain={number(totals.gain)}/><View style={{ marginTop: 12 }}><EqualPair loss={lossLabel(totals.loss)} gain={gainLabel(totals.gain)}/></View></> : wallet && active.length > 0 ? <View style={{ marginTop: 12 }}><EqualPair loss="—" gain="—"/></View> : null}
        {!wallet ? <><Text style={[ui.body, s.center, { marginVertical: 16 }]}>{copy.WALLET_INTRO}</Text><LinePressable onPress={onConnect} style={ui.cta}><Text style={ui.ctaText}>{copy.CONNECT_WALLET}</Text></LinePressable></> : !active.length && !loading && !failed ? <LinePressable onPress={onMarkets} style={[ui.cta, { marginTop: 18 }]}><Text style={ui.ctaText}>Find a market</Text></LinePressable> : null}
      </View>
      {loading ? <Text accessibilityLiveRegion="polite" style={s.note}>{copy.READING_WALLET}</Text> : null}
      {failed ? <Group style={{ marginTop: 12 }}><Row><Text accessibilityRole="alert" style={[ui.body, { flex: 1 }]}>{copy.CHAIN_ERROR}</Text><LinePressable onPress={onRetry} style={s.action}><Text style={s.link}>{copy.TRY_AGAIN}</Text></LinePressable></Row></Group> : null}
      {wallet ? <>
        {mixed ? <View style={s.filters}>{[{ id: null, label: "All" }, ...allPerils.map(p => ({ id: p, label: perilById(p)!.label }))].map(p => <LinePressable key={p.id ?? "all"} onPress={() => setFilter(p.id)} accessibilityState={{ selected: filter === p.id }} style={[s.filter, filter === p.id && { backgroundColor: C.bgRaised }]}><Text style={ui.label}>{p.label}</Text></LinePressable>)}</View> : null}
        {visibleReceipts.length ? <>
          <View style={s.section}><Text style={ui.section}>Your covers</Text>{commonWindow ? <Text numberOfLines={1} style={[ui.label, { flexShrink: 1, textAlign: "right" }]}>{[!mixed && allPerils[0] ? perilById(allPerils[0])?.label : null, commonWindow].filter(Boolean).join(" · ")}</Text> : null}</View>
          <Group><View style={s.columnHeader}><Text style={[ui.label, { flex: 1 }]}>So far vs trigger</Text><View style={s.values}><Text style={s.columnLabel}>Max loss</Text><Text style={s.columnLabel}>Max gain</Text></View></View>{visibleReceipts.map(r => <WalletCoverRow key={r.id} receipt={r} progress={progress[r.market]} now={now} mixed={mixed} commonWindow={commonWindow} paidAccent={r.id === visibleReceipts.find(item => item.kind === "paid")?.id} onPress={() => setSelected(r.id)} onCollect={onCollect ? () => { void collect(r.market); } : undefined}/>)}</Group>
        </> : !loading && !failed ? <Text style={s.note}>{copy.EMPTY_COVERS}</Text> : null}
      </> : null}
      <Row onPress={() => setDetails(!details)} style={{ marginTop: 22, paddingHorizontal: 4 }}><Text style={[ui.body, { flex: 1, fontFamily: F.bodySemi }]}>{copy.TECHNICAL_DETAILS}</Text><CaretRight size={16} color={C.dryText} weight="bold"/></Row>
      {details ? <Group><View style={{ padding: 14 }}><Text style={s.note}>{copy.CONTRACT_LABEL}</Text><Text style={s.note}>{copy.SETTLED_UNITS}</Text><Text style={s.note}>{copy.TECH_CONTEXT}</Text>{technical}{wallet ? <><Text style={ui.label}>{copy.BALANCE} {balance ?? "—"} SKYT</Text><Row><Text selectable style={[ui.body, { flex: 1 }]}>{wallet.slice(0,4)}…{wallet.slice(-4)}</Text><LinePressable accessibilityLabel={copy.COPY_ADDRESS} onPress={() => { try { Clipboard.setString(wallet); setCopyStatus(copy.COPIED); } catch { setCopyStatus(copy.COPY_FAILED); } }} style={s.action}><Copy size={20} weight="bold" color={C.glacier}/></LinePressable></Row>{copyStatus ? <Text accessibilityLiveRegion="polite" style={ui.label}>{copyStatus}</Text> : null}<Row onPress={onDisconnect}><Text style={s.link}>{copy.DISCONNECT}</Text></Row></> : null}</View></Group> : null}
    </>}
  </View>;
}
export function WalletCoverRow({ receipt: r, progress, now, mixed = false, commonWindow = null, paidAccent = false, onPress, onCollect }: { receipt: ReceiptModel; progress?: CoverProgress | null; now?: number; mixed?: boolean; commonWindow?: string | null; paidAccent?: boolean; onPress: () => void; onCollect?: () => void }) {
  return <LinePressable accessibilityRole="button" accessibilityLabel={`View ${r.title}`} onPress={onPress}><Row height={64} style={s.coverRow}>
            <View style={s.coverDivider}/>{r.peril ? <PerilAvatar peril={r.peril} size={36}/> : <TabGlyph name="wallet" size={36} color={C.fg2}/>}
            <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.85} style={ui.figure}>{triggerLabel(r)}</Text><Text style={[ui.label, { marginTop: 2 }]}>{mixed ? `${r.peril ? perilById(r.peril)?.label : "Weather"} · ${r.city}` : r.city}{!commonWindow && r.windowLabel ? `\n${r.windowLabel.replace(" to ", " – ")}` : ""}</Text></View>

            {r.kind === "pending" && r.status === "Payout ready" ? <LinePressable onPress={event => { event.stopPropagation(); if (onCollect) onCollect(); else onPress(); }} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.glacier }}><Text style={[ui.figure, { color: C.bg, fontSize: 15 }]}>Collect {r.payout ?? ""}</Text></LinePressable> : r.kind === "open" || r.kind === "pending" ? <View style={s.values}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={13 / 15} style={s.amount}>{lossLabel(r.loss)}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={13 / 15} style={s.amount}>{gainLabel(r.gain)}</Text></View> : <View style={[s.values, { flexDirection: "column", alignItems: "flex-end" }]}>{r.kind !== "refunded" ? <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={13 / 15} style={[s.amount, { width: "100%", color: r.kind === "paid" && paidAccent ? C.slicker : C.fg2 }]}>{r.kind === "paid" ? `+${r.payout ?? "—"} SKYT` : r.kind === "dry" ? lossLabel(r.loss) : r.result ?? "—"}</Text> : null}<Text style={[ui.label, { textAlign: "right" }]}>{receiptStatus(r)}</Text></View>}
          </Row><CoverGauge receipt={r} progress={progress} now={now}/></LinePressable>;
}
const s = StyleSheet.create({
  header: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, title: { ...lineType, color: C.fg, fontFamily: "Inter_750", fontSize: 28, letterSpacing: -.6 },
  hero: { backgroundColor: C.surface1, borderRadius: 24, marginTop: 8, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 16 }, stack: { flexDirection: "row", alignItems: "center", height: 36 }, center: { textAlign: "center" }, count: { ...lineType, color: C.fg, fontFamily: "Inter_750", fontSize: 28, lineHeight: 34, letterSpacing: -.6 },
  section: { marginTop: 28, marginBottom: 10, marginHorizontal: 4, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }, columnHeader: { height: 36, paddingHorizontal: 14, flexDirection: "row", alignItems: "center" }, values: { width: 122, flexDirection: "row" }, columnLabel: { ...ui.label, flex: 1, textAlign: "right" }, amount: { ...ui.figure, flex: 1, fontSize: 15, lineHeight: 20, textAlign: "right" }, coverRow: { minHeight: 64, paddingVertical: 8 }, coverDivider: { position: "absolute", top: 0, left: 66, right: 0, height: 1, backgroundColor: C.divider },
  note: { ...ui.body, fontSize: 13, marginVertical: 12 }, link: { ...ui.figure, color: C.glacier, fontSize: 15 }, action: { minHeight: 48, minWidth: 48, justifyContent: "center", alignItems: "center" }, filters: { flexDirection: "row", marginTop: 12, flexWrap: "wrap", gap: 8 }, filter: { minHeight: 48, paddingHorizontal: 14, justifyContent: "center", borderRadius: 999, backgroundColor: C.surface1 },
});
