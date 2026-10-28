import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cityById, perilById } from "../../../shared/peril-registry.ts";
import * as copy from "../../../shared/ui-copy.ts";
import { citySheetRows, coldCard, countdown, elsewhereCards, featuredCity, marketsLayout as L, marketsMotion as M, marketsPanel, moreInCity, pendingCards, type OpenCard, type PendingCard, type PreviewSelection } from "../../../shared/ui-markets.ts";
import type { MarketModel, MarketSelection, ReceiptModel } from "../../../shared/ui-discovery.ts";
import type { QuoteWindow } from "../../../shared/ui-window-quote.ts";
import { instrumentArt } from "../../../shared/ui-instrument.ts";
import { lineGlyphs } from "../../../shared/ui-glyphs.ts";
import { lineTokens as C } from "../../../shared/ui-tokens.ts";
import type { PerilId } from "../../../shared/ui-types.ts";
import { LineArt } from "./art.tsx";
import { F } from "../theme.ts";
import { useReducedMotion } from "../liquid-glass.tsx";
import { SpringPress } from "../motion.tsx";

function Glyph({ name, size = 24 }: { name: keyof typeof lineGlyphs; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>{lineGlyphs[name].map((d) => <Path key={d} d={d} stroke={C.fg2} strokeWidth={1.75} fill="none" strokeLinecap="round"/>)}</Svg>;
}
function Tick() { return <Svg width={16} height={16} viewBox="0 0 24 24" accessible={false}><Path d="M5 12.5l4.2 4.2L19 7" stroke={C.fg2} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round"/></Svg>; }

/** Presentation transitions wrap content; instruments and controls keep full contrast. */
function Reveal({ children, delay = 0, rise = false, duration = M.city, changeKey }: { children: ReactNode; delay?: number; rise?: boolean; duration?: number; changeKey?: string }) {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    value.setValue(reduced ? 1 : 0);
    const animation = Animated.timing(value, { toValue: 1, duration: reduced ? 0 : duration, delay: reduced ? 0 : delay, easing: Easing.bezier(.23, 1, .32, 1), useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [value, reduced, duration, delay, changeKey]);
  return <Animated.View style={{ opacity: value, transform: [{ translateY: rise ? value.interpolate({ inputRange: [0, 1], outputRange: [M.rise, 0] }) : 0 }] }}>{children}</Animated.View>;
}
function MarketInstrument({ peril, market, tile = false, drawLine = true }: { peril: PerilId; market?: { rungs: number[]; trigger: number }; tile?: boolean; drawLine?: boolean }) {
  const reduced = useReducedMotion();
  const line = useRef(new Animated.Value(1)).current;
  const art = instrumentArt({ peril, rungs: market?.rungs ?? [], selected: market?.trigger ?? null, reading: null, state: "idle", size: tile ? "tile" : "hero", unit: perilById(peril)?.unit ?? "" });
  // The circular wind dial is 112dp wide in the art. Fit it uniformly to its
  // reserved column; capsule scaling would let it paint over the numeral.
  const scale = peril === "wind" ? tile ? L.card.windInstrumentScale : L.hero.windInstrumentScale : tile ? L.card.instrumentScale : L.hero.instrumentScale;
  const artTop = peril === "wind" ? ((tile ? 104 : L.hero.instrumentHeight) - 136 * scale) / 2 : 0;
  const artLeft = peril === "wind" ? ((tile ? 44 : L.hero.instrumentWidth) - 120 * scale) / 2 : -16 * scale;
  const triggerY = art.anchorY == null ? null : art.anchorY * scale + artTop;
  const ops = art.ops.filter((op) => op.op !== "text" && !(op.op === "line" && op.stroke === C.slicker) && !(op.op === "rect" && op.fill === C.slicker))
    .map((op) => "stroke" in op && op.stroke === C.tick ? { ...op, stroke: C.fg2 } : op);
  useEffect(() => {
    line.setValue(reduced || !drawLine ? 1 : 0);
    const animation = Animated.timing(line, { toValue: 1, duration: reduced || !drawLine ? 0 : tile ? M.cardLine : M.heroLine, easing: Easing.bezier(.23, 1, .32, 1), useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [line, reduced, tile, drawLine]);
  return <View style={tile ? s.tileInstrument : s.heroInstrument}>
    <View style={{ position: "absolute", left: artLeft, top: artTop }}>
      <LineArt ops={ops} viewBox={art.viewBox} width={(peril === "wind" ? 120 : 104) * scale} height={156 * scale} label={art.label}/>
    </View>
    {triggerY != null ? <Animated.View pointerEvents="none" style={{ position: "absolute", left: tile ? L.card.lineStart : L.hero.lineStart - L.margin, top: triggerY - 1, height: 2, width: tile ? L.card.lineEnd - L.card.lineStart : L.hero.lineEnd - L.hero.lineStart, backgroundColor: C.slicker, transformOrigin: "left", transform: [{ scaleX: line }] }}/> : null}
    {!tile ? <Text style={s.reading}>{copy.zeroLabel(perilById(peril)?.unit ?? "")}</Text> : null}
  </View>;
}
function Countdown({ salesCloseAt, nowSeconds }: { salesCloseAt: string; nowSeconds: number }) {
  const [now, setNow] = useState(nowSeconds * 1000);
  const clock = useRef(nowSeconds);
  clock.current = nowSeconds;
  const live = Date.parse(salesCloseAt) - nowSeconds * 1000 < 48 * 3600000;
  useEffect(() => {
    setNow(clock.current * 1000);
    if (!live) return;
    const timer = setInterval(() => setNow(clock.current * 1000), 60000);
    return () => clearInterval(timer);
  }, [salesCloseAt, live]);
  return <Text style={s.label}>{countdown(salesCloseAt, now)}</Text>;
}
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
    <View style={s.modal}><Pressable accessible={false} onPress={onClose} style={s.scrim}/><View accessibilityViewIsModal style={[s.sheet, { maxHeight: height * .88, paddingBottom: Math.max(16, insets.bottom) }]}>
      <View style={s.handle}/><Text accessibilityRole="header" style={s.sheetTitle}>{title}</Text>{children}
      <Pressable accessibilityRole="button" onPress={onClose} style={s.sheetClose}><Text style={s.link}>{copy.CLOSE}</Text></Pressable>
    </View></View>
  </Modal>;
}
function Hero({ panel, onSelect, onPreview, onWallet, nowSeconds, animate = true }: { panel: ReturnType<typeof marketsPanel>; onSelect: (m: MarketSelection) => void; onPreview: (p: PreviewSelection) => void; onWallet: () => void; nowSeconds: number; animate?: boolean }) {
  if (panel.kind === "city-not-open") return <View style={s.cityPanel}><MarketInstrument peril={panel.peril}/><View style={s.heroText}><Text style={s.strong}>{panel.title}</Text><Text style={[s.body, s.secondary]}>{panel.status}</Text>{panel.selection ? <Pressable accessibilityRole="button" onPress={() => onPreview(panel.selection!)} style={[s.cta, s.outlined]}><Text style={[s.ctaText, s.foreground]}>{panel.cta}</Text></Pressable> : null}</View></View>;
  if (panel.kind !== "loading" && panel.kind !== "open" && panel.kind !== "held-receipt-hero") return null;
  const m = panel.kind === "loading" ? null : panel.market;
  const held = panel.kind === "held-receipt-hero";
  const stats = m ? held ? [{ label: copy.MAX_LOSS, value: `-${m.loss}` }, { label: copy.MAX_GAIN, value: `+${m.gain}` }] : [{ label: copy.CHANCE, value: m.chance }, { label: copy.MULTIPLE, value: m.multiple }, { label: copy.MAX_LOSS, value: `-${m.loss}` }] : panel.kind === "loading" ? panel.stats : [];
  return <><View style={s.hero}>
    <View style={s.heroContent}><MarketInstrument key={m?.id ?? "loading"} peril={m?.peril ?? "rain"} market={m ? { rungs: m.rungs, trigger: m.trigger } : undefined} drawLine={animate}/><View style={s.heroText}>
      {m ? <><View style={s.titleLine}>{held ? <Tick/> : <Glyph name={m.peril} size={20}/>}<Text numberOfLines={1} style={s.strong}>{held ? copy.COVERED_WORD : `${perilById(m.peril)?.label} · ${m.station}`}</Text></View><Countdown salesCloseAt={m.quote.salesCloseAt} nowSeconds={nowSeconds}/></> : <View style={{ height: 40 }}/>}
      <View style={s.numeralLine}><View style={s.heroNumberSlot}><Reveal duration={M.numeral} changeKey={m?.id}><Text adjustsFontSizeToFit minimumFontScale={56 / 72} numberOfLines={1} style={[s.heroNumeral, !m && s.secondary]}>{m ? String(m.trigger) : "--"}</Text></Reveal></View>{m ? <Text style={s.unit}>{m.unit}</Text> : null}</View>
      {panel.kind === "open" || panel.kind === "held-receipt-hero" ? <Text style={s.sentence}>{panel.sentence}</Text> : null}
    </View></View>
    <View style={s.stats}>{stats.map((item) => <View key={item.label} style={s.stat}><Text style={s.label}>{item.label}</Text><Text style={[s.statValue, held && item.label === copy.MAX_GAIN && s.payout]}>{item.value}</Text></View>)}</View>
    <Pressable accessibilityRole="button" disabled={!m} accessibilityState={{ disabled: !m }} onPress={() => { if (m) held ? onWallet() : onSelect(m); }} style={[s.cta, held && s.outlined]}><Text style={[s.ctaText, held && s.foreground]}>{panel.cta}</Text></Pressable>
  </View>{panel.kind === "held-receipt-hero" ? <Text style={s.receiptNote}>{panel.note}</Text> : null}</>;
}
function Card({ card, onSelect, onPreview, onCold, index, animate, drawLine }: { card: OpenCard | PendingCard | typeof coldCard; onSelect: (m: MarketSelection) => void; onPreview: (p: PreviewSelection) => void; onCold: () => void; index: number; animate: boolean; drawLine: boolean }) {
  const firstLine = useRef(drawLine).current;
  const open = card.kind === "open", pending = card.kind === "pending";
  return <View style={s.cardSlot}><Reveal rise={animate} duration={animate ? M.card : M.city} delay={animate ? Math.min(index, M.maxSteps - 1) * M.stagger : 0}>
    <SpringPress accessibilityRole="button" accessibilityLabel={`${card.label}, ${card.city}, ${card.kind === "open" ? `${card.trigger} ${card.unit}, ${card.footer}` : card.status}`} pressMotion={{ scale: M.pressScale, inMs: M.pressIn, outMs: M.pressOut }} onPress={() => open ? onSelect(card.selection) : pending ? onPreview(card.selection) : onCold()} style={s.card}>
      <Text style={s.cardTitle}>{card.label}</Text><Text style={s.label}>{card.city}</Text>
      <View style={s.cardBody}><MarketInstrument peril={card.peril} tile market={open ? { rungs: card.rungs, trigger: card.selection.trigger } : undefined} drawLine={firstLine}/><View style={s.cardFigure}>
        {open ? <><Text adjustsFontSizeToFit minimumFontScale={1} numberOfLines={1} style={s.cardNumeral}>{card.trigger}</Text><Text style={s.label}>{card.unit}</Text></> : pending && card.month ? <><Text style={s.label}>{copy.FROM}</Text><Text style={[s.cardNumeral, s.foreground]}>{card.month}</Text></> : <Text style={[s.body, s.secondary]}>{pending ? copy.NOT_OPEN_YET : card.status}</Text>}
      </View></View>
      <View style={s.cardFooter}><Text style={[s.label, s.footerCopy]}>{card.footer}</Text>{open ? card.held ? <Tick/> : null : <Glyph name="chevron" size={16}/>}</View>
    </SpringPress>
  </Reveal></View>;
}
export function MarketsLine({ markets, receipts, totals, loading, failed, reason, onSelect, onPreview, onWallet, onRetry, selectedCity, onCity, quoteWindows = [], nowSeconds = 0 }: {
  markets: MarketModel[]; receipts: ReceiptModel[]; totals?: { loss: string; gain: string } | null; loading: boolean; failed: boolean; reason?: string;
  onSelect: (m: MarketSelection) => void; onPreview: (p: PreviewSelection) => void; onWallet: () => void; onRetry: () => void; selectedCity: string | null; onCity: (city: string) => void; quoteWindows?: readonly QuoteWindow[]; nowSeconds?: number;
}) {
  const [sheet, setSheet] = useState<"city" | "cold" | null>(null);
  const startedLoading = useRef(loading).current;
  const [citySwitches, setCitySwitches] = useState(0);
  const seenLines = useRef(new Set<string>()).current;
  const city = selectedCity ?? (loading ? "new-york" : featuredCity(markets, quoteWindows, undefined, nowSeconds));
  const name = cityById(city)?.name ?? city;
  const pending = pendingCards(markets, quoteWindows, nowSeconds);
  const panel = marketsPanel({ cityId: city, markets, pending, loading, failed, reason, receipts });
  const rows = moreInCity(city, markets, quoteWindows, nowSeconds);
  const cards = elsewhereCards(city, markets);
  const active = receipts.filter((r) => r.kind === "open");
  const sheetRows = citySheetRows(markets, quoteWindows);
  const lineIds = cards.map((c) => c.id).join("|");
  const lineFirst = new Set(cards.filter((c) => !seenLines.has(c.id)).map((c) => c.id));
  useEffect(() => { for (const id of lineIds.split("|")) if (id) seenLines.add(id); }, [lineIds, seenLines]);
  return <View>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel={`${copy.CHOOSE_CITY}, ${name}`} accessibilityState={{ expanded: sheet === "city" }} onPress={() => setSheet("city")} style={s.cityButton}><Text numberOfLines={1} style={s.cityName}>{name}</Text><View style={s.downChevron}><Glyph name="chevron" size={20}/></View></Pressable><Text style={s.label}>{copy.DEVNET_TAG}</Text></View>
    {active.length ? <Pressable accessibilityRole="button" onPress={onWallet} style={s.covers}><Text style={s.coverCount}>{copy.openCoversCount(active.length)}</Text>{totals ? <View style={s.coverFigures}><View><Text style={s.label}>{copy.MAX_LOSS}</Text><Text style={s.smallMono}>-{totals.loss}</Text></View><View><Text style={s.label}>{copy.MAX_GAIN}</Text><Text style={[s.smallMono, s.payout]}>+{totals.gain}</Text></View></View> : null}<Glyph name="chevron" size={20}/></Pressable> : null}
    <Reveal changeKey={`${city}-${loading}`}>
      {failed && markets.length ? <Text accessibilityRole="alert" style={s.label}>{copy.MARKETS_PARTIAL}</Text> : null}
      {panel.kind === "error" ? <View accessibilityRole="alert" style={s.message}><Text style={s.strong}>{panel.title}</Text>{panel.reason ? <Text style={s.label}>{panel.reason}</Text> : null}<Pressable accessibilityRole="button" onPress={onRetry} style={s.retry}><Text style={s.link}>{panel.cta}</Text></Pressable></View> : panel.kind === "empty" ? <Text style={[s.strong, s.message]}>{panel.title}</Text> : <Hero key={city} panel={panel} onSelect={onSelect} onPreview={onPreview} onWallet={onWallet} nowSeconds={nowSeconds} animate={!startedLoading || citySwitches > 0}/>}

      {panel.kind === "open" || panel.kind === "held-receipt-hero" ? panel.honesty ? <Text style={s.label}>{panel.honesty}</Text> : null : null}
      {loading ? <View style={[s.grid, s.loadingGrid]}>{Array.from({ length: 4 }, (_, i) => <View key={i} style={[s.cardSlot, s.cardShell]}/>)}</View> : <>
        {rows.length && panel.kind !== "error" ? <><Text style={s.zone}>{copy.moreInCityLabel(name)}</Text>{rows.map((row) => <SpringPress key={row.id} accessibilityRole="button" pressMotion={{ scale: M.pressScale, inMs: M.pressIn, outMs: M.pressOut }} onPress={() => row.kind === "open" ? onSelect(row.selection) : onPreview(row.selection)} style={s.row}>
          <Glyph name={row.peril}/><View style={s.rowMain}>{row.kind === "open" ? <Text numberOfLines={1} style={s.rowTrigger}>{row.trigger} <Text style={s.rowEnd}>{row.end}</Text></Text> : <Text style={s.rowEnd}>{row.label}</Text>}</View><View style={s.rowStatus}><Text style={s.label}>{row.status}</Text>{row.kind === "open" && row.held ? <Tick/> : null}</View><Glyph name="chevron" size={20}/>
        </SpringPress>)}</> : null}
        {cards.length ? <><Text style={s.zone}>{copy.OPEN_ELSEWHERE}</Text><View style={s.grid}>{cards.map((card, index) => <Card key={card.id} card={card} index={index} animate={!startedLoading && citySwitches === 0} drawLine={!startedLoading && lineFirst.has(card.id)} onSelect={onSelect} onPreview={onPreview} onCold={() => setSheet("cold")}/>)}</View></> : null}
        {panel.kind !== "empty" ? <><Text style={s.zone}>{copy.COMING_UP}</Text><View style={s.grid}>{[...pending.filter((p) => p.cityId !== city || panel.kind === "error"), coldCard].map((card, index) => <Card key={card.id} card={card} index={index + cards.length} animate={!startedLoading && citySwitches === 0} drawLine={false} onSelect={onSelect} onPreview={onPreview} onCold={() => setSheet("cold")}/>)}</View></> : null}
      </>}
    </Reveal>
    {sheet === "city" ? <Sheet title={copy.CHOOSE_CITY} onClose={() => setSheet(null)}><ScrollView>{sheetRows.map((row) => <Pressable key={row.id} accessibilityRole="button" accessibilityState={{ selected: city === row.id }} onPress={() => { if (row.id !== city) setCitySwitches((count) => count + 1); onCity(row.id); setSheet(null); }} style={s.cityRow}><View style={s.rowMain}><Text style={s.strong}>{row.name}</Text><Text style={s.label}>{row.subtitle}</Text></View>{row.glyphs.map((peril) => <Glyph key={peril} name={peril} size={20}/>)}{city === row.id ? <Tick/> : null}</Pressable>)}</ScrollView></Sheet> : sheet === "cold" ? <Sheet title={coldCard.label} onClose={() => setSheet(null)}><View style={s.coldArt}><MarketInstrument peril="cold" tile/></View><Text style={s.body}>{coldCard.explanation}</Text></Sheet> : null}
  </View>;
}
const s = StyleSheet.create({
  header: { height: L.header, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  cityButton: { minHeight: L.target, minWidth: L.target, flexDirection: "row", alignItems: "center", flexShrink: 1, gap: 8 }, cityName: { color: C.fg, fontFamily: F.heading, fontSize: 40, lineHeight: 40, flexShrink: 1 }, downChevron: { transform: [{ rotate: "90deg" }] },
  label: { color: C.fg2, fontFamily: F.body, fontSize: 13, lineHeight: 18 }, strong: { color: C.fg, fontFamily: F.bodySemi, fontSize: 17, lineHeight: 22 }, body: { color: C.fg, fontFamily: F.body, fontSize: 15, lineHeight: 22 }, secondary: { color: C.fg2 }, foreground: { color: C.fg }, payout: { color: C.slicker },
  covers: { minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottomWidth: 1, borderBottomColor: C.tick }, coverCount: { color: C.fg, fontFamily: F.bodySemi, fontSize: 13, lineHeight: 18, flexShrink: 1 }, coverFigures: { flexDirection: "row", gap: 12 }, smallMono: { color: C.fg, fontFamily: F.mono, fontSize: 15, lineHeight: 20 },
  hero: { height: L.hero.height, paddingTop: L.hero.top, paddingBottom: L.hero.bottom }, heroContent: { height: L.hero.content, flexDirection: "row", gap: 16 }, heroText: { flex: 1, minWidth: 0 }, titleLine: { height: 22, flexDirection: "row", alignItems: "center", gap: 4 },
  heroInstrument: { width: L.hero.instrumentWidth, height: L.hero.instrumentHeight, position: "relative", marginLeft: 0 }, reading: { position: "absolute", top: L.hero.instrumentHeight + 8, width: 72, left: -8, textAlign: "center", color: C.fg2, fontFamily: F.body, fontSize: 13, lineHeight: 18 },
  numeralLine: { flexDirection: "row", alignItems: "baseline", gap: 6, height: 68 }, heroNumberSlot: { maxWidth: "80%", flexShrink: 1 }, heroNumeral: { color: C.slicker, fontFamily: F.heading, fontSize: 72, lineHeight: 68, includeFontPadding: false }, unit: { color: C.fg2, fontFamily: F.body, fontSize: 20, lineHeight: 24 }, sentence: { color: C.fg, fontFamily: F.body, fontSize: 15, lineHeight: 22 },
  stats: { height: L.hero.stats, marginTop: L.hero.beforeStats, flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.tick, alignItems: "center" }, stat: { flex: 1, gap: 2 }, statValue: { color: C.fg, fontFamily: F.mono, fontSize: 20, lineHeight: 24 },
  cta: { height: L.hero.cta, minHeight: L.target, marginTop: L.hero.beforeCta, borderRadius: 999, backgroundColor: C.glacier, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 }, ctaText: { color: C.onGlacier, fontFamily: F.bodySemi, fontSize: 15, lineHeight: 22 }, outlined: { backgroundColor: "transparent", borderWidth: 1, borderColor: C.tick }, receiptNote: { color: C.fg2, fontFamily: F.body, fontSize: 13, lineHeight: 18, marginTop: 4 },
  cityPanel: { height: L.cityPanel, paddingTop: 16, flexDirection: "row", gap: 16 },
  zone: { color: C.fg2, fontFamily: F.bodyMedium, fontSize: L.zone.fontSize, lineHeight: L.zone.lineHeight, marginTop: L.zone.above, marginBottom: L.zone.below, textTransform: "uppercase" },
  row: { height: L.row, minHeight: L.target, borderBottomWidth: 1, borderBottomColor: C.tick, flexDirection: "row", alignItems: "center", gap: 8 }, rowMain: { flex: 1, minWidth: 0 }, rowTrigger: { color: C.fg, fontFamily: F.mono, fontSize: 15, lineHeight: 22 }, rowEnd: { color: C.fg2, fontFamily: F.body, fontSize: 15, lineHeight: 22 }, rowStatus: { maxWidth: 112, flexDirection: "row", alignItems: "center", gap: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: L.card.gap }, cardSlot: { width: "48%", flexGrow: 1, maxWidth: "49%" }, card: { height: L.card.height, minHeight: L.target, padding: L.card.padding, borderRadius: L.card.radius, backgroundColor: C.surface1, position: "relative" }, cardShell: { height: L.card.height, backgroundColor: C.surface1, borderRadius: L.card.radius }, loadingGrid: { marginTop: L.zone.above }, cardTitle: { color: C.fg, fontFamily: F.bodySemi, fontSize: 20, lineHeight: 24 }, cardBody: { position: "absolute", top: L.card.bodyY, left: L.card.padding, right: L.card.padding, height: 104, flexDirection: "row", gap: 12, alignItems: "center" }, tileInstrument: { width: 44, height: 104, position: "relative" }, cardFigure: { flex: 1, minWidth: 0 }, cardNumeral: { color: C.slicker, fontFamily: F.heading, fontSize: 40, lineHeight: 40, includeFontPadding: false }, cardFooter: { position: "absolute", top: L.card.footerY, left: L.card.padding, right: L.card.padding, flexDirection: "row", alignItems: "center", gap: 4 }, footerCopy: { flexShrink: 1 },
  message: { paddingVertical: 24, gap: 8 }, retry: { minHeight: L.target, minWidth: L.target, justifyContent: "center", alignSelf: "flex-start" }, link: { color: C.glacier, fontFamily: F.bodySemi, fontSize: 15, lineHeight: 22 },
  modal: { flex: 1, justifyContent: "flex-end" }, scrim: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(11,18,32,0.72)" }, sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: C.surface1, paddingHorizontal: 16, paddingTop: 12 }, handle: { width: 36, height: 4, backgroundColor: C.tick, alignSelf: "center", borderRadius: 2, marginBottom: 16 }, sheetTitle: { color: C.fg, fontFamily: F.bodySemi, fontSize: 17, lineHeight: 22, marginBottom: 8 }, cityRow: { height: L.cityRow, flexDirection: "row", alignItems: "center", gap: 8 }, sheetClose: { minHeight: L.target, minWidth: L.target, justifyContent: "center", alignItems: "center" }, coldArt: { alignItems: "center", marginVertical: 16 },
});
