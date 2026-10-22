import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { RadarMap, type MapScope } from "./RadarMap";
import { CountUp, GlassCard, GlobalGroups } from "./revamp";
import { GROUP_ORDER, highlightParts, MARKETS, searchMarkets, type CatalogMarket, type MarketGroup } from "./markets-catalog";
import { useReducedMotion } from "./liquid-glass";
import { ScreenTop } from "./journey";
import type { CityIndex, ClaimReadiness, DevnetStatus, FinalizedWalletState, Portfolio, ProtectionQuote } from "./api";
import { C, F, glass, MIN_TOUCH, motion, space as S, statusGlow, type as T } from "./theme";
import { Enter, ProgressRail, SpringPress } from "./motion";
import { ActionButton, AppIcon, Disclosure, Reveal, Text } from "./ui";
import { friendlyError, quoteErrorTitle, stationLabel, transactionErrorTitle } from "./friendly-errors";
import { payoutStage, PAYOUT_STEPS, stepLabel, type FlowStep } from "./consumer-flow";
import { formatWeekLabel } from "./presentation";
import { isOnchainMarketOpen } from "./protection";
import { expiryChipLabel, matchingWindowPackage, measuredAtLine, type WindowEvidencePackage } from "../../shared/window-chain.ts";
import { marketStatus, notTriggeredLine, payGet, payGetBarWidths } from "../../shared/pay-get.ts";
import { RainGauge } from "./rain-gauge";
import { ProtectChain } from "./protect-chain";
import { citySalesClosed, expiryLabel, NEXT_WINDOW_COPY, positionLabel, sellingWindows, windowsForCity, type SellingWindow, type Tenor } from "./windows";
import type { ProtectSurface } from "../../shared/protect-surface.ts";
import { CONSUMER_LEAD_CODES, consumerCityByCode, consumerCityBySlug } from "../../shared/consumer-cities.ts";
import { MARKETING_SHOTS } from "./marketing";
import { approveInPhantomLabel } from "./confirm-buy";
import { balanceCheck, coverageOptions, formatSkytFixed, premiumPer100, payState, reviewReason, shortAddress, shortUtcDate, trimMm, utcDateTime, type CoverageOption } from "./ticket";
import { buyPhaseLabel, type BuyPhase } from "./buy-phase";
import { coveredLead, coveredRows } from "./covered";
import type { ChainProtection } from "./positions";

const TAB = ["tabular-nums" as const];

/** Neutral Devnet pill with a green dot (header). Hidden in marketing screenshot builds. */
export function NetworkPill({ label = "Devnet" }: { label?: string }) {
  if (MARKETING_SHOTS) return null;
  return <View style={s.netPill} accessible accessibilityLabel={`Network: Solana ${label}`}>
    <View style={[s.dot, { backgroundColor: C.mint }]} />
    <Text style={s.netPillText}>{label}</Text>
  </View>;
}

function cityDataLine(windows: readonly SellingWindow[]): string | null {
  const next = windows.find((window) => window.thresholdMmX100 && window.premiumRateBps != null && window.quoteProbabilityBps != null);
  if (!next?.thresholdMmX100 || next.premiumRateBps == null || next.quoteProbabilityBps == null) return null;
  const mm = Number(next.thresholdMmX100) / 100;
  const quote = payGet({ coverageSkyt: 100, premiumRateBps: next.premiumRateBps, probabilityBps: next.quoteProbabilityBps });
  const date = expiryChipLabel(next)?.split(" · ")[0];
  if (!quote || !date || !Number.isFinite(mm)) return null;
  return `Next: ${date} · ≥${Number.isInteger(mm) ? String(mm) : mm.toFixed(1)} mm · ${quote.chance} · ${quote.multiple}`;
}

function Pill({ label, tone }: { label: string; tone: "live" | "neutral" | "warn" | "gold" }) {
  const fg = tone === "live" ? C.mint : tone === "warn" ? C.amber : tone === "gold" ? C.payout : C.muted;
  const bg = tone === "live" ? C.mintSoft : tone === "warn" ? C.amberSoft : tone === "gold" ? C.payoutSoft : C.mutedSurface;
  return <View style={[s.pill, { backgroundColor: bg }]} accessible accessibilityLabel={label}>
    {tone === "live" ? <View style={[s.dot, { backgroundColor: fg }]} /> : null}
    <Text style={[s.pillText, { color: fg }]}>{label}</Text>
  </View>;
}

