import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { RadarMap, type MapScope } from "./RadarMap";
import { CountUp, GlassCard, GlobalGroups, StatusTag, statusLabel } from "./revamp";
import { GROUP_ORDER, highlightParts, MARKETS, searchMarkets, type CatalogMarket, type MarketGroup } from "./markets-catalog";
import { useReducedMotion } from "./liquid-glass";
import { CoverageHero, FactRows, PerilSelector, ScreenTop, StatPair } from "./journey";
import type { CityIndex, ClaimReadiness, DevnetStatus, FinalizedWalletState, Portfolio, ProtectionQuote } from "./api";
import { C, F, glass, MIN_TOUCH, motion, space as S, statusGlow, type as T } from "./theme";
import { Enter, ProgressRail, SpringPress } from "./motion";
import { ActionButton, AppIcon, Disclosure, Reveal, Text } from "./ui";
import { friendlyError, quoteErrorTitle, stationLabel, transactionErrorTitle } from "./friendly-errors";
import { dealSentence, payoutStage, PAYOUT_STEPS, stepLabel, type FlowStep } from "./consumer-flow";
import { formatOnchainMarketStatus, formatWeekLabel } from "./presentation";
import { isOnchainMarketOpen } from "./protection";
import { MARKETING_SHOTS } from "./marketing";
import { balanceCheck, coverageOptions, formatSkytFixed, premiumFeeLine, premiumPer100, returnMultiple, payState, reviewReason, salesCountdown, shortAddress, shortUtcDate, trimMm, triggerSentence, utcDateTime, type CoverageOption } from "./ticket";

const TAB = ["tabular-nums" as const];

/** Neutral Devnet pill with a green dot (header). Hidden in marketing screenshot builds. */
export function NetworkPill({ label = "Devnet" }: { label?: string }) {
  if (MARKETING_SHOTS) return null;
  return <View style={s.netPill} accessible accessibilityLabel={`Network: Solana ${label}`}>
    <View style={[s.dot, { backgroundColor: C.mint }]} />
    <Text style={s.netPillText}>{label}</Text>
  </View>;
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
  return <View style={s.row}><Text style={s.rowLabel}>{label}</Text><Text style={[s.rowValue, gold && { color: C.payout }]}>{value}</Text></View>;
}

export function marketIsLive(status: DevnetStatus | null, nowSeconds: number): boolean {
  const m = status?.desMoinesMarket;
  return !!m?.address && m.status === "ready" && isOnchainMarketOpen(m.onchainStatus)
    && !!m.vaultBalance && /^\d+$/.test(m.vaultBalance) && BigInt(m.vaultBalance) > 0n
    && !!m.salesCloseAt && m.salesCloseAt > nowSeconds;
}

/* ───────────────────────────── Markets ───────────────────────────── */

