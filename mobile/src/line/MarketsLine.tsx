import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View, Vibration, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { CaretDown, CaretRight, Check } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cityById, perilById } from "../../../shared/peril-registry.ts";
import * as copy from "../../../shared/ui-copy.ts";
import { citySheetRows, coldCard, countdown, marketsView, marketStrikes, pendingCards, perilTileAction, PERIL_TILE_ORDER, marketsV4Layout as L, marketsMotion as M, type PreviewSelection } from "../../../shared/ui-markets.ts";
import type { MarketModel, MarketSelection, ReceiptModel } from "../../../shared/ui-discovery.ts";
import { dayFromIso } from "../../../shared/ui-ladder.ts";
import { measureLabel } from "../../../shared/ui-money.ts";
import type { QuoteWindow } from "../../../shared/ui-window-quote.ts";
import { lineTokens as C, lineMotion } from "../../../shared/ui-tokens.ts";
import type { PerilId } from "../../../shared/ui-types.ts";
import { F } from "../theme.ts";
import { useReducedMotion } from "../liquid-glass.tsx";
import { LinePressable } from "./pressable.tsx";
import { PerilAvatar } from "./PerilAvatar.tsx";

// Entry is once per app cold start, including when Markets remounts after a ticket.
let enteredMarkets = false;
function Reveal({ children, changeKey, rise = 0, delay = 0, duration = M.city, enabled = true }: { children: ReactNode; changeKey?: string; rise?: number; delay?: number; duration?: number; enabled?: boolean }) {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced || !enabled) { value.setValue(1); return; }
    value.setValue(0);
    const animation = Animated.timing(value, { toValue: 1, duration, delay, easing: Easing.bezier(.23, 1, .32, 1), useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [value, reduced, duration, delay, changeKey, enabled]);
  return <Animated.View style={{ opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) }] }}>{children}</Animated.View>;
}
function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const animation = Animated.loop(Animated.timing(value, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true }));
    animation.start(); return () => animation.stop();
  }, [reduced, value]);
  return <View accessible={false} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[s.skeleton, style]}>{!reduced ? <Animated.View style={[StyleSheet.absoluteFill, { width: width / 3, backgroundColor: "rgba(242,245,248,0.06)", transform: [{ translateX: value.interpolate({ inputRange: [0, 1], outputRange: [-width / 3, width] }) }] }]}/> : null}</View>;
}
/** A damped spring sampled over the shared sheet duration, normalized to settle exactly. */
function sheetSpring(progress: number): number {
  const decay = lineMotion.springDamping / 2;
  const frequency = Math.sqrt(lineMotion.springStiffness - decay * decay);
  const response = (time: number) => 1 - Math.exp(-decay * time) * (Math.cos(frequency * time) + decay / frequency * Math.sin(frequency * time));
  const seconds = lineMotion.sheetInMs / 1000;
  return response(progress * seconds) / response(seconds);
}
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const slide = useRef(new Animated.Value(reduced ? 0 : height)).current;
  useEffect(() => {
    const animation = Animated.timing(slide, { toValue: 0, duration: lineMotion.sheetInMs, easing: sheetSpring, useNativeDriver: true });
    if (!reduced) animation.start(); else slide.setValue(0);
    return () => animation.stop();
  }, [slide, reduced]);
  return <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
    <View style={s.modal}><Pressable accessible={false} onPress={onClose} style={s.scrim}/><Animated.View accessibilityViewIsModal style={[s.sheet, { maxHeight: height * .88, paddingBottom: Math.max(16, insets.bottom), transform: [{ translateY: slide }] }]}>
      <View style={s.handle}/><Text accessibilityRole="header" style={s.cardTitle}>{title}</Text>{children}
      <LinePressable accessibilityRole="button" onPress={onClose} style={s.sheetClose}><Text style={s.link}>{copy.CLOSE}</Text></LinePressable>
    </Animated.View></View>
  </Modal>;
}
function Section({ title, count, children, index, enter }: { title: string; count?: string; children: ReactNode; index: number; enter: boolean }) {
  return <Reveal rise={8} delay={index * M.stagger} enabled={enter}><View style={s.sectionHead}><Text accessibilityRole="header" style={s.sectionTitle}>{title}</Text>{count ? <Text style={s.label}>{count}</Text> : null}</View><View style={s.group}>{children}</View></Reveal>;
}
function MarketRow({ peril, title, subline, close, held = false, action, onPress, divider }: { peril: PerilId; title: string; subline: string; close?: string; held?: boolean; action?: string; onPress: () => void; divider: boolean }) {
  return <LinePressable accessibilityRole="button" accessibilityLabel={`${title}, ${subline}, ${held ? copy.COVERED_WORD : close ? copy.closesOn(close) : action ?? ""}`} onPress={onPress} style={s.row}>
    {divider ? <View style={s.divider}/> : null}<PerilAvatar peril={peril}/><View style={s.rowMain}><Text numberOfLines={1} style={s.rowName}>{title}</Text><Text numberOfLines={1} style={s.label}>{subline}</Text></View>
    <View style={s.rowRight}>{held ? <View style={s.inline}><Text style={s.covered}>{copy.COVERED_WORD}</Text><Check size={14} weight="bold" color={C.glacier}/></View> : close ? <><Text style={s.label}>{copy.CLOSES_WORD}</Text><Text style={s.rowFigure}>{close}</Text></> : <View style={s.inline}><Text style={s.label}>{action}</Text><CaretRight size={16} weight="bold" color={C.dryText}/></View>}</View>
  </LinePressable>;
}
function Hero({ market: m, strikes, onStrike, onSelect, onWallet, receipts, nowSeconds, fallback }: { market: MarketModel; strikes: MarketModel[]; onStrike: (id: string) => void; onSelect: (m: MarketSelection) => void; onWallet: () => void; receipts: ReceiptModel[]; nowSeconds: number; fallback: boolean }) {
  const held = m.held;
  const receipt = held ? receipts.find((r) => r.market === m.id) : null;
  const remainingDays = Math.ceil((Date.parse(m.quote.salesCloseAt) / 1000 - nowSeconds) / 86400);
  const trigger = measureLabel(m.trigger)!;
  const stats = held ? [{ label: copy.MAX_GAIN, value: receipt?.gain == null ? "—" : `+${receipt.gain}` }, { label: copy.MAX_LOSS, value: receipt?.loss == null ? "—" : `−${receipt.loss}` }]
    : [{ label: copy.CHANCE, value: m.chance }, { label: copy.MULTIPLE, value: m.multiple }, { label: copy.MAX_LOSS, value: `−${m.loss}` }];
  return <View style={s.hero}>
    <View style={s.heroHeader}><PerilAvatar peril={m.peril} size={44}/><View style={s.rowMain}><Text numberOfLines={1} style={s.cardTitle}>{copy.marketsTitle(m.peril, fallback ? m.city : m.station)}</Text><Text numberOfLines={1} style={s.label}>{copy.marketsWindow(dayFromIso(m.quote.windowStart) ?? m.quote.windowStart, dayFromIso(m.quote.windowEnd) ?? m.quote.windowEnd)}</Text></View>{!held ? <View style={s.daysPill}><Text style={s.tileLabel}>{remainingDays > 0 ? copy.daysLeft(remainingDays) : countdown(m.quote.salesCloseAt, nowSeconds * 1000)}</Text></View> : null}</View>
    {held ? <Text style={[s.receiptHeading, s.covered]}>{copy.COVERED_WORD} ✓</Text> : <>
      <Text style={[s.label, s.paysAt]}>{copy.PAYS_OUT_AT}</Text>
      <View style={s.numeralLine}><Reveal changeKey={m.id} rise={16} duration={lineMotion.stepMs}><Text style={s.heroNumeral}>{trigger}</Text></Reveal><Text style={s.heroUnit}>{copy.triggerCondition(m.unit, perilById(m.peril)!.direction)}</Text></View>
      <View style={s.strikes}><Text style={s.label}>{copy.TRIGGER}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strikeList}>{strikes.map((strike) => <LinePressable key={strike.id} accessibilityRole="radio" accessibilityLabel={`${copy.TRIGGER} ${measureLabel(strike.trigger)} ${strike.unit}`} accessibilityState={{ selected: strike.id === m.id }} onPress={() => { Vibration.vibrate(10); onStrike(strike.id); }} style={s.strikeTarget}><View style={[s.strike, strike.id === m.id && s.strikeOn]}><Text style={[s.strikeText, strike.id === m.id && s.strikeTextOn]}>{measureLabel(strike.trigger)} {strike.unit}</Text></View></LinePressable>)}</ScrollView></View>
    </>}
    <View style={s.stats}>{stats.map((stat) => <View key={stat.label} style={s.stat}><Text style={s.label}>{stat.label}</Text><Text style={s.statValue}>{stat.value}</Text></View>)}</View>
    <LinePressable accessibilityRole="button" onPress={() => held ? onWallet() : onSelect(m)} style={s.cta}><Reveal changeKey={m.id} duration={lineMotion.swapMs}><Text style={s.ctaText}>{held ? copy.VIEW_COVER : copy.coverTrigger(trigger, m.unit)}</Text></Reveal></LinePressable>
    <Text style={s.note}>{held ? copy.nothingElseOpen(m.city) : m.note}</Text>
  </View>;
}
export function MarketsLine({ markets, receipts, totals, loading, failed, onSelect, onPreview, onWallet, onRetry, selectedCity, onCity, quoteWindows = [], nowSeconds = 0 }: {
  markets: MarketModel[]; receipts: ReceiptModel[]; totals?: { loss: string; gain: string } | null; loading: boolean; failed: boolean; reason?: string;
  onSelect: (m: MarketSelection) => void; onPreview: (p: PreviewSelection) => void; onWallet: () => void; onRetry: () => void; selectedCity: string | null; onCity: (city: string) => void; quoteWindows?: readonly QuoteWindow[]; nowSeconds?: number;
}) {
  const [sheet, setSheet] = useState<"city" | "cold" | null>(null);
  const [filter, setFilter] = useState<PerilId | null>(null);
  const [strike, setStrike] = useState<string | null>(null);
  const [enter] = useState(() => !enteredMarkets);
  const reduced = useReducedMotion();
  const ring = useRef(new Animated.Value(-1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const [tilesWidth, setTilesWidth] = useState(0);
  const previousCity = useRef(selectedCity ?? "new-york");
  const city = selectedCity ?? "new-york";
  const cityChanged = previousCity.current !== city;
  useEffect(() => { if (!loading) enteredMarkets = true; previousCity.current = city; }, [loading, city]);
  useEffect(() => {
    const index = filter ? PERIL_TILE_ORDER.indexOf(filter) : -1;
    const animation = Animated.parallel([
      Animated.timing(ringOpacity, { toValue: index < 0 ? 0 : 1, duration: reduced ? 0 : M.city, useNativeDriver: true }),
      Animated.spring(ring, { toValue: Math.max(0, index), damping: lineMotion.springDamping, stiffness: lineMotion.springStiffness, useNativeDriver: true }),
    ]);
    if (reduced) { ring.setValue(Math.max(0, index)); ringOpacity.setValue(index < 0 ? 0 : 1); } else animation.start();
    return () => animation.stop();
  }, [filter, reduced, ring, ringOpacity]);
  const name = cityById(city)?.name ?? city;
  const view = marketsView(city, markets, filter, strike);
  const pending = pendingCards(markets, quoteWindows, nowSeconds).filter((p) => !filter || p.peril === filter);
  const active = receipts.filter((r) => r.kind === "open");
  const avatars = PERIL_TILE_ORDER.filter((p) => active.some((r) => r.peril === p)).slice(0, 3);
  const sheetRows = citySheetRows(markets, quoteWindows);
  const titleFor = (m: MarketModel) => `${perilById(m.peril)!.label} ${perilById(m.peril)!.direction === "down" ? "≤" : "≥"} ${measureLabel(m.trigger)} ${m.unit}`;
  const tileWidth = (tilesWidth - L.tileGap * 4) / 5;
  return <View>
    <View style={s.header}>{loading ? <Skeleton style={s.citySkeleton}/> : <LinePressable accessibilityRole="button" accessibilityLabel={`${copy.CHOOSE_CITY}, ${name}`} accessibilityState={{ expanded: sheet === "city" }} onPress={() => setSheet("city")} style={s.cityTarget}><View style={s.cityPill}><View style={s.monogram}><Text style={s.monogramText}>{city === "new-york" ? "NY" : name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase()}</Text></View><Text numberOfLines={1} style={s.cityName}>{name}</Text><CaretDown size={16} weight="bold" color={C.fg2}/></View></LinePressable>}<View style={s.devnet}><View style={s.dot}/><Text style={s.devnetText}>{copy.DEVNET_TAG}</Text></View></View>
    {loading ? <Skeleton style={s.covers}/> : active.length ? <LinePressable accessibilityRole="button" onPress={onWallet} style={s.covers}>
      {avatars.length ? <View style={s.stack}>{avatars.map((peril, i) => <View key={peril} style={[s.stackAvatar, { marginLeft: i ? -10 : 0 }]}><PerilAvatar peril={peril} size={32}/><View pointerEvents="none" style={s.avatarRing}/></View>)}</View> : null}
      <View style={s.rowMain}><Text numberOfLines={1} style={s.coverCount}>{copy.openCoversCount(active.length)}</Text><Text numberOfLines={1} style={s.label}>{copy.MAX_LOSS} {totals ? `−${totals.loss}` : "—"}</Text></View><View style={s.rowRight}><Text style={s.label}>{copy.MAX_GAIN}</Text><Text style={s.coverCount}>{totals ? `+${totals.gain}` : "—"}</Text></View><CaretRight size={16} weight="bold" color={C.dryText}/>
    </LinePressable> : null}
    <View onLayout={(event) => setTilesWidth(event.nativeEvent.layout.width)} style={s.tiles}>{PERIL_TILE_ORDER.map((peril) => loading ? <Skeleton key={peril} style={s.tile}/> : <LinePressable key={peril} accessibilityRole="button" accessibilityLabel={perilById(peril)!.label} accessibilityHint={peril === "cold" ? copy.NOT_AVAILABLE_YET : undefined} accessibilityState={{ selected: filter === peril }} onPress={() => { const action = perilTileAction(filter, peril); if (action.sheet) setSheet(action.sheet); else { Vibration.vibrate(10); setFilter(action.filter); setStrike(null); } }} style={[s.tile, filter === peril && s.tileOn]}><PerilAvatar peril={peril} size={36}/><Text style={s.tileLabel}>{perilById(peril)!.label}</Text></LinePressable>)}{!loading && tilesWidth > 0 ? <Animated.View pointerEvents="none" style={[s.tileRing, { width: tileWidth, opacity: ringOpacity, transform: [{ translateX: Animated.multiply(ring, tileWidth + L.tileGap) }] }]}/> : null}</View>
    <Reveal changeKey={`${city}-${filter ?? "all"}-${loading}`} rise={cityChanged ? 12 : 0}>
      {loading ? <View accessibilityLabel={copy.GETTING_QUOTE}><Skeleton style={s.heroSkeleton}/><View style={s.sectionHead}><Skeleton style={s.titleSkeleton}/></View><View style={s.group}>{[0, 1, 2].map((i) => <Skeleton key={i} style={s.rowSkeleton}/>)}</View></View> : <>
        {failed ? <View accessibilityRole="alert" style={[s.group, s.errorRow]}><Text style={[s.rowName, s.rowMain]}>{copy.MARKETS_ERROR}</Text><LinePressable accessibilityRole="button" onPress={onRetry} style={s.retry}><Text style={s.tileLabel}>{copy.RETRY}</Text></LinePressable></View> : null}
        {view.hero ? <Hero market={view.hero} strikes={marketStrikes(view.hero, markets)} onStrike={setStrike} onSelect={onSelect} onWallet={onWallet} receipts={receipts} nowSeconds={nowSeconds} fallback={view.hero.cityId !== city}/> : !failed ? <View style={s.empty}><Text style={s.cardTitle}>{markets.length || pending.length ? copy.NOTHING_OPEN : copy.NO_MARKETS_SCHEDULED}</Text></View> : null}
        <Section title={copy.moreInCityLabel(name)} count={copy.marketsCount(view.rows.length)} index={0} enter={enter}>
          {view.noLocalPeril && filter ? <View style={s.emptyRow}><Text style={s.label}>{copy.noCityPeril(filter, name)}</Text></View> : view.rows.length ? view.rows.map((m, i) => <MarketRow key={m.id} peril={m.peril} title={titleFor(m)} subline={`${m.station} · ${copy.BY} ${dayFromIso(m.quote.windowEnd) ?? m.quote.windowEnd}`} close={dayFromIso(m.quote.salesCloseAt) ?? m.quote.salesCloseAt} held={m.held} divider={i > 0} onPress={() => m.held ? onWallet() : onSelect(m)}/>) : <View style={s.emptyRow}><Text style={s.label}>{copy.NOTHING_OPEN}</Text></View>}
        </Section>
        {view.elsewhere.length ? <Section title={copy.OPEN_ELSEWHERE} count={copy.citiesCount(new Set(view.elsewhere.map((card) => card.cityId)).size)} index={1} enter={enter}>{view.elsewhere.map((card, i) => {
          const m = markets.find((item) => item.cityId === card.cityId && item.peril === card.peril && item.trigger === card.selection.trigger && item.windowStart === card.selection.windowStart && item.windowEnd === card.selection.windowEnd)!;
          return <MarketRow key={card.id} peril={card.peril} title={titleFor(m)} subline={`${card.city}${copy.windowsCount(card.windowCount)}`} close={dayFromIso(m.quote.salesCloseAt) ?? m.quote.salesCloseAt} held={card.held} divider={i > 0} onPress={() => card.held ? onWallet() : onSelect(card.selection)}/>;
        })}</Section> : null}
        <Section title={copy.COMING_UP} index={2} enter={enter}>{pending.map((card, i) => <MarketRow key={card.id} peril={card.peril} title={card.label} subline={`${card.city} · ${card.status}`} action={card.month ? copy.fromMonth(card.month) : copy.SEE_TRIGGER_CHAIN} divider={i > 0} onPress={() => onPreview(card.selection)}/>)}<MarketRow peril="cold" title={coldCard.label} subline={coldCard.status} action={copy.WHY} divider={pending.length > 0} onPress={() => setSheet("cold")}/></Section>
      </>}
    </Reveal>
    {sheet === "city" ? <Sheet title={copy.CHOOSE_CITY} onClose={() => setSheet(null)}><ScrollView>{sheetRows.map((row) => <LinePressable key={row.id} accessibilityRole="button" accessibilityState={{ selected: city === row.id }} onPress={() => { onCity(row.id); setStrike(null); setSheet(null); }} style={s.cityRow}><View style={s.rowMain}><Text style={s.cardTitle}>{row.name}</Text><Text style={s.label}>{row.subtitle}</Text></View>{row.glyphs.map((peril) => <PerilAvatar key={peril} peril={peril} size={32}/>)}{city === row.id ? <Check size={20} weight="bold" color={C.fg}/> : null}</LinePressable>)}</ScrollView></Sheet> : sheet === "cold" ? <Sheet title={coldCard.status} onClose={() => setSheet(null)}><View style={s.coldAvatar}><PerilAvatar peril="cold" size={44}/></View><Text style={s.body}>{coldCard.explanation}</Text></Sheet> : null}
  </View>;
}

// RN only accepts hundred-step fontWeight values. Exact 650/750 use bundled Inter instances.
function nativeType<T extends { fontWeight: string }>(token: T) { const { fontWeight: _weight, ...style } = token; return style; }
const type = { fontFamily: F.body, fontVariant: ["tabular-nums" as const] };
const s = StyleSheet.create({
  header: { height: L.header, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  cityTarget: { minHeight: L.target, minWidth: L.target, flexShrink: 1, justifyContent: "center" }, cityPill: { height: L.cityPill, borderRadius: C.radius.pill, backgroundColor: C.surface1, paddingLeft: 6, paddingRight: 14, flexDirection: "row", gap: 10, alignItems: "center" },
  monogram: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bgRaised, alignItems: "center", justifyContent: "center" }, monogramText: { ...type, color: C.fg, fontSize: 13, fontFamily: F.bodyBold, letterSpacing: -.2 }, cityName: { ...type, ...nativeType(C.type.cardTitle), fontFamily: "Inter_650", color: C.fg, letterSpacing: -.3, flexShrink: 1 },
  devnet: { height: 32, borderRadius: C.radius.pill, backgroundColor: C.surface1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.wind }, devnetText: { ...type, ...nativeType(C.type.tileLabel), color: C.fg2, fontFamily: F.bodySemi },
  label: { ...type, ...nativeType(C.type.label), color: C.fg2, lineHeight: 16 }, body: { ...type, color: C.fg, fontSize: 15, lineHeight: 22 }, cardTitle: { ...type, ...nativeType(C.type.cardTitle), fontFamily: "Inter_650", color: C.fg, lineHeight: 22 }, tileLabel: { ...type, ...nativeType(C.type.tileLabel), fontFamily: F.bodySemi, color: C.fg },
  covers: { height: L.covers, backgroundColor: C.surface1, borderRadius: C.radius.tile, marginTop: 8, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 }, stack: { flexDirection: "row" }, stackAvatar: { width: 32, height: 32 }, avatarRing: { position: "absolute", top: -2, bottom: -2, left: -2, right: -2, borderRadius: 18, borderWidth: 2, borderColor: C.surface1 }, coverCount: { ...type, fontFamily: "Inter_650", fontSize: 15, lineHeight: 20, color: C.fg },
  tiles: { flexDirection: "row", gap: L.tileGap, marginTop: 12 }, tile: { flex: 1, height: L.tile, borderRadius: C.radius.tile, backgroundColor: C.surface1, alignItems: "center", justifyContent: "center", gap: 8 }, tileOn: { backgroundColor: C.bgRaised }, tileRing: { position: "absolute", top: 0, left: 0, height: L.tile, borderRadius: C.radius.tile, borderWidth: 1.5, borderColor: C.fg },
  hero: { marginTop: 16, padding: L.heroPadding, backgroundColor: C.surface1, borderRadius: C.radius.hero }, heroHeader: { flexDirection: "row", alignItems: "center", gap: 12 }, rowMain: { flex: 1, minWidth: 0 }, daysPill: { height: 28, borderRadius: C.radius.pill, paddingHorizontal: 10, justifyContent: "center", backgroundColor: C.bgRaised }, paysAt: { marginTop: 16 },
  numeralLine: { flexDirection: "row", alignItems: "baseline", gap: 4, height: 66, marginTop: 4 }, heroNumeral: { ...type, ...nativeType(C.type.heroNumeral), fontFamily: "Inter_750", color: C.slicker, includeFontPadding: false }, heroUnit: { ...type, ...nativeType(C.type.heroUnit), fontFamily: F.bodySemi, color: C.fg2, letterSpacing: -.3, flexShrink: 1 },
  strikes: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }, strikeList: { gap: 8 }, strikeTarget: { minHeight: L.target, minWidth: L.target, justifyContent: "center" }, strike: { height: L.strike, borderRadius: C.radius.pill, backgroundColor: C.surface2, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" }, strikeOn: { backgroundColor: C.fg }, strikeText: { ...type, fontSize: 15, fontFamily: F.bodySemi, color: C.fg }, strikeTextOn: { color: C.bg },
  stats: { backgroundColor: C.surface2, borderRadius: C.radius.tile, paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", marginTop: 8 }, stat: { flex: 1, gap: 2 }, statValue: { ...type, ...nativeType(C.type.statValue), fontFamily: "Inter_650", color: C.fg, lineHeight: 27 },
  cta: { height: L.cta, borderRadius: C.radius.pill, backgroundColor: C.glacier, alignItems: "center", justifyContent: "center", marginTop: 14 }, ctaText: { ...type, ...nativeType(C.type.cta), fontFamily: F.bodyBold, color: C.onGlacier }, note: { ...type, fontSize: 13, color: C.dryText, lineHeight: 16, textAlign: "center", marginTop: 10, letterSpacing: -.1 }, receiptHeading: { marginTop: 16 },
  sectionHead: { marginTop: 28, marginBottom: 10, marginHorizontal: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }, sectionTitle: { ...type, ...nativeType(C.type.sectionTitle), fontFamily: F.bodyBold, color: C.fg }, group: { backgroundColor: C.surface1, borderRadius: C.radius.group, overflow: "hidden" },
  row: { height: L.row, minHeight: L.target, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 }, divider: { position: "absolute", top: 0, left: L.dividerInset, right: 0, height: 1, backgroundColor: C.divider }, rowName: { ...type, ...nativeType(C.type.rowName), fontFamily: "Inter_650", color: C.fg, lineHeight: 22 }, rowFigure: { ...type, ...nativeType(C.type.rowFigure), fontFamily: "Inter_650", color: C.fg, lineHeight: 22 }, rowRight: { alignItems: "flex-end" }, inline: { flexDirection: "row", alignItems: "center", gap: 4 }, covered: { ...type, fontFamily: "Inter_650", fontSize: 15, color: C.glacier },
  empty: { marginTop: 16, padding: 16, borderRadius: C.radius.hero, backgroundColor: C.surface1 }, emptyRow: { minHeight: L.row, paddingHorizontal: 14, justifyContent: "center" }, errorRow: { minHeight: L.row, marginTop: 16, paddingHorizontal: 14, flexDirection: "row", gap: 12, alignItems: "center" }, retry: { minHeight: L.target, minWidth: L.target, paddingHorizontal: 16, borderRadius: C.radius.pill, backgroundColor: C.bgRaised, justifyContent: "center" }, link: { ...type, color: C.glacier, fontSize: 15, fontFamily: F.bodySemi },
  skeleton: { backgroundColor: C.surface1, overflow: "hidden" }, citySkeleton: { height: L.cityPill, width: 186, borderRadius: C.radius.pill }, heroSkeleton: { marginTop: 16, height: L.heroSkeleton, borderRadius: C.radius.hero }, rowSkeleton: { height: L.row, borderRadius: 0 }, titleSkeleton: { height: 24, width: 180, borderRadius: 8 },
  modal: { flex: 1, justifyContent: "flex-end" }, scrim: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(11,18,32,0.72)" }, sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: C.surface1, paddingHorizontal: 16, paddingTop: 12 }, handle: { width: 36, height: 4, backgroundColor: C.tick, alignSelf: "center", borderRadius: 2, marginBottom: 16 }, cityRow: { height: 72, flexDirection: "row", alignItems: "center", gap: 8 }, sheetClose: { minHeight: L.target, minWidth: L.target, justifyContent: "center", alignItems: "center" }, coldAvatar: { alignItems: "center", marginVertical: 16 },
});