function Row({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return <View style={s.row}>
    <Text style={s.rowLabel} android_hyphenationFrequency="none">{label}</Text>
    <Text style={[s.rowValue, { flex: 1, flexShrink: 1, textAlign: "right" }, gold && { color: C.payout }]} android_hyphenationFrequency="none">{value}</Text>
  </View>;
}

export function marketIsLive(status: DevnetStatus | null, nowSeconds: number): boolean {
  return sellingWindows(status, nowSeconds).length > 0;
}

/* ───────────────────────────── Markets ───────────────────────────── */

export function MarketsScreen(props: {
  status: DevnetStatus | null;
  city: CityIndex | null;
  indicativeQuote: ProtectionQuote | null;
  nowSeconds: number;
  onProtect: (code: string) => void;
  onOpenMarket?: (m: CatalogMarket) => void;
  guide?: React.ReactNode;
  showGuide?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<MapScope>("region");
  const [group, setGroup] = useState<MarketGroup | null>(null);
  const [browseAll, setBrowseAll] = useState(false);
  const pickGroup = (grp: MarketGroup | null) => { setGroup(grp); setScope(grp === "North America" ? "region" : "global"); };
  const allWindows = sellingWindows(props.status, props.nowSeconds);
  const windows = windowsForCity(allWindows, "des-moines");
  const market = windows[0] ?? null;
  const city = props.city?.slug === "des-moines" ? props.city : null;
  const live = windows.length > 0;
  const thresholdMm = market?.thresholdMmX100 && /^\d+$/.test(market.thresholdMmX100) ? Number(market.thresholdMmX100) / 100 : null;
  const below = market?.operator === "lt" || market?.operator === "lte";
  const symbol = market?.operator === "gt" ? ">" : market?.operator === "lt" ? "<" : below ? "≤" : "≥";
  const history = (city?.weeklyHistoryMm ?? []).slice(-7);
  const values = history.map((w) => (w.mm != null && Number.isFinite(w.mm) && w.mm >= 0 ? w.mm : null));
  const scale = Math.max(1, thresholdMm ?? 0, ...values.map((v) => v ?? 0)) * 1.1;
  const lastKnown = values.reduce<number>((acc, v, i) => (v != null ? i : acc), -1);
  const CHART_H = 96;
  const per100 = props.indicativeQuote ? premiumPer100(props.indicativeQuote.premium, props.indicativeQuote.protectedAmount) : null;
  const station = stationLabel(props.status?.noaaEvidence.package?.stationId ?? "USW00014933");
  const nextDates = windows.map((window) => expiryLabel(window)).join(" · ");
  const dsmStatus = marketStatus(windows, props.nowSeconds) ?? (citySalesClosed(props.status, "des-moines", props.nowSeconds) ? { tone: "closed" as const, label: "Closed" } : null);

  const featured = CONSUMER_LEAD_CODES.map((code) => MARKETS.find((market) => market.code === code)).filter((market): market is CatalogMarket => !!market);
  const catalogResults = searchMarkets(query, group || query.trim() ? "all" : scope === "region" ? "region" : "global", group);
  const needle = query.trim().toLowerCase();
  const featuredResults = featured.filter((market) => {
    if (!needle) return true;
    const moment = consumerCityByCode(market.code)?.moment ?? "";
    return [market.name, market.code, market.region, market.country, market.source, moment].some((field) => field.toLowerCase().includes(needle));
  });
  const visibleRows = browseAll ? catalogResults : featuredResults;
  const filtering = browseAll && (!!query.trim() || !!group);
  const highlight = new Set(filtering ? catalogResults.map((market) => market.code) : []);
  const focusCode = filtering && catalogResults[0] ? catalogResults[0].code : "NYC";
  const mapScope: MapScope = filtering && catalogResults[0] && catalogResults[0].group !== "North America" ? "global" : scope;
  const open = (market: CatalogMarket) => {
    if (consumerCityByCode(market.code)) props.onProtect(market.code);
    else props.onOpenMarket?.(market);
  };
  const showFeatured = () => { setBrowseAll(false); setGroup(null); setQuery(""); };
  const showAllZones = () => { setBrowseAll(true); setGroup(null); setScope("global"); setQuery(""); };

  return <>
    {props.showGuide ? <StepBar step={1} /> : null}
    <ScreenTop title="Where are your plans?" lead="Pick a city, then choose what to protect against inside it." />

    <Enter index={0}>
      <View style={s.search}>
        <AppIcon name="search" color={C.muted} size={18} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Find a covered zone" placeholderTextColor={C.quiet} style={s.searchInput} accessibilityLabel="Search markets" autoCorrect={false} returnKeyType="search" />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery("")} hitSlop={10}><AppIcon name="x" color={C.muted} size={18} /></Pressable> : null}
      </View>
    </Enter>

    {browseAll ? <Enter index={1}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: S.md, flexGrow: 0 }} contentContainerStyle={{ gap: S.sm, paddingRight: S.sm }} accessibilityRole="tablist">
        {([null, ...GROUP_ORDER] as Array<MarketGroup | null>).map((grp) => {
          const on = group === grp;
          const n = grp ? MARKETS.filter((m) => m.group === grp).length : MARKETS.length;
          return <SpringPress key={grp ?? "all"} selected={on} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => pickGroup(grp)} style={[s.regionChip, on && s.regionChipOn]}>
            <Text style={[s.regionChipText, on && s.regionChipTextOn]}>{grp ?? "All"} <Text style={[s.regionChipN, on && s.regionChipNOn]}>{n}</Text></Text>
          </SpringPress>;
        })}
      </ScrollView>
    </Enter> : null}

    <GlassCard style={{ paddingVertical: S.sm, paddingHorizontal: S.md }} delay={2 * motion.stagger}>
      <Text style={s.sectionLabel}>{browseAll ? "All zones" : "Cities"}</Text>
      {visibleRows.length ? visibleRows.map((m) => {
        const [a, b, c] = highlightParts(m.name, query);
        const rawSlug = consumerCityByCode(m.code)?.slug;
        const slug = rawSlug && rawSlug !== "toronto" ? rawSlug : undefined;
        const cityWindows = slug ? windowsForCity(allWindows, slug) : [];
        const status = marketStatus(cityWindows, props.nowSeconds) ?? (slug && citySalesClosed(props.status, slug, props.nowSeconds) ? { tone: "closed" as const, label: "Closed" } : null);
        const statusColor = status?.tone === "open" ? C.rain : status?.tone === "closed" ? C.quiet : C.muted;
        const moment = consumerCityByCode(m.code)?.moment;
        const line = cityDataLine(cityWindows);
        const trigger = cityWindows[0]?.thresholdMmX100 && /^\d+$/.test(cityWindows[0].thresholdMmX100) ? Number(cityWindows[0].thresholdMmX100) / 100 : null;
        const on = highlight.has(m.code) && m.code === focusCode;
        return <SpringPress key={m.code} accessibilityRole="button" accessibilityLabel={`${m.name}. ${moment ?? `${m.region}, ${m.source}`}. ${status?.label ?? ""}`} onPress={() => open(m)} style={[s.resultRow, on && { backgroundColor: C.surfaceRaised, borderColor: "#F2C230" }]}>
          {trigger != null ? <RainGauge width={28} height={64} level={0} ticks={[{ mm: trigger, selected: true }]} label="" /> : null}
          <View style={s.resultCopy}>
            <Text style={s.resultName} android_hyphenationFrequency="none">{a}<Text style={{ fontFamily: F.bodyBold, color: C.ink }}>{b}</Text>{c}</Text>
            <Text style={s.resultSub} android_hyphenationFrequency="none">{line ?? moment ?? `${m.region} · ${m.source}`}</Text>
            {status ? <Text style={[s.caption, { color: statusColor }]}>{status.label}</Text> : null}
          </View>
          <AppIcon name="chevron-right" color={C.quiet} size={16} />
        </SpringPress>;
      }) : <Text style={[s.caption, { padding: 10 }]}>No covered zone matches “{query}”.</Text>}
    </GlassCard>

    <Pressable accessibilityRole="button" accessibilityLabel={browseAll ? "Featured cities" : "Browse all zones"} onPress={browseAll ? showFeatured : showAllZones} style={s.browseLink}>
      <Text style={s.link}>{browseAll ? "Featured cities" : "Browse all zones"}</Text>
    </Pressable>

    {browseAll ? <RadarMap scope={mapScope} onScope={setScope} focusCode={focusCode} highlight={highlight} onSelect={open} /> : null}

    {browseAll && scope === "global" && !filtering ? <GlobalGroups onPick={pickGroup} /> : null}

    <GlassCard accent={live ? C.mint : undefined} delay={4 * motion.stagger}>
      <View style={s.resultCopy}>
        <Text style={s.cardTitle} android_hyphenationFrequency="none">Des Moines, IA</Text>
        <Text style={s.cardSub}>NOAA · {station}</Text>
        {dsmStatus ? <Text style={[s.caption, { color: dsmStatus.tone === "open" ? C.rain : dsmStatus.tone === "closed" ? C.quiet : C.muted }]}>{dsmStatus.label}</Text> : null}
      </View>
      <Text style={s.caption}>Wind, snow and heat coming</Text>
      <View style={[s.between, { marginTop: S.lg, alignItems: "flex-end" }]}>
        <View>
          <Text style={s.sectionLabel}>{thresholdMm != null ? "Trigger" : "Rain this window"}</Text>
          {thresholdMm != null ? <Text style={s.triggerBig}>{symbol} {trimMm(thresholdMm)} <Text style={s.unitMono}>mm</Text></Text>
            : <View style={s.baseline}><CountUp value={city?.cumulativeMm ?? null} style={s.bigFigure} /><Text style={s.unit}>mm</Text></View>}
        </View>
        {per100 ? <View style={{ alignItems: "flex-end" }}>
          <Text style={s.sectionLabel}>From</Text>
          <Text style={s.fromFigure}>{per100} <Text style={s.unitMono}>SKYT / 100</Text></Text>
        </View> : thresholdMm != null ? <View style={{ alignItems: "flex-end" }}>
          <Text style={s.sectionLabel}>Rain so far</Text>
          <View style={s.baseline}><CountUp value={city?.cumulativeMm ?? null} style={s.fromFigure} /><Text style={s.unitMono}> mm</Text></View>
        </View> : null}
      </View>
      {city?.cumulativeMm == null ? <Text style={s.caption}>Not reported by NOAA yet</Text> : city.observedThrough ? <Text style={s.caption}>Observed through {city.observedThrough}</Text> : null}

      {history.length ? <View accessible accessibilityLabel={`Weekly NOAA rainfall, last ${history.length} weeks: ${history.map((w, i) => `${formatWeekLabel(w.week)} ${values[i] == null ? "unavailable" : `${values[i]!.toFixed(1)} mm`}`).join("; ")}.${thresholdMm != null ? ` Trigger ${trimMm(thresholdMm)} mm.` : ""}`}>
        <View style={[s.chart, { height: CHART_H }]}>
          {thresholdMm != null ? <View style={[s.strike, { bottom: (thresholdMm / scale) * CHART_H }]} pointerEvents="none">
            {Array.from({ length: 40 }).map((_, i) => <View key={i} style={s.dash} />)}
          </View> : null}
          {values.map((v, i) => <View key={history[i].week} style={s.barCol}>
            {v == null ? <View style={s.barUnknown} /> : <GrowBar height={Math.max(2, (v / scale) * CHART_H)} delay={i * 90} style={[s.bar, i === lastKnown && s.barCurrent, thresholdMm != null && v >= thresholdMm && s.barHit]} />}
          </View>)}
        </View>
        <View style={s.between}><Text style={s.caption}>{history.length}-week rainfall · NOAA · mm</Text>{thresholdMm != null ? <Text style={[s.caption, { color: C.payout }]}>– – trigger</Text> : null}</View>
      </View> : <Text style={[s.caption, { marginTop: S.md }]}>Weekly history isn’t available yet — nothing is estimated.</Text>}

      {live ? <Text style={[s.caption, { marginTop: S.md }]}>{nextDates}</Text> : <Text style={[s.caption, { marginTop: S.md }]}>{citySalesClosed(props.status, "des-moines", props.nowSeconds) ? "Sales closed" : NEXT_WINDOW_COPY}</Text>}
      <View style={{ marginTop: S.lg }}><ActionButton label={live ? "View coverage" : "See markets"} icon="arrow-right" onPress={() => props.onProtect("DSM")} /></View>
    </GlassCard>

    {props.guide}
    <Disclosure>Devnet test token. Parametric weather protection. Concept markets are previews: no prices, triggers or rainfall figures exist for them. Observed station data only — missing values are never estimated.</Disclosure>
  </>;
}