export function MarketsScreen(props: {
  status: DevnetStatus | null;
  city: CityIndex | null;
  indicativeQuote: ProtectionQuote | null;
  nowSeconds: number;
  onProtect: () => void;
  onOpenMarket?: (m: CatalogMarket) => void;
  guide?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<MapScope>("region");
  const [group, setGroup] = useState<MarketGroup | null>(null);
  const pickGroup = (grp: MarketGroup | null) => { setGroup(grp); setScope(grp === "North America" ? "region" : "global"); };
  const market = props.status?.desMoinesMarket;
  const city = props.city?.slug === "des-moines" ? props.city : null;
  const live = marketIsLive(props.status, props.nowSeconds);
  const thresholdMm = market?.thresholdMmX100 && /^\d+$/.test(market.thresholdMmX100) ? Number(market.thresholdMmX100) / 100 : null;
  const below = market?.operator === "lt" || market?.operator === "lte";
  const symbol = market?.operator === "gt" ? ">" : market?.operator === "lt" ? "<" : below ? "≤" : "≥";
  const history = (city?.weeklyHistoryMm ?? []).slice(-7);
  const values = history.map((w) => (w.mm != null && Number.isFinite(w.mm) && w.mm >= 0 ? w.mm : null));
  const scale = Math.max(1, thresholdMm ?? 0, ...values.map((v) => v ?? 0)) * 1.1;
  const lastKnown = values.reduce<number>((acc, v, i) => (v != null ? i : acc), -1);
  const CHART_H = 96;
  const per100 = props.indicativeQuote ? premiumPer100(props.indicativeQuote.premium, props.indicativeQuote.protectedAmount) : null;
  const countdown = salesCountdown(market?.salesCloseAt, props.nowSeconds);
  const station = stationLabel(props.status?.noaaEvidence.package?.stationId ?? "USW00014933");
  const state = live ? "Live" : market?.onchainStatus ? (countdown === "Sales closed" ? "Sales closed" : formatOnchainMarketStatus(market.onchainStatus)) : "Opens soon";

  const results = searchMarkets(query, group || query.trim() ? "all" : scope === "region" ? "region" : "global", group);
  const filtering = !!query.trim() || !!group;
  const highlight = new Set(filtering ? results.map((r) => r.code) : []);
  const focusCode = filtering && results[0] ? results[0].code : "DSM";
  const visibleRows = query.trim() ? results.slice(0, 6) : group ? results : results.filter((m) => m.status !== "concept");
  const moreConcepts = filtering ? Math.max(0, results.length - visibleRows.length) : results.filter((m) => m.status === "concept").length;
  const mapScope: MapScope = filtering && results[0] && results[0].group !== "North America" ? "global" : scope;
  const open = (m: CatalogMarket) => { if (m.status === "live") props.onProtect(); else props.onOpenMarket?.(m); };

  return <>
    <StepBar step={1} />
    <ScreenTop title="Where are your plans?" lead="Pick a city, then choose what to protect against inside it." />

    <Enter index={0}>
      <View style={s.search}>
        <AppIcon name="search" color={C.muted} size={18} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Find a covered zone" placeholderTextColor={C.quiet} style={s.searchInput} accessibilityLabel="Search markets" autoCorrect={false} returnKeyType="search" />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery("")} hitSlop={10}><AppIcon name="x" color={C.muted} size={18} /></Pressable> : null}
      </View>
    </Enter>

    <Enter index={1}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: S.md, flexGrow: 0 }} contentContainerStyle={{ gap: S.sm, paddingRight: S.sm }} accessibilityRole="tablist">
        {([null, ...GROUP_ORDER] as Array<MarketGroup | null>).map((grp) => {
          const on = group === grp;
          const n = grp ? MARKETS.filter((m) => m.group === grp).length : MARKETS.length;
          return <SpringPress key={grp ?? "all"} selected={on} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => pickGroup(grp)} style={[s.regionChip, on && s.regionChipOn]}>
            <Text style={[s.regionChipText, on && s.regionChipTextOn]}>{grp ?? "All"} <Text style={[s.regionChipN, on && s.regionChipNOn]}>{n}</Text></Text>
          </SpringPress>;
        })}
      </ScrollView>
    </Enter>

    <GlassCard style={{ paddingVertical: S.sm, paddingHorizontal: S.md }} delay={2 * motion.stagger}>
      <Text style={s.sectionLabel}>Covered zones</Text>
      {visibleRows.length ? visibleRows.map((m) => {
        const [a, b, c] = highlightParts(m.name, query);
        const col = m.status === "live" ? C.mint : m.status === "soon" ? C.amber : C.rain;
        const on = highlight.has(m.code) && m.code === focusCode;
        return <SpringPress key={m.code} accessibilityRole="button" accessibilityLabel={`${m.name}, ${m.status === "live" ? state : statusLabel(m.status)}`} onPress={() => open(m)} style={[s.resultRow, on && { backgroundColor: col + "14", borderColor: col + "55" }]}>
          <View style={[s.dot, m.status === "concept" ? { borderWidth: 1.5, borderColor: col } : { backgroundColor: col }]} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.resultName}>{a}<Text style={{ fontFamily: F.bodyBold, color: col }}>{b}</Text>{c}{m.code === "DSM" ? ", IA" : ""}</Text>
            {filtering || m.status === "ready" || m.status === "soon" || m.status === "live" ? <Text style={s.caption}>{m.code} · {m.country} · {m.source}</Text> : null}
          </View>
          <StatusTag status={m.status} label={m.status === "live" ? state : undefined} />
          <AppIcon name="chevron-right" color={C.quiet} size={16} />
        </SpringPress>;
      }) : <Text style={[s.caption, { padding: 10 }]}>No covered zone matches “{query}”.</Text>}
      {moreConcepts ? <Pressable accessibilityRole="button" onPress={() => { if (filtering) { setQuery(""); return; } setScope(scope === "region" ? "global" : "region"); }} style={s.moreRow}>
        <Text style={s.caption}>○  +{moreConcepts} {filtering ? "more matches" : `concept markets ${scope === "region" ? "in North America" : "worldwide"}`}</Text>
        <Text style={s.link}>{scope === "region" ? "Global →" : "Region →"}</Text>
      </Pressable> : null}
    </GlassCard>

    <RadarMap scope={mapScope} onScope={setScope} focusCode={focusCode} highlight={highlight} onSelect={open} />

    {scope === "global" && !filtering ? <GlobalGroups onPick={pickGroup} /> : null}

    <GlassCard accent={live ? C.mint : undefined} delay={4 * motion.stagger}>
      <View style={s.between}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>Des Moines, IA</Text>
          <Text style={s.cardSub}>NOAA · {station}</Text>
        </View>
        <Pill label={state} tone={live ? "live" : "warn"} />
      </View>
      <View style={s.perilRow} accessibilityRole="text" accessibilityLabel="Rain live. Wind, snow, and heat coming soon.">
        <View style={[s.perilChip, s.perilChipLive]}>
          <View style={[s.dot, { backgroundColor: C.mint }]} />
          <Text style={s.perilChipLiveText}>Rain live</Text>
        </View>
        {(["Wind", "Snow", "Heat"] as const).map((label) => (
          <View key={label} style={[s.perilChip, s.perilChipSoon]}>
            <Text style={s.perilChipSoonText}>{label}</Text>
            <Text style={s.perilSoonTag}>soon</Text>
          </View>
        ))}
      </View>
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

      {countdown ? <View style={[s.between, { marginTop: S.md }]}><Text style={s.caption}>Sales window</Text><Pill label={countdown} tone="neutral" /></View> : null}
      <View style={{ marginTop: S.lg }}><ActionButton label={live ? "View coverage" : "See this window"} icon="arrow-right" onPress={props.onProtect} /></View>
    </GlassCard>

    <Pressable accessibilityRole="button" accessibilityLabel="Toronto Pearson, Ontario. Environment Canada rain data. Opens soon." onPress={() => { const t = MARKETS.find((m) => m.code === "YYZ"); if (t) props.onOpenMarket?.(t); }}>
      <GlassCard accent={C.amber} delay={5 * motion.stagger}>
        <View style={s.between}>
          <View style={{ flex: 1 }}><Text style={s.cardTitleSm}>Toronto Pearson, ON</Text><Text style={s.cardSub}>Environment Canada · YYZ station</Text></View>
          <StatusTag status="soon" />
        </View>
        <View style={[s.between, { marginTop: S.md }]}><Text style={s.caption}>Payout: automatic when triggered</Text><Text style={s.link}>View market →</Text></View>
      </GlassCard>
    </Pressable>
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
  transactionMessage: string | null;
  transactionError: string | null;
  transactionSignature: string | null;
  walletName: string;
  onRefresh: () => void;
  observedMm?: number | null;
  onProtectAgain?: () => void;
  onBackToMarkets?: () => void;
}) {
  const [verifyOpen, setVerifyOpen] = useState(false);
  const market = props.status?.desMoinesMarket;
  const live = marketIsLive(props.status, props.nowSeconds);
  const options = coverageOptions(props.walletSkytBase);
  const station = stationLabel(props.status?.noaaEvidence.package?.stationId);
  const sentence = triggerSentence({ station, thresholdMmX100: market?.thresholdMmX100, operator: market?.operator, start: market?.observationStart, end: market?.observationEnd });
  const q = props.quote && props.quote.protectedAmount === props.amountBase ? props.quote : null;
  const balance = balanceCheck(props.walletSkytBase, q?.premium);
  const endDate = shortUtcDate(market?.observationEnd ? market.observationEnd - 1 : null);
  const evidenceReady = market?.evidenceStatus === "validated" && props.status?.noaaEvidence.status === "ready";
  const checks: Check[] = [
    { ready: !!props.status?.program.executable && props.status.program.status === "ready", label: "Solana program is live on Devnet" },
    { ready: !!props.status?.protocol.initialized, label: "Protocol initialized" },
    { ready: !!market?.address && isOnchainMarketOpen(market.onchainStatus ?? null), label: "Des Moines market open" },
    { ready: !!evidenceReady, label: "NOAA station data pinned on-chain" },
    { ready: !!market?.vaultBalance && /^\d+$/.test(market.vaultBalance) && BigInt(market.vaultBalance) > 0n, label: "Payout vault funded" },
  ];
  const readyCount = checks.filter((c) => c.ready).length;
  const hasPosition = props.claimReadiness && props.claimReadiness.state !== "no_position";
  const isExistingPosition = !!props.unavailableReason && /already has|duplicate position|pending outcome/i.test(props.unavailableReason);
  const blocking = props.unavailableReason && !isExistingPosition && !(hasPosition && props.transactionSignature) && !/^Connect your Devnet wallet|finalized SKYT wallet balance/.test(props.unavailableReason) ? props.unavailableReason : null;
  const thresholdMm = market?.thresholdMmX100 != null && /^\d+$/.test(String(market.thresholdMmX100)) ? trimMm(Number(market.thresholdMmX100) / 100) : null;
  const stage = payoutStage(props.claimReadiness);
  const deal = dealSentence({ place: "Des Moines", premiumBase: q?.premium, payoutBase: q ? props.amountBase : null, thresholdMmX100: market?.thresholdMmX100, operator: market?.operator, start: market?.observationStart, end: market?.observationEnd });
  const salesClosed = salesCountdown(market?.salesCloseAt, props.nowSeconds) === "Sales closed";
  const pay = payState({ premiumBase: q?.premium, busy: props.quoteBusy, error: props.quoteError, live, salesClosed, walletConnected: props.walletConnected });
  const selectedOption = options.find((o) => o.id === props.coverageId);
  const maxOption = options.find((o) => o.id === "max");
  const reviewWhy = reviewReason(props.walletConnected, pay);
  const showTicket = !!props.transactionSignature || !!hasPosition;
  const triggerSym = market?.operator === "gt" ? ">" : market?.operator === "lt" ? "<" : market?.operator === "lte" ? "≤" : "≥";
  const triggerLabel = thresholdMm ? `${triggerSym} ${thresholdMm} mm` : "—";
  const windowLabel = market?.observationStart && market?.observationEnd
    ? `${shortUtcDate(market.observationStart)} – ${shortUtcDate(market.observationEnd - 1)}`
    : "—";
  const paidLabel = q ? `${formatSkytFixed(q.premium, 2)} SKYT` : "—";
  const payoutLabel = props.amountBase ? `${formatSkytFixed(props.amountBase, 0)} SKYT` : "—";

  return <>
    <ScreenTop onBack={props.onBackToMarkets} eyebrow={`NOAA · ${station}`} title="Des Moines, IA" />
    <Enter index={0}><PerilSelector value="rain" available={["rain"]} /></Enter>
    {showTicket ? null : stage ? <PayoutStatusCard stage={stage} dates={trackerDates(market, props.claimReadiness)} /> : <StepBar step={props.walletConnected && q ? 3 : 2} reason={reviewWhy} />}

    {!live ? <View style={[s.notice, s.noticeWarn, { marginTop: S.sm }]} accessibilityRole="alert">
      <Text style={s.noticeTitle}>This window isn’t selling right now</Text>
      <Text style={s.noticeBody}>Pricing appears as soon as the next Des Moines window opens. Pull down or tap refresh to check again.</Text>
      <Pressable accessibilityRole="button" onPress={props.onRefresh} style={s.inlineBtn}><Text style={s.link}>Refresh status</Text></Pressable>
    </View> : null}

    {!showTicket ? <>
      <Enter index={1}><CoverageHero live={live} stateLabel={live ? "Live" : salesCountdown(market?.salesCloseAt, props.nowSeconds) === "Sales closed" ? "Sales closed" : "Not open"} windowLabel={market?.observationStart && market?.observationEnd ? `${shortUtcDate(market.observationStart)}–${shortUtcDate(market.observationEnd - 1)}` : null} observedMm={props.observedMm ?? null} triggerMm={thresholdMm != null ? Number(thresholdMm) : null} triggerSymbol={triggerSym} source="NOAA" /></Enter>
      <Enter index={2}><StatPair leftLabel="Coverage" left={props.amountBase ? formatSkytFixed(props.amountBase, 0) : "—"} leftUnit="SKYT" rightLabel="Premium" right={q ? `~${formatSkytFixed(q.premium, 2)}` : props.quoteBusy ? "…" : "—"} rightUnit={q ? "SKYT incl. 1% fee" : props.walletConnected ? "Pricing…" : "Connect wallet to price"} /></Enter>
      <Enter index={3}><FactRows rows={[
        { k: "Window", v: windowLabel },
        { k: "Trigger", v: thresholdMm ? `${triggerLabel} cumulative` : "Pending", tone: "gold" },
        { k: "Payout", v: "Automatic · from official NOAA data" },
        { k: "Ready checks", v: `${readyCount === checks.length ? "✓ " : ""}${readyCount} of ${checks.length} passed`, tone: readyCount === checks.length ? "mint" : "gold" },
      ]} /></Enter>

      <Text style={s.overline}>How much do you want back if it rains?</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Coverage amount in SKYT">
        <View style={s.chipRow}>{options.filter((o) => o.id !== "max").map((o) => <CoverageChip key={o.id} o={o} on={o.id === props.coverageId} short={o.id === props.coverageId && balance === "short"} onPress={() => props.onCoverage(o)} />)}</View>
        {maxOption ? <View style={s.chipRow}><CoverageChip o={maxOption} on={maxOption.id === props.coverageId} short={maxOption.id === props.coverageId && balance === "short"} onPress={() => props.onCoverage(maxOption)} /></View> : null}
      </View>
      {maxOption && !maxOption.enabled ? <Text style={[s.chipMsg, { color: C.muted }]}>Max is unavailable: this wallet has no SKYT yet.</Text> : null}
      {balance === "short" && q && selectedOption ? <Text style={[s.chipMsg, { color: C.coral }]} accessibilityRole="alert">Not enough SKYT: you need {formatSkytFixed(q.premium, 2)} SKYT. Pick less coverage or top up your wallet.</Text> : null}
      <Text style={s.overline}>Rain limit</Text>
      <View style={s.chipRow} accessible accessibilityLabel={thresholdMm ? `Rain trigger: ${market?.operator === "gt" ? "more than" : market?.operator === "lt" ? "less than" : market?.operator === "lte" ? "at most" : "at least"} ${thresholdMm} millimetres` : "Rain trigger pending"}>
        <View style={s.chip}><Text style={s.chipText}>{thresholdMm ? `Trigger ${triggerLabel} rain` : "Trigger pending"}</Text></View>
      </View>

      <View accessibilityLabel="Protection ticket">
        <GlassCard style={{ padding: 0, overflow: "hidden" }} delay={4 * motion.stagger}>
          <View style={s.split}>
            <View style={s.splitCell} accessible accessibilityLabel={`You pay ${pay.kind === "priced" ? `${pay.label} SKYT` : pay.label}`}>
              <Text style={s.smallLabel}>You pay</Text>
              {pay.kind === "priced" ? <Text style={s.splitFigure}>{pay.label}</Text>
                : pay.kind === "pricing" ? <View style={s.skeletonWrap} accessibilityLabel="Pricing"><View style={s.skeleton} /><ActivityIndicator size="small" color={C.rain} /></View>
                : <Text style={[s.payState, pay.kind === "error" && { color: C.coral }]}>{pay.label}</Text>}
              <Text style={s.caption}>{pay.kind === "priced" ? "SKYT incl. 1% fee" : pay.kind === "pricing" ? "Getting a live NOAA price…" : pay.kind === "error" ? "Tap “Get a new price” below" : "SKYT"}</Text>
            </View>
            <View style={[s.splitCell, { backgroundColor: C.payoutSoft }]} accessible accessibilityLabel={`You get ${props.amountBase ? formatSkytFixed(props.amountBase, 0) : "nothing selected"} SKYT automatically if it rains past the trigger`}>
              <Text style={s.smallLabel}>You get if it rains</Text>
              <Text style={[s.splitFigure, { color: C.payout }]}>{props.amountBase ? formatSkytFixed(props.amountBase, 0) : "—"}</Text>
              <Text style={s.caption}>SKYT · automatic</Text>
            </View>
          </View>
          <View style={{ padding: S.lg }}>
            {deal ? <Text style={[s.body, { fontFamily: F.bodySemi }]} accessibilityLiveRegion="polite">{deal}</Text> : <Text style={s.body}>{sentence ?? "Terms will appear once the market is finalized."}</Text>}
            {deal ? <Text style={[s.caption, { marginTop: S.sm }]}>If it stays drier, there's no payout. If the official data never arrives, you get what you paid back.</Text> : null}
            <View style={{ marginTop: S.sm }}>
              <Row label="Chance it rains that much" value={q ? `${(q.probabilityBps / 100).toFixed(1)}%` : "—"} />
              <Row label="Payout vs. price" value={q ? returnMultiple(q.premium, q.protectedAmount) ?? "—" : "—"} gold />
              <Row label="Premium + 1% fee" value={q ? premiumFeeLine(q.premium, q.protocolFee) ?? `${formatSkytFixed(q.premium)}` : "—"} />
              <Row label="Settles" value={endDate ? `After ${endDate} · NOAA final` : "NOAA final data"} />
            </View>
            {!props.walletConnected ? <Text style={s.caption}>Connect your wallet to get a live price.</Text> : null}
          </View>
        </GlassCard>
      </View>

      <GlassCard style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: S.md, paddingVertical: S.md }} delay={5 * motion.stagger}>
        <Text style={s.rowLabel}>Wallet balance</Text>
        {!props.walletConnected ? <Text style={s.rowLabel}>Not connected</Text>
          : props.walletSkytBase == null ? <Text style={s.rowLabel}>Checking…</Text>
          : <View style={s.baseline} accessibilityLiveRegion="polite">
            <Text style={s.rowValue}>{formatSkytFixed(props.walletSkytBase, 2)} SKYT </Text>
            {balance === "enough" ? <AppIcon name="check" color={C.mint} size={16} /> : balance === "short" ? <AppIcon name="alert-circle" color={C.coral} size={16} /> : null}
          </View>}
      </GlassCard>
    </> : null}

    {blocking && live && !showTicket ? <View style={s.notice} accessibilityRole="alert"><Text style={s.noticeTitle}>Not ready to price yet</Text><Text style={s.noticeBody}>{friendlyError(blocking)}</Text><Pressable accessibilityRole="button" onPress={props.onRefresh} style={s.inlineBtn}><Text style={s.link}>Refresh status</Text></Pressable></View> : null}
    {props.quoteError && !showTicket ? <View style={s.notice} accessibilityRole="alert"><Text style={s.noticeTitle}>{quoteErrorTitle(props.quoteError)}</Text><Text style={s.noticeBody}>{friendlyError(props.quoteError)}</Text><Pressable accessibilityRole="button" onPress={props.onRetryQuote} style={s.inlineBtn}><Text style={s.link}>Get a new price</Text></Pressable></View> : null}
    {props.transactionMessage ? <Text accessibilityLiveRegion="polite" style={[s.body, { color: C.rain, marginBottom: S.md }]}>{props.transactionMessage}</Text> : null}
    {props.transactionError ? <View style={[s.notice, { borderColor: C.coral }]} accessibilityRole="alert"><Text style={s.noticeTitle}>{transactionErrorTitle(props.transactionError, props.walletName)}</Text><Text style={s.noticeBody}>{friendlyError(props.transactionError)} Nothing was charged unless Explorer shows a transaction.</Text></View> : null}

    {showTicket ? <Reveal><CoverageTicket
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
      resolutionSignature={props.claimReadiness?.resolutionSignature ?? null}
      onAgain={() => props.onProtectAgain?.()}
      onMarkets={() => props.onBackToMarkets?.()}
    /><Text style={[s.caption, { marginTop: S.sm, marginBottom: S.sm, textAlign: "center" }]}>One protection per wallet per window.</Text></Reveal> : null}
    {isExistingPosition && !props.transactionSignature ? <Text style={[s.caption, { marginBottom: S.sm }]}>One protection per wallet per window — this wallet is already covered.</Text> : null}

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
    <View style={s.between}>
      <Text style={s.cardTitleSm}>Coverage ticket</Text>
      <View style={[s.statusPill, { borderColor: pillCol + "77", backgroundColor: pillCol + "1F", boxShadow: statusGlow(pillCol) }]} accessible accessibilityLabel={props.status.label}>
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
      {props.signature ? <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(`https://explorer.solana.com/tx/${encodeURIComponent(props.signature!)}?cluster=devnet`); }} style={s.inlineBtn}><Text style={s.link}>View on explorer ↗</Text></Pressable> : null}
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
    {props.resolutionSignature ? <ExplorerButton url={`https://explorer.solana.com/tx/${encodeURIComponent(props.resolutionSignature)}?cluster=devnet`} label="Settlement proof" /> : null}
    <View style={{ marginTop: S.lg }}><ActionButton label="Protect again" icon="shield" onPress={props.onAgain} /></View>
    <Pressable accessibilityRole="button" onPress={props.onMarkets} style={[s.inlineBtn, { alignSelf: "center", marginTop: S.sm }]}><Text style={s.link}>Back to markets</Text></Pressable>
  </GlassCard>;
}

function CoverageChip({ o, on, short, onPress }: { o: CoverageOption; on: boolean; short: boolean; onPress: () => void }) {
  const label = o.id === "max" ? (o.amountBase ? `Max ${formatSkytFixed(o.amountBase, 0)} SKYT` : "Max") : `${o.label} SKYT`;
  const a11y = o.id === "max" ? `Max${o.amountBase ? `, ${formatSkytFixed(o.amountBase, 0)} SKYT` : ", unavailable, wallet has no SKYT"}` : `${o.label} SKYT`;
  return <SpringPress selected={on} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: !o.enabled }} accessibilityLabel={short ? `${a11y}, not enough SKYT` : a11y} disabled={!o.enabled} onPress={onPress} outerStyle={{ flex: 1 }}
    style={({ pressed }: { pressed: boolean }) => [s.chip, { paddingHorizontal: S.sm }, pressed && o.enabled && s.chipPressed, on && s.chipOn, on && short && s.chipShort, !o.enabled && s.chipDisabled]}>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[s.chipText, on && { color: short ? C.coral : C.rain }, !o.enabled && { color: C.muted }]}>{label}</Text>
  </SpringPress>;
}

/** Sticky bottom CTA used by Protect. */
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

export function StickyCta(props: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; hint?: string | null }) {
  return <View style={s.sticky}>
    {props.hint ? <Text style={[s.caption, { textAlign: "center", marginBottom: S.sm }]}>{props.hint}</Text> : null}
    <ActionButton label={props.label} icon="arrow-right" disabled={props.disabled} busy={props.busy} onPress={props.onPress} />
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
          <View style={s.baseline}>
            <View style={s.avatar}><AppIcon name="credit-card" color={C.rain} size={18} /></View>
            <View style={{ marginLeft: S.md }}><Text style={s.cardTitleSm}>{props.walletName}</Text><Text style={s.caption} accessibilityLabel={`Address ${props.wallet}`}>{shortAddress(props.wallet)}</Text></View>
          </View>
          <Pill label="Connected" tone="live" />
        </View>
        <Text style={[s.sectionLabel, { marginTop: S.lg }]}>Available</Text>
        <View style={s.baseline}>
          <Text style={s.hugeFigure}>{skytBase != null ? formatSkytFixed(skytBase, 2) : "—"}</Text>
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
      <Text style={s.overline}>Positions</Text>
      <GlassCard delay={2 * motion.stagger}>
        {props.portfolio?.indexed && props.portfolio.protections.length ? props.portfolio.protections.map((p) => <View key={p.address} style={[s.between, s.positionRow]}>
          <View style={{ flex: 1 }}><Text style={s.cardTitleSm}>{p.market === props.marketAddress ? "Des Moines · Rain" : `Market ${shortAddress(p.market)}`}</Text><Text style={s.caption}>Paid {formatSkytFixed(p.premiumPaid, 2)} SKYT</Text></View>
          <View style={{ alignItems: "flex-end" }}><Text style={[s.rowValue, { ...T.amountS, fontSize: 18, lineHeight: 24, color: C.payout }]}>{formatSkytFixed(p.protectedAmount, 0)}</Text><Text style={s.caption}>potential</Text></View>
        </View>) : props.portfolio?.indexed ? <View style={s.emptyCard}>
          <AppIcon name="umbrella" color={C.rain} size={22} />
          <Text style={s.body}>No positions yet. Protect a window from Markets.</Text>
          {props.onBrowseMarkets ? <Pressable accessibilityRole="button" onPress={props.onBrowseMarkets} style={s.inlineBtn}><Text style={s.link}>Browse markets →</Text></Pressable> : null}
        </View> : props.portfolioError ? <View style={s.emptyCard} accessibilityRole="alert">
          <AppIcon name="alert-circle" color={C.coral} size={22} />
          <Text style={s.body}>{friendlyError(props.portfolioError)}</Text>
        </View> : <View style={s.emptyCard}>
          <ActivityIndicator color={C.rain} />
          <Text style={[s.body, { color: C.muted }]}>{props.portfolio?.message ?? "Positions will appear once Solana confirms them."}</Text>
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
  regionChipOn: { borderColor: C.rain, backgroundColor: C.rain, boxShadow: `0px 0px 14px ${C.rain}55` },
  regionChipText: { ...T.label, color: C.muted },
  regionChipTextOn: { color: C.actionText, fontFamily: F.bodySemi },
  regionChipN: { fontFamily: F.mono, fontSize: 12, color: C.quiet, fontVariant: TAB },
  regionChipNOn: { color: C.actionText },
  resultRow: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: S.md, paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: 16, borderWidth: 1, borderColor: "transparent", marginBottom: S.xs },
  resultName: { ...T.bodyStrong, color: C.ink, fontFamily: F.bodyMedium },
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
  row: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  rowLabel: { ...T.body, color: C.muted },
  rowValue: { ...T.bodyStrong, color: C.ink, fontVariant: TAB },
  notice: { backgroundColor: C.redSoft, borderColor: C.coral, borderWidth: 1, borderRadius: glass.radius - 10, padding: S.lg, marginBottom: S.md },
  noticeWarn: { backgroundColor: C.amberSoft, borderColor: C.amber + "88" },
  noticeTitle: { ...T.bodyStrong, color: C.ink },
  noticeBody: { ...T.body, fontSize: 14, lineHeight: 20, color: C.muted, marginTop: S.xs },
  inlineBtn: { minHeight: MIN_TOUCH, justifyContent: "center", alignSelf: "flex-start" },
  link: { ...T.label, fontSize: 14, lineHeight: 20, color: C.rain },
  checkRow: { minHeight: 40, flexDirection: "row", alignItems: "center" },
  sticky: { paddingHorizontal: S.lg + 2, paddingTop: S.md, paddingBottom: S.md, backgroundColor: C.canvas + "EB", borderTopWidth: 1, borderTopColor: glass.border },
  netPill: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: S.sm, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: S.md, backgroundColor: C.surface },
  netPillText: { ...T.label, fontSize: 12, lineHeight: 16, color: C.ink },
  pill: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: S.sm - 2, borderRadius: 14, paddingHorizontal: S.md - 2 },
  pillText: { ...T.label, fontSize: 12, lineHeight: 16 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.rainSoft, alignItems: "center", justifyContent: "center" },
  positionRow: { minHeight: 56, paddingVertical: S.sm },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 14, paddingHorizontal: 11, minHeight: 28 },
  ticketHr: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginVertical: S.lg },
});