/** Bar that grows from zero on mount (micro-animation for the weekly chart). */
function GrowBar({ height, delay, style }: { height: number; delay: number; style: any }) {
  const reduced = useReducedMotion();
  const grow = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { grow.setValue(1); return; }
    grow.setValue(0);
    const a = Animated.timing(grow, { toValue: 1, duration: 700, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [height, delay, reduced, grow]);
  return <Animated.View style={[style, { height, transformOrigin: "bottom", transform: [{ scaleY: grow }] }]} />;
}

/* ───────────────────────────── Protect ───────────────────────────── */

export type Check = { ready: boolean; label: string };

export function ProtectTicket(props: {
  status: DevnetStatus | null;
  nowSeconds: number;
  coverageId: CoverageOption["id"];
  onCoverage: (option: CoverageOption) => void;
  walletConnected: boolean;
  walletSkytBase: string | null;
  amountBase: string | null;
  quote: ProtectionQuote | null;
  quoteBusy: boolean;
  quoteError: string | null;
  onRetryQuote: () => void;
  unavailableReason: string | null;
  claimReadiness: ClaimReadiness | null;
  claimError: string | null;
  /** The wallet's finalized position on the selected window, if any. */
  coveredPosition?: ChainProtection | null;
  transactionMessage: string | null;
  transactionError: string | null;
  transactionDetail?: string | null;
  transactionSignature: string | null;
  buyPhase?: BuyPhase | null;
  onViewWallet?: () => void;
  onRetryBuy?: () => void;
  walletName: string;
  onRefresh: () => void;
  observedMm?: number | null;
  onProtectAgain?: () => void;
  onBackToMarkets?: () => void;
  tenor?: Tenor;
  onTenor?: (tenor: Tenor) => void;
  windows?: SellingWindow[];
  city?: string;
  selectedAddress?: string | null;
  onSelectWindow?: (address: string) => void;
  windowEvidence?: readonly WindowEvidencePackage[] | null;
  evidenceLoading?: boolean;
  cities?: readonly { slug: string; label: string }[];
  onCity?: (slug: string) => void;
  surface: ProtectSurface;
  nextOpenCopy: string | null;
  openCity: { slug: string; label: string } | null;
}) {
  const [verifyOpen, setVerifyOpen] = useState(false);
  const windows = props.windows ?? sellingWindows(props.status, props.nowSeconds);
  const market = windows.find((window) => window.address === props.selectedAddress) ?? windows[0] ?? null;
  const live = !!market;
  const options = coverageOptions(props.walletSkytBase);
  const consumer = consumerCityBySlug(props.city ?? market?.city ?? "");
  const place = consumer?.city ?? "New York";
  const stationId = consumer?.stationId?.replace(/^GHCND:/, "") ?? props.status?.noaaEvidence.package?.stationId;
  const station = stationLabel(stationId);
  const q = props.quote && props.quote.protectedAmount === props.amountBase ? props.quote : null;
  const balance = balanceCheck(props.walletSkytBase, q?.premium);
  const evidenceReady = !!market && market.evidenceStatus === "validated" && !!matchingWindowPackage(props.windowEvidence, market.city, market.observationStart, market.observationEnd);
  const checks: Check[] = [
    { ready: !!props.status?.program.executable && props.status.program.status === "ready", label: "Solana program is live on Devnet" },
    { ready: !!props.status?.protocol.initialized, label: "Protocol initialized" },
    { ready: !!market?.address && isOnchainMarketOpen(market.onchainStatus ?? null), label: `${place} market open` },
    { ready: !!evidenceReady, label: "NOAA station data pinned on-chain" },
    { ready: !!market?.vaultBalance && /^\d+$/.test(market.vaultBalance) && BigInt(market.vaultBalance) > 0n, label: "Payout vault funded" },
  ];
  const readyCount = checks.filter((c) => c.ready).length;
  const hasPosition = props.claimReadiness && props.claimReadiness.state !== "no_position";
  const isExistingPosition = !!props.unavailableReason && /already has|duplicate position|pending outcome/i.test(props.unavailableReason);
  const blocking = props.unavailableReason && !isExistingPosition && !(hasPosition && props.transactionSignature) && !/^Connect your Devnet wallet|finalized SKYT wallet balance/.test(props.unavailableReason) ? props.unavailableReason : null;
  const thresholdMm = market?.thresholdMmX100 != null && /^\d+$/.test(String(market.thresholdMmX100)) ? trimMm(Number(market.thresholdMmX100) / 100) : null;
  const stage = payoutStage(props.claimReadiness);
  const pilotClose = props.status?.desMoinesMarket.salesCloseAt;
  const salesClosed = !live && typeof pilotClose === "number" && pilotClose <= props.nowSeconds;
  const pay = payState({ premiumBase: q?.premium, busy: props.quoteBusy, error: props.quoteError, live, salesClosed, walletConnected: props.walletConnected });
  const reviewWhy = reviewReason(props.walletConnected, pay);
  const covered = props.coveredPosition ?? null;
  const showTicket = !!props.transactionSignature || !!hasPosition || !!covered;
  const triggerSym = market?.operator === "gt" ? ">" : market?.operator === "lt" ? "<" : market?.operator === "lte" ? "≤" : "≥";
  const triggerLabel = thresholdMm ? `${triggerSym} ${thresholdMm} mm` : "—";
  const windowLabel = market?.observationStart && market?.observationEnd
    ? `${shortUtcDate(market.observationStart)} – ${shortUtcDate(market.observationEnd - 1)}`
    : "—";
  const paidLabel = q ? `${formatSkytFixed(q.premium, 2)} SKYT` : "—";
  const payoutLabel = props.amountBase ? `${formatSkytFixed(props.amountBase, 0)} SKYT` : "—";

  const sourceName = consumer?.source ?? "NOAA station";
  const expiryBit = market ? expiryChipLabel(market)?.split(" · ")[0] ?? "expiry" : "expiry";
  return <>
    <ScreenTop hideDevnet onBack={props.onBackToMarkets} eyebrow="Rain" title={place} lead={measuredAtLine(sourceName, expiryBit)} />
    <ProtectChain
      city={props.city ?? market?.city ?? props.windows?.[0]?.city ?? "new-york"}
      windows={windows}
      selectedAddress={market?.address ?? null}
      nowSeconds={props.nowSeconds}
      evidence={props.windowEvidence ?? null}
      evidenceLoading={!!props.evidenceLoading}
      onSelectWindow={(address) => props.onSelectWindow?.(address)}
      cities={props.cities}
      onCity={props.onCity}
      amounts={options.filter((option) => option.id !== "max").map((option) => ({ id: option.id, label: `${option.label} SKYT`, onPress: () => props.onCoverage(option) }))}
      selectedAmountId={props.coverageId}
      surface={props.surface}
      nextOpenCopy={props.nextOpenCopy}
      openCity={props.openCity}
      onRefresh={props.onRefresh}
    />
    {showTicket ? null : stage ? <PayoutStatusCard stage={stage} dates={trackerDates(market, props.claimReadiness)} /> : null}

    {balance === "short" && q && !showTicket ? <Text style={[s.chipMsg, { color: C.coral }]} accessibilityRole="alert">Not enough SKYT: you need {formatSkytFixed(q.premium, 2)} SKYT. Pick less coverage or top up your wallet.</Text> : null}

    {blocking && props.surface === "ready" && evidenceReady && !showTicket ? <View style={s.calm}><Text style={s.noticeTitle}>Not ready to price yet</Text><Text style={s.noticeBody}>{friendlyError(blocking)}</Text><Pressable accessibilityRole="button" onPress={props.onRefresh} style={s.inlineBtn}><Text style={s.link}>Refresh</Text></Pressable></View> : null}
    {props.quoteError && props.surface === "ready" && !showTicket ? <View style={s.calm}><Text style={s.noticeTitle}>{quoteErrorTitle(props.quoteError)}</Text><Text style={s.noticeBody}>{friendlyError(props.quoteError)}</Text><Pressable accessibilityRole="button" onPress={props.onRetryQuote} style={s.inlineBtn}><Text style={s.link}>Retry</Text></Pressable></View> : null}
    {props.buyPhase && !(covered && props.buyPhase === "failed") ? <BuyProgress phase={props.buyPhase} error={props.transactionError} detail={props.transactionDetail} signature={props.transactionSignature} onRetry={props.onRetryBuy} onWallet={props.onViewWallet} /> : null}
    {!props.buyPhase && props.transactionMessage ? <Text accessibilityLiveRegion="polite" style={[s.body, { color: C.rain, marginBottom: S.md }]}>{props.transactionMessage}</Text> : null}
    {!props.buyPhase && props.transactionError && !covered ? <View style={[s.notice, { borderColor: C.coral }]} accessibilityRole="alert"><Text style={s.noticeTitle}>{transactionErrorTitle(props.transactionError, props.walletName)}</Text><Text style={s.noticeBody}>{props.transactionError}</Text><Pressable accessibilityRole="button" onPress={props.onRetryBuy} style={s.inlineBtn}><Text style={s.link}>Retry</Text></Pressable></View> : null}

    {covered ? <Reveal><CoveredCard position={covered} signature={props.transactionSignature} onWallet={props.onViewWallet} /></Reveal> : null}
    {showTicket && !covered ? <Reveal><CoverageTicket
      status={coverageTicketStatus(props.claimReadiness)}
      trigger={thresholdMm ? `${triggerLabel} cumulative` : "—"}
      window={windowLabel}
      paid={paidLabel}
      payout={payoutLabel}
      quoteReady={!!q || !!props.transactionSignature || !!hasPosition}
      reviewedDetail={reviewWhy}
      approved={!!props.transactionSignature || !!hasPosition}
      active={!!props.transactionSignature || !!hasPosition}
      watching={!!hasPosition && (props.claimReadiness?.state === "pending" || props.claimReadiness?.state === "claimable")}
      settled={props.claimReadiness?.state === "claimed"}
      signature={props.transactionSignature}
      station={station}
      positionReason={props.claimReadiness?.reason ?? null}
      observationMm={props.claimReadiness?.observation ? Number(props.claimReadiness.observation.rainfallMmX100) / 100 : null}
      triggerMm={thresholdMm != null ? Number(thresholdMm) : null}
      resolutionSignature={props.claimReadiness?.resolutionSignature ?? null}
      onAgain={() => props.onProtectAgain?.()}
      onMarkets={() => props.onBackToMarkets?.()}
    /><Text style={[s.caption, { marginTop: S.sm, marginBottom: S.sm, textAlign: "center" }]}>One protection per wallet per window.</Text></Reveal> : null}
    {isExistingPosition && !props.transactionSignature && !covered ? <Text style={[s.caption, { marginBottom: S.sm }]}>One protection per wallet per window — this wallet is already covered.</Text> : null}

    {props.claimReadiness?.state === "claimable" && props.claimReadiness.action === "claim_payout" ? <GlassCard accent={C.mint}>
      <Text style={s.overlineIn}>Trigger hit · payout ready</Text>
      {props.claimReadiness.amount ? <Text style={s.payoutBig}>+{formatSkytFixed(props.claimReadiness.amount, 0)} <Text style={s.unitMono}>SKYT</Text></Text> : null}
      {props.claimReadiness.observation ? <Row label="Observed" value={`${(Number(props.claimReadiness.observation.rainfallMmX100) / 100).toFixed(1)} mm · NOAA`} /> : null}
      {thresholdMm ? <Row label="Trigger" value={`${thresholdMm} mm`} gold /> : null}
      <Text style={s.caption}>No claims form. Tap “Collect payout to wallet” below and approve once in your wallet.</Text>
    </GlassCard> : null}
    {!showTicket && props.claimError && props.walletConnected ? <Text style={s.caption}>{friendlyError(props.claimError)}</Text> : null}

    <GlassCard>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: verifyOpen }} accessibilityLabel={`How it's verified, ${readyCount} of ${checks.length} checks passed`} onPress={() => setVerifyOpen((v) => !v)} style={[s.between, { minHeight: MIN_TOUCH }]}>
        <View style={{ flex: 1 }}><Text style={s.cardTitleSm}>How it’s verified</Text><Text style={s.caption}>{readyCount} of {checks.length} on-chain checks passed</Text></View>
        <AppIcon name={verifyOpen ? "chevron-up" : "chevron-down"} color={C.muted} size={20} />
      </Pressable>
      {verifyOpen ? <View style={{ marginTop: S.sm }}>
        {checks.map((c) => <View key={c.label} style={s.checkRow}><AppIcon name={c.ready ? "check" : "clock"} color={c.ready ? C.mint : C.quiet} size={16} /><Text style={[s.body, { flex: 1, marginLeft: S.md }]}>{c.label}</Text></View>)}
        <Row label="Settlement source" value={`NOAA · ${station}`} />
        {market?.salesCloseAt ? <Row label="Sales close" value={`${new Date(market.salesCloseAt * 1_000).toISOString().replace("T", " ").slice(0, 16)} UTC`} /> : null}
        {q ? <Row label="Quote" value={`${q.inputsHash.slice(0, 10)} · ${q.modelVersion}`} /> : null}
        {market?.address ? <ExplorerButton url={`https://explorer.solana.com/address/${encodeURIComponent(market.address)}?cluster=devnet`} label="Market account on Explorer" /> : null}
      </View> : null}
    </GlassCard>
    <Disclosure>Devnet test token · parametric weather protection. SKYT has no monetary value. Your wallet shows and approves every transaction.</Disclosure>
  </>;
}

function coverageTicketStatus(r: ClaimReadiness | null): { label: string; tone: "live" | "warn" | "gold" | "neutral" } {
  if (!r || r.state === "no_position") return { label: "Active", tone: "live" };
  if (r.state === "claimed") return /refund|unavailable/i.test(r.result ?? "") ? { label: "Refunded", tone: "warn" } : { label: "Settled", tone: "live" };
  if (r.state === "claimable" && r.action === "claim_payout") return { label: "Payout ready", tone: "gold" };
  if (r.state === "claimable" && r.action === "claim_premium_refund") return { label: "Refund ready", tone: "warn" };
  if (r.state === "expired") return { label: "Expired", tone: "neutral" };
  if (r.state === "pending") return { label: "Watching NOAA", tone: "live" };
  return { label: "Active", tone: "live" };
}

/** Graphite coverage ticket after Phantom approval: status, terms rows, vertical flow timeline. */
function CoverageTicket(props: {
  status: { label: string; tone: "live" | "warn" | "gold" | "neutral" };
  trigger: string;
  window: string;
  paid: string;
  payout: string;
  quoteReady: boolean;
  reviewedDetail: string | null;
  approved: boolean;
  active: boolean;
  watching: boolean;
  settled: boolean;
  signature: string | null;
  station: string;
  positionReason: string | null;
  observationMm: number | null;
  triggerMm: number | null;
  resolutionSignature: string | null;
  onAgain: () => void;
  onMarkets: () => void;
}) {
  const reviewedDone = props.approved || (props.quoteReady && !props.reviewedDetail);
  const steps: Array<{ label: string; detail: string | null; done: boolean; current: boolean }> = [
    { label: "Quote", detail: null, done: props.quoteReady, current: !props.quoteReady },
    { label: "Reviewed", detail: props.reviewedDetail, done: reviewedDone, current: !!props.reviewedDetail || (props.quoteReady && !props.approved) },
    { label: "Approved in Phantom", detail: null, done: props.approved, current: reviewedDone && !props.approved },
    { label: "Active", detail: null, done: props.active, current: props.approved && !props.watching && !props.settled },
    { label: "Watching NOAA", detail: props.watching ? `NOAA · ${props.station}` : props.settled ? "Settlement complete" : null, done: props.watching || props.settled, current: props.watching && !props.settled },
  ];
  const pillTone = props.status.tone;
  const pillCol = pillTone === "live" ? C.mint : pillTone === "warn" ? C.amber : pillTone === "gold" ? C.payout : C.muted;

  return <GlassCard accent={pillCol} style={{ marginBottom: S.lg }}>
    <View style={s.resultCopy}>
      <Text style={s.cardTitleSm} android_hyphenationFrequency="none">Coverage ticket</Text>
      <View style={[s.statusPill, s.compactChip, { borderColor: pillCol + "77", backgroundColor: pillCol + "1F", boxShadow: statusGlow(pillCol) }]} accessible accessibilityLabel={props.status.label}>
        <View style={[s.dot, { backgroundColor: pillCol }]} />
        <Text style={[s.pillText, { color: pillCol }]}>{props.status.label}</Text>
      </View>
    </View>
    <View style={{ marginTop: S.md }}>
      <Row label="Trigger" value={props.trigger} gold />
      <Row label="Window" value={props.window} />
      <Row label="Paid" value={props.paid} />
      <Row label="Payout" value={props.payout} gold />
      {props.signature ? <Row label="Tx" value={`${shortAddress(props.signature)} ↗`} /> : null}
      <View style={s.row}><Text style={s.rowLabel}>Network</Text><Text style={[s.rowValue, { color: C.payout }]}>Solana Devnet</Text></View>
      {props.signature ? <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(`https://explorer.solana.com/tx/${encodeURIComponent(props.signature!)}?cluster=devnet`); }} style={s.inlineBtn}><Text style={s.link}>View on Explorer ↗</Text></Pressable> : null}
    </View>
    <View style={s.ticketHr} />
    <Text style={s.overlineIn}>Status</Text>
    {steps.map((st, i) => {
      const col = st.done ? C.mint : st.current ? C.rain : C.muted;
      return <Enter key={st.label} index={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: S.md, marginTop: S.sm }}>
        <View style={[s.stepNode, { borderColor: col, backgroundColor: st.done || st.current ? col : "transparent" }]} />
        <View style={{ flex: 1 }}>
          <Text style={[s.body, { color: st.done || st.current ? C.ink : C.muted, fontFamily: st.current ? F.bodySemi : F.body }]}>{st.label}</Text>
          {st.detail ? <Text style={[s.stepWhyText, { marginTop: 2 }]}>{st.detail}</Text> : null}
        </View>
      </Enter>;
    })}
    {props.positionReason ? <Text style={[s.caption, { marginTop: S.md }]}>{props.positionReason}</Text> : null}
    {props.observationMm != null ? <Row label="Verified rainfall" value={`${props.observationMm.toFixed(1)} mm · NOAA`} /> : null}
    {props.observationMm != null && props.triggerMm != null && notTriggeredLine(props.observationMm, props.triggerMm) ? <Text style={[s.caption, { color: C.payout, marginTop: S.sm }]}>{notTriggeredLine(props.observationMm, props.triggerMm)}</Text> : null}
    {props.resolutionSignature ? <ExplorerButton url={`https://explorer.solana.com/tx/${encodeURIComponent(props.resolutionSignature)}?cluster=devnet`} label="Settlement proof" /> : null}
    <View style={{ marginTop: S.lg }}><ActionButton label="Protect again" icon="shield" onPress={props.onAgain} /></View>
    <Pressable accessibilityRole="button" onPress={props.onMarkets} style={[s.inlineBtn, { alignSelf: "center", marginTop: S.sm }]}><Text style={s.link}>Back to markets</Text></Pressable>
  </GlassCard>;
}


/** Inactive rail track: muted ink at 40% so pending steps read as "not yet", not as missing. */
const RAIL_TRACK = "rgba(163,174,188,0.40)";
function StepBar({ step, reason }: { step: FlowStep; reason?: string | null }) {
  const why = reason ?? null;
  return <View style={{ marginTop: S.xs, marginBottom: S.sm }} accessible accessibilityLabel={why ? `${stepLabel(step)}. Step 3, Review: ${why}` : stepLabel(step)}>
    <Text style={[s.stepLabel, step === 3 && { color: C.rain }]}>{stepLabel(step)}</Text>
    <View style={{ flexDirection: "row", gap: S.sm - 2, marginTop: S.sm }}>{[1, 2, 3].map((n) => <View key={n} style={{ flex: 1 }}><ProgressRail progress={n <= step ? 1 : 0} color={C.rain} track={RAIL_TRACK} /></View>)}</View>
    {why ? <View style={s.stepWhy}><AppIcon name="info" color={C.rain} size={14} /><Text style={s.stepWhyText}>Step 3 · Review: {why}</Text></View> : null}
  </View>;
}

type TrackerMarket = { observationEnd: number | null } | undefined;
/** Per-step timestamps from real market/position data only. A step with no known time gets no date. */
export function trackerDates(market: TrackerMarket, r: ClaimReadiness | null): Array<string | null> {
  const windowEnd = utcDateTime(market?.observationEnd ?? null);
  const checked = r?.observationSignature && r.observation ? `Recorded · window to ${utcDateTime(r.observation.windowEnd) ?? "—"}` : r?.observationSignature ? "Recorded on-chain" : windowEnd ? "After the window ends" : null;
  const result = r?.claimDeadline ? `Claim by ${utcDateTime(r.claimDeadline)}` : null;
  return [null, windowEnd, checked, result];
}

export function PayoutStatusCard({ stage, dates }: { stage: NonNullable<ReturnType<typeof payoutStage>>; dates?: Array<string | null> }) {
  const col = stage.tone === "mint" ? C.mint : stage.tone === "amber" ? C.amber : stage.tone === "rain" ? C.rain : C.muted;
  const steps = stage.key === "refund" || stage.key === "refunded" ? ["Protected", "Rain window ended", "Weather data unavailable", "Refund"] : [...PAYOUT_STEPS];
  return <View accessibilityLiveRegion="polite" accessible accessibilityLabel={`Your protection: ${stage.title}. ${stage.body}`}>
    <GlassCard accent={col}>
      <Text style={s.stepLabel}>Your protection</Text>
      <Text style={[s.statusTitle, { color: col }]}>{stage.title}</Text>
      <View style={{ marginTop: S.md, marginBottom: S.xs }}><ProgressRail progress={steps.length ? stage.done / steps.length : 0} color={col} track={C.border} /></View>
      {steps.map((label, i) => <Enter key={label} index={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: S.md, marginTop: S.sm }}>
        <View style={[s.stepNode, i < stage.done ? { backgroundColor: col, borderColor: col } : { borderColor: C.muted }]} />
        <View style={{ flex: 1 }}>
          <Text style={[s.body, i >= stage.done && { color: C.muted }]}>{label}</Text>
          {dates?.[i] ? <Text style={[s.caption, { color: C.muted }]}>{dates[i]}</Text> : null}
        </View>
      </Enter>)}
      <Text style={[s.caption, { marginTop: S.md }]}>{stage.body}</Text>
    </GlassCard>
  </View>;
}

export function StickyCta(props: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; busyLabel?: string; hint?: string | null; pay?: string | null; getLabel?: string | null; payBase?: string | null; getBase?: string | null }) {
  const bars = payGetBarWidths(props.payBase, props.getBase);
  return <View style={s.sticky}>
    {props.pay && props.getLabel && bars ? <View style={s.ticketBars} accessibilityLabel={`You pay ${props.pay} SKYT, you get ${props.getLabel} SKYT`}>
      <View style={s.ticketRow}><View style={s.ticketTrack}><View style={[s.payBar, { width: `${bars.pay * 100}%` }]} /></View><Text numberOfLines={1} style={s.ticketLabel}>You pay {props.pay} SKYT</Text></View>
      <View style={s.ticketRow}><View style={s.ticketTrack}><View style={[s.getBar, { width: `${bars.get * 100}%` }]} /></View><Text numberOfLines={1} style={[s.ticketLabel, { color: C.payout }]}>You get {props.getLabel} SKYT</Text></View>
    </View> : null}
    {props.hint ? <Text style={[s.caption, { textAlign: "center", marginBottom: S.sm }]}>{props.hint}</Text> : null}
    <ActionButton label={props.label} busyLabel={props.busyLabel} icon="arrow-right" disabled={props.disabled} busy={props.busy} onPress={props.onPress} />
  </View>;
}

export function ConfirmCover(props: { sentence: string; station: string; expiry: string; windowLabel: string; pay: string; getLabel: string; onClose: () => void; onApprove: () => void }) {
  return <View style={s.sheetScrim}>
    <View style={s.sheet} accessibilityViewIsModal accessibilityLabel="Confirm protection">
      <Text style={s.bodyStrong}>{props.sentence}</Text>
      <Text style={[s.caption, { marginTop: S.sm }]}>Station · {props.station}</Text>
      <Text style={s.caption}>Window · {props.windowLabel}</Text>
      <Text style={s.caption}>Settlement · after {props.expiry}</Text>
      <Text style={s.caption}>You pay {props.pay} SKYT</Text>
      <Text style={[s.caption, { color: C.payout }]}>You get {props.getLabel} SKYT</Text>
      <Text style={[s.caption, { marginTop: S.sm }]}>Phantom will ask you to approve this protection.</Text>
      <View style={s.sheetActions}>
        <Pressable accessibilityRole="button" onPress={props.onClose} style={s.sheetBack}><Text style={s.bodyStrong}>Back</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={approveInPhantomLabel(props.pay)} onPress={props.onApprove} style={s.sheetGo}><Text style={[s.bodyStrong, { color: C.canvas, textAlign: "center" }]}>{approveInPhantomLabel(props.pay)}</Text></Pressable>
      </View>
    </View>
  </View>;
}

/** Calm state when this wallet already holds the selected window. Values come from the position account only. */
function CoveredCard(props: { position: ChainProtection; signature: string | null; onWallet?: () => void }) {
  return <GlassCard accent={C.rain}>
    <View accessibilityRole="summary" accessibilityLabel="You’re covered on this window">
      <View style={s.baseline}><AppIcon name="check" color={C.rain} size={18} /><Text style={[s.noticeTitle, { marginLeft: S.sm }]}>You’re covered</Text></View>
      <Text style={[s.noticeBody, { marginBottom: S.sm }]}>{coveredLead(props.position)}</Text>
      {coveredRows(props.position).map((row) => <Row key={row.label} label={row.label} value={row.value} gold={row.gold} />)}
      {props.signature ? <ExplorerButton url={`https://explorer.solana.com/tx/${encodeURIComponent(props.signature)}?cluster=devnet`} label="Transaction on Explorer" /> : null}
      <ExplorerButton url={props.position.explorerUrl} label="Position on Explorer" />
      {props.onWallet ? <Pressable accessibilityRole="button" onPress={props.onWallet} style={s.inlineBtn}><Text style={s.link}>View in Wallet</Text></Pressable> : null}
    </View>
  </GlassCard>;
}

function BuyProgress(props: { phase: BuyPhase; error: string | null; detail?: string | null; signature: string | null; onRetry?: () => void; onWallet?: () => void }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const title = buyPhaseLabel(props.phase);
  const pending = props.phase === "preparing" || props.phase === "waiting" || props.phase === "sending" || props.phase === "checking";
  return <View accessibilityLiveRegion="polite" accessibilityRole={props.phase === "failed" ? "alert" : "text"} style={[s.notice, props.phase !== "failed" && { backgroundColor: C.surfaceRaised, borderColor: C.rain }]}>
    <View style={s.baseline}>
      {pending ? <ActivityIndicator color={C.rain} style={{ marginRight: S.sm }} /> : null}
      <Text style={s.noticeTitle}>{title}</Text>
    </View>
    {props.phase === "waiting" ? <Text style={s.noticeBody}>Approve the protection in Phantom. This screen updates when Phantom returns.</Text> : null}
    {props.phase === "sending" ? <Text style={s.noticeBody}>Solana is confirming the transaction.</Text> : null}
    {props.phase === "confirmed" && props.signature ? <ExplorerButton url={`https://explorer.solana.com/tx/${encodeURIComponent(props.signature)}?cluster=devnet`} label="View on Explorer" /> : null}
    {props.phase === "confirmed" && props.onWallet ? <Pressable accessibilityRole="button" onPress={props.onWallet} style={s.inlineBtn}><Text style={s.link}>View in Wallet</Text></Pressable> : null}
    {props.phase === "failed" ? <Text style={s.noticeBody}>{props.error ?? "The transaction did not complete."}</Text> : null}
    {props.phase === "failed" && props.detail ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }} onPress={() => setDetailsOpen((open) => !open)} style={s.inlineBtn}><Text style={s.link}>{detailsOpen ? "Hide details" : "Details"}</Text></Pressable> : null}
    {props.phase === "failed" && detailsOpen && props.detail ? <Text style={s.noticeBody}>{props.detail}</Text> : null}
    {props.phase === "failed" && props.onRetry ? <Pressable accessibilityRole="button" onPress={props.onRetry} style={s.inlineBtn}><Text style={s.link}>Retry</Text></Pressable> : null}
  </View>;
}

function ExplorerButton({ url, label }: { url: string; label: string }) {
  return <Pressable accessibilityRole="link" accessibilityLabel={`${label}, opens Solana Explorer`} onPress={() => { void Linking.openURL(url); }} style={s.inlineBtn}><Text style={s.link}>{label} ↗</Text></Pressable>;
}

/* ───────────────────────────── Wallet ───────────────────────────── */

export function WalletV2(props: {
  wallet: string | null;
  walletName: string;
  balances: FinalizedWalletState | null;
  balancesError?: string | null;
  balancesLoading?: boolean;
  portfolio: Portfolio | null;
  portfolioError: string | null;
  walletError: string | null;
  loading: boolean;
  marketAddress: string | null;
  windows?: SellingWindow[];
  claimReadiness?: ClaimReadiness | null;
  observationEnd?: number | null;
  onBrowseMarkets?: () => void;
  onConnect: () => void;
  onRetryBalances?: () => void;
  onDisconnect: () => void;
}) {
  const skytBase = props.balances?.skytBaseUnits ?? null;
  const stage = payoutStage(props.claimReadiness);
  const readingBalances = !props.balances && !props.balancesError && (props.balancesLoading || props.loading);
  return <>
    <ScreenTop title="Wallet" lead="Devnet balances and positions, read from Solana." />
    {props.walletError ? <View style={s.notice} accessibilityRole="alert"><Text style={s.noticeTitle}>Wallet didn’t connect — try again</Text><Text style={s.noticeBody}>{friendlyError(props.walletError)}</Text></View> : null}
    {!props.wallet ? <Enter index={0}><GlassCard>
      <Text style={s.cardTitle}>Connect a Solana wallet</Text>
      <Text style={[s.body, { color: C.muted, marginTop: S.sm }]}>Your wallet asks before sharing your address. Keys never leave it, and you approve every transaction there.</Text>
      <View style={{ marginTop: S.lg }}><ActionButton label="Connect wallet" icon="credit-card" busy={props.loading} onPress={props.onConnect} /></View>
    </GlassCard></Enter> : <>
      <GlassCard accent={C.rain} delay={0}>
        <View style={s.between}>
          <View style={[s.baseline, { flex: 1, minWidth: 0 }]}>
            <View style={s.avatar}><AppIcon name="credit-card" color={C.rain} size={18} /></View>
            <View style={{ flex: 1, minWidth: 0, marginLeft: S.md }}>
              <Text style={s.cardTitleSm} android_hyphenationFrequency="none">{props.walletName}</Text>
              <Text style={s.caption} accessibilityLabel={`Address ${props.wallet}`}>{shortAddress(props.wallet)}</Text>
            </View>
          </View>
          <Pill label="Connected" tone="live" />
        </View>
        <Text style={[s.sectionLabel, { marginTop: S.lg }]}>Available</Text>
        <View style={s.baseline}>
          <Text style={s.hugeFigure} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{skytBase != null ? formatSkytFixed(skytBase, 2) : "—"}</Text>
          <Text style={s.unit}>SKYT</Text>
        </View>
        {props.balances ? (
          <Text style={s.caption}>{props.balances.sol.toFixed(4)} SOL for fees</Text>
        ) : props.balancesError ? (
          <View style={{ marginTop: S.xs }} accessibilityRole="alert">
            <Text style={s.caption}>{friendlyError(props.balancesError, "Couldn’t read balances from Solana.")}</Text>
            {props.onRetryBalances ? (
              <Pressable accessibilityRole="button" onPress={props.onRetryBalances} style={s.inlineBtn} disabled={props.balancesLoading}>
                <Text style={s.link}>{props.balancesLoading ? "Retrying…" : "Retry balance read"}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Text style={s.caption}>{readingBalances ? "Reading balances from Solana…" : "Balances unavailable — pull to refresh or retry."}</Text>
        )}
        {readingBalances ? <View style={{ marginTop: S.md, alignItems: "flex-start" }}><ActivityIndicator color={C.rain} /></View> : null}
        {!props.balances && !props.balancesError && !readingBalances && props.onRetryBalances ? (
          <Pressable accessibilityRole="button" onPress={props.onRetryBalances} style={s.inlineBtn}><Text style={s.link}>Retry balance read</Text></Pressable>
        ) : null}
        <View style={{ marginTop: S.md }}><ExplorerButton url={`https://explorer.solana.com/address/${encodeURIComponent(props.wallet)}?cluster=devnet`} label="Open in Explorer" /></View>
      </GlassCard>

      {stage ? <PayoutStatusCard stage={stage} dates={trackerDates({ observationEnd: props.observationEnd ?? null }, props.claimReadiness ?? null)} /> : null}
      <Text style={s.overline}>My protections</Text>
      <GlassCard delay={2 * motion.stagger}>
        {props.portfolio?.indexed && props.portfolio.protections.length ? props.portfolio.protections.map((p) => {
          return <View key={p.address} style={s.positionBlock}>
            <Text style={s.cardTitleSm} android_hyphenationFrequency="none">{p.city ?? positionLabel(p.market, props.windows ?? [], props.marketAddress) ?? `Market ${shortAddress(p.market)}`}</Text>
            <Text style={s.caption}>Window · {p.windowLabel ?? "—"}</Text>
            <Text style={s.caption}>Trigger · {p.triggerLabel ?? "—"}</Text>
            <Text style={s.caption}>Paid · {formatSkytFixed(p.premiumPaid, 2)} SKYT</Text>
            <Text style={s.caption}>Payout · {formatSkytFixed(p.potentialPayout ?? p.protectedAmount, 0)} SKYT</Text>
            <Text style={s.caption}>Status · {p.statusLabel ?? "Active"}</Text>
            <ExplorerButton url={p.explorerUrl ?? `https://explorer.solana.com/address/${encodeURIComponent(p.address)}?cluster=devnet`} label="Position on Explorer" />
          </View>;
        }) : props.portfolio?.indexed ? <View style={s.emptyCard}>
          <AppIcon name="umbrella" color={C.rain} size={22} />
          <Text style={s.body}>No protections yet</Text>
          {props.onBrowseMarkets ? <Pressable accessibilityRole="link" onPress={props.onBrowseMarkets} style={s.inlineBtn}><Text style={s.link}>Protect</Text></Pressable> : null}
        </View> : props.portfolioError ? <View style={s.emptyCard} accessibilityRole="alert">
          <AppIcon name="alert-circle" color={C.coral} size={22} />
          <Text style={s.body}>{friendlyError(props.portfolioError, "Couldn’t read protections from Solana.")}</Text>
          {props.onRetryBalances ? <Pressable accessibilityRole="button" onPress={props.onRetryBalances} style={s.inlineBtn}><Text style={s.link}>Retry</Text></Pressable> : null}
        </View> : <View style={s.emptyCard}>
          <ActivityIndicator color={C.rain} />
          <Text style={[s.body, { color: C.muted }]}>Reading protections from Solana…</Text>
        </View>}
      </GlassCard>

      <View style={{ marginTop: S.lg }}><ActionButton variant="secondary" label="Disconnect" icon="log-out" onPress={props.onDisconnect} /></View>
    </>}
    <Disclosure>Balances are read directly from Solana Devnet. Missing values are shown as —, never as zero.</Disclosure>
  </>;
}

/* Styles resolve to theme tokens: T (type scale), S (4/8pt spacing). Colours unchanged. */
const s = StyleSheet.create({
  stepLabel: { ...T.overline, color: C.quiet, fontSize: 12, letterSpacing: 1.2 },
  stepWhy: { flexDirection: "row", alignItems: "center", gap: S.xs + 2, marginTop: S.sm },
  stepWhyText: { ...T.caption, color: C.ink, flex: 1 },
  stepDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.border },
  stepNode: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: C.border, marginTop: 5 },
  statusTitle: { ...T.title, fontSize: 22, lineHeight: 28, marginTop: S.xs },
  eyebrowCaps: { ...T.overline, color: C.quiet, letterSpacing: 1.2 },
  devnetTag: { borderWidth: 1, borderColor: C.amber + "66", backgroundColor: C.amberSoft, borderRadius: 12, paddingHorizontal: S.md, paddingVertical: S.xs },
  devnetTagText: { ...T.label, color: C.amber, fontSize: 12, lineHeight: 16 },
  search: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: S.md, paddingHorizontal: S.lg, borderRadius: glass.radius, backgroundColor: glass.fillField, borderWidth: 1, borderColor: glass.border, marginTop: S.lg, marginBottom: S.md, boxShadow: glass.fieldShadow },
  searchInput: { ...T.body, flex: 1, minHeight: 48, color: C.ink, fontSize: 16 },
  regionChip: { minHeight: 36, justifyContent: "center", paddingHorizontal: S.md, borderRadius: 999, borderWidth: 1, borderColor: glass.borderStrong, backgroundColor: C.surfaceRaised },
  regionChipOn: { borderColor: "#F2C230", backgroundColor: C.surfaceRaised },
  regionChipText: { ...T.label, color: C.muted },
  regionChipTextOn: { color: C.actionText, fontFamily: F.bodySemi },
  regionChipN: { fontFamily: F.mono, fontSize: 12, color: C.quiet, fontVariant: TAB },
  regionChipNOn: { color: C.actionText },
  resultRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: S.md, paddingHorizontal: S.sm, paddingVertical: S.sm, borderRadius: 16, borderWidth: 1, borderColor: "transparent", marginBottom: S.xs },
  resultCopy: { flex: 1, minWidth: 0, alignItems: "flex-start", gap: 2 },
  resultName: { ...T.bodyStrong, color: C.ink, fontFamily: F.bodyMedium, alignSelf: "stretch" },
  resultSub: { ...T.caption, color: C.muted, alignSelf: "stretch" },
  compactChip: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  compactChipText: { fontFamily: F.bodyBold, fontSize: 12, lineHeight: 16 },
  browseLink: { minHeight: MIN_TOUCH, justifyContent: "center", alignSelf: "flex-start", marginTop: -S.sm, marginBottom: S.lg },
  moreRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: S.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  triggerBig: { ...T.amountL, color: C.payout, textShadowColor: C.payout + "73", textShadowRadius: 14 },
  fromFigure: { ...T.amountM, fontSize: 30, lineHeight: 38, color: C.ink },
  unitMono: { ...T.unit, color: C.muted, fontWeight: "400", letterSpacing: 0 },
  barHit: { backgroundColor: C.payout, opacity: 1 },
  payoutBig: { ...T.amountXL, lineHeight: 58, color: C.mint, textShadowColor: "rgba(52,211,153,0.55)", textShadowRadius: 18, marginBottom: S.sm },
  h1: { ...T.display, color: C.ink, letterSpacing: -1 },
  lead: { ...T.lead, color: C.muted, marginTop: S.xs, marginBottom: S.lg },
  eyebrow: { ...T.label, color: C.muted, fontFamily: F.bodyMedium, marginBottom: S.xxs },
  overline: { ...T.overline, color: C.quiet, marginTop: S.xl, marginBottom: S.sm },
  overlineIn: { ...T.overline, color: C.quiet, marginBottom: S.sm },
  sectionLabel: { ...T.overline, color: C.quiet, marginBottom: S.sm },
  card: { backgroundColor: C.surfaceRaised, borderColor: glass.border, borderWidth: 1, borderRadius: glass.radius, padding: S.lg, marginBottom: S.lg },
  cardTitle: { ...T.cardTitle, color: C.ink },
  cardTitleSm: { ...T.bodyStrong, color: C.ink, fontSize: 16 },
  cardSub: { ...T.label, color: C.muted, fontFamily: F.body, marginTop: S.xxs },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: S.md },
  baseline: { flexDirection: "row", alignItems: "center" },
  smallLabel: { ...T.label, color: C.muted, fontFamily: F.bodyMedium },
  bigFigure: { ...T.amountXL, fontSize: 44, lineHeight: 52, color: C.ink },
  hugeFigure: { ...T.amountXL, fontSize: 46, lineHeight: 54, color: C.ink, textShadowColor: C.rain + "59", textShadowRadius: 14 },
  unit: { color: C.muted, fontFamily: F.bodySemi, fontSize: 16, lineHeight: 22, marginLeft: S.sm, marginTop: S.sm },
  trigger: { ...T.title, fontSize: 22, color: C.payout, fontVariant: TAB },
  caption: { ...T.caption, color: C.quiet },
  body: { ...T.body, color: C.ink },
  bodyStrong: { color: C.ink, fontFamily: F.bodyBold, fontVariant: TAB },
  perilRow: { flexDirection: "row", flexWrap: "wrap", gap: S.sm, marginTop: S.md },
  perilChip: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: S.xs + 2, paddingHorizontal: S.md, borderRadius: 14, borderWidth: 1 },
  perilChipLive: { borderColor: C.mint + "77", backgroundColor: C.mintSoft, boxShadow: `0px 0px 12px ${C.mint}40` },
  perilChipSoon: { borderColor: C.border, backgroundColor: C.surface, opacity: 0.9 },
  perilChipLiveText: { ...T.label, color: C.mint },
  perilChipSoonText: { ...T.label, color: C.quiet },
  perilSoonTag: { ...T.overline, color: C.amber, fontSize: 10, lineHeight: 12, letterSpacing: 0.6 },
  chipRow: { flexDirection: "row", gap: S.sm, marginBottom: S.md },
  hazardChip: { minHeight: 44, paddingHorizontal: S.lg, borderRadius: 22, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  hazardChipOn: { borderColor: C.rain, backgroundColor: C.rainSoft },
  hazardText: { ...T.label, color: C.muted, fontFamily: F.bodyMedium, fontSize: 14 },
  chip: { flex: 1, minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: glass.border, backgroundColor: C.surfaceRaised, alignItems: "center", justifyContent: "center" },
  chipOn: { borderColor: C.rain, backgroundColor: C.rainSoft, boxShadow: `0px 0px 16px ${C.rain}59` },
  chipPressed: { backgroundColor: C.rain + "1A", borderColor: C.rain + "66" },
  chipShort: { borderColor: C.coral, backgroundColor: C.redSoft, boxShadow: "none" },
  chipDisabled: { borderStyle: "dashed", backgroundColor: "transparent", opacity: 0.7 },
  chipMsg: { ...T.caption, marginTop: -S.xs, marginBottom: S.md },
  payState: { ...T.bodyStrong, fontSize: 17, lineHeight: 24, color: C.ink, marginTop: S.sm, marginBottom: S.xs },
  skeletonWrap: { flexDirection: "row", alignItems: "center", gap: S.sm, height: 42, marginTop: S.xs },
  skeleton: { width: 72, height: 24, borderRadius: 6, backgroundColor: C.mutedSurface },
  positionBlock: { alignItems: "flex-start", gap: 2, marginBottom: S.md },
  emptyCard: { alignItems: "flex-start", gap: S.sm },
  chipText: { ...T.bodyStrong, color: C.ink, fontVariant: TAB, letterSpacing: -0.1 },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: S.sm, marginTop: S.lg, marginBottom: S.sm },
  barCol: { flex: 1, justifyContent: "flex-end", height: "100%" },
  bar: { backgroundColor: C.rain, opacity: 0.45, borderRadius: 3 },
  barCurrent: { backgroundColor: C.rain, opacity: 1 },
  barUnknown: { height: 2, backgroundColor: C.muted },
  strike: { position: "absolute", left: 0, right: 0, height: 1, flexDirection: "row", justifyContent: "space-between", overflow: "hidden", zIndex: 2 },
  dash: { width: 4, height: 1, backgroundColor: C.payout },
  split: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border },
  splitCell: { flex: 1, padding: S.lg },
  splitFigure: { ...T.amountM, fontSize: 34, lineHeight: 42, color: C.ink, marginTop: S.xs },
  row: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: S.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  rowLabel: { ...T.body, color: C.muted, flexShrink: 0 },
  rowValue: { ...T.bodyStrong, color: C.ink, fontVariant: TAB },
  notice: { backgroundColor: C.redSoft, borderColor: C.coral, borderWidth: 1, borderRadius: glass.radius - 10, padding: S.lg, marginBottom: S.md },
  calm: { backgroundColor: C.mutedSurface, borderColor: C.border, borderWidth: 1, borderRadius: glass.radius - 10, padding: S.lg, marginBottom: S.md },
  noticeWarn: { backgroundColor: C.amberSoft, borderColor: C.amber + "88" },
  noticeTitle: { ...T.bodyStrong, color: C.ink },
  noticeBody: { ...T.body, fontSize: 14, lineHeight: 20, color: C.muted, marginTop: S.xs },
  inlineBtn: { minHeight: MIN_TOUCH, justifyContent: "center", alignSelf: "flex-start" },
  link: { ...T.label, fontSize: 14, lineHeight: 20, color: C.rain },
  checkRow: { minHeight: 40, flexDirection: "row", alignItems: "center" },
  sticky: { paddingHorizontal: S.lg + 2, paddingTop: S.sm, paddingBottom: S.md, backgroundColor: C.canvas + "F2", borderTopWidth: 1, borderTopColor: glass.border },
  ticketBars: { gap: 6, marginBottom: S.sm },
  ticketRow: { flexDirection: "row", alignItems: "center", gap: S.sm },
  ticketTrack: { flex: 1, height: 10, borderRadius: 5, overflow: "hidden" },
  ticketLabel: { ...T.caption, width: 136, textAlign: "right", color: C.muted, fontVariant: ["tabular-nums"] },
  payBar: { height: 10, borderRadius: 5, backgroundColor: C.muted },
  getBar: { height: 10, borderRadius: 5, backgroundColor: C.payout },
  sheetScrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 40, justifyContent: "flex-end", backgroundColor: "#00000066", padding: S.lg },
  sheet: { borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceRaised, padding: S.lg },
  sheetActions: { flexDirection: "row", gap: S.sm, marginTop: S.md },
  sheetBack: { paddingHorizontal: S.lg, minHeight: MIN_TOUCH, alignItems: "center", justifyContent: "center", borderRadius: 24, borderWidth: 1, borderColor: C.border },
  sheetGo: { flex: 1, paddingHorizontal: S.sm, paddingVertical: S.sm, minHeight: MIN_TOUCH, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: C.ink },
  netPill: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: S.sm, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: S.md, backgroundColor: C.surface },
  netPillText: { ...T.label, fontSize: 12, lineHeight: 16, color: C.ink },
  pill: { minHeight: 28, flexShrink: 0, flexDirection: "row", alignItems: "center", gap: S.sm - 2, borderRadius: 14, paddingHorizontal: S.md - 2 },
  pillText: { ...T.label, fontSize: 12, lineHeight: 16 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.rainSoft, alignItems: "center", justifyContent: "center" },
  positionRow: { minHeight: 56, paddingVertical: S.sm },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 14, paddingHorizontal: 11, minHeight: 28 },
  ticketHr: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginVertical: S.lg },
});
