import React, { useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native";
import type { CityIndex, ClaimReadiness, DevnetStatus, FinalizedWalletState, Portfolio, ProtectionQuote } from "./api";
import { C, F, MIN_TOUCH } from "./theme";
import { ActionButton, AppIcon, Disclosure, Reveal, Text } from "./ui";
import { friendlyError, quoteErrorTitle, stationLabel, transactionErrorTitle } from "./friendly-errors";
import { formatOnchainMarketStatus, formatWeekLabel } from "./presentation";
import { isOnchainMarketOpen } from "./protection";
import { balanceCheck, coverageOptions, formatSkytFixed, premiumFeeLine, premiumPer100, returnMultiple, salesCountdown, shortAddress, shortUtcDate, trimMm, triggerSentence, type CoverageOption } from "./ticket";

const TAB = ["tabular-nums" as const];

/** Neutral Devnet pill with a green dot (header). */
export function NetworkPill({ label = "Devnet" }: { label?: string }) {
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
  guide?: React.ReactNode;
}) {
  const market = props.status?.desMoinesMarket;
  const city = props.city?.slug === "des-moines" ? props.city : null;
  const live = marketIsLive(props.status, props.nowSeconds);
  const thresholdMm = market?.thresholdMmX100 && /^\d+$/.test(market.thresholdMmX100) ? Number(market.thresholdMmX100) / 100 : null;
  const below = market?.operator === "lt" || market?.operator === "lte";
  const symbol = market?.operator === "gt" ? ">" : market?.operator === "lt" ? "<" : below ? "≤" : "≥";
  const history = (city?.weeklyHistoryMm ?? []).slice(-7);
  const values = history.map((w) => (w.mm != null && Number.isFinite(w.mm) && w.mm >= 0 ? w.mm : null));
  const scale = Math.max(1, thresholdMm ?? 0, ...values.map((v) => v ?? 0)) * 1.1;
  const CHART_H = 96;
  const per100 = props.indicativeQuote ? premiumPer100(props.indicativeQuote.premium, props.indicativeQuote.protectedAmount) : null;
  const countdown = salesCountdown(market?.salesCloseAt, props.nowSeconds);
  const station = stationLabel(props.status?.noaaEvidence.package?.stationId ?? "USW00014933");
  const state = live ? "Live" : market?.onchainStatus ? (countdown === "Sales closed" ? "Sales closed" : formatOnchainMarketStatus(market.onchainStatus)) : "Opens soon";

  return <>
    <Text accessibilityRole="header" style={s.h1}>Markets</Text>
    <Text style={s.lead}>Protect against weather with verified public data.</Text>
    <View style={s.chipRow} accessibilityRole="tablist" accessibilityLabel="Weather hazard">
      <View style={[s.hazardChip, s.hazardChipOn]} accessibilityRole="tab" accessibilityState={{ selected: true }}><Text style={[s.hazardText, { color: C.rain }]}>Rain</Text></View>
      <View style={s.hazardChip} accessibilityRole="tab" accessibilityState={{ disabled: true }} accessibilityLabel="Snow, coming soon"><Text style={s.hazardText}>Snow · soon</Text></View>
      <View style={s.hazardChip} accessibilityRole="tab" accessibilityState={{ disabled: true }} accessibilityLabel="Wind, coming soon"><Text style={s.hazardText}>Wind · soon</Text></View>
    </View>

    <View style={s.card}>
      <View style={s.between}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>Des Moines, IA</Text>
          <Text style={s.cardSub}>NOAA · {station}</Text>
        </View>
        <Pill label={state} tone={live ? "live" : "warn"} />
      </View>
      <View style={[s.between, { marginTop: 16, alignItems: "flex-end" }]}>
        <View>
          <Text style={s.smallLabel}>Rain this window</Text>
          <View style={s.baseline}>
            <Text style={s.bigFigure}>{city?.cumulativeMm != null ? city.cumulativeMm.toFixed(1) : "—"}</Text>
            <Text style={s.unit}>mm</Text>
          </View>
          {city?.cumulativeMm == null ? <Text style={s.caption}>Not reported by NOAA yet</Text> : city.observedThrough ? <Text style={s.caption}>Through {city.observedThrough}</Text> : null}
        </View>
        {thresholdMm != null ? <View style={{ alignItems: "flex-end" }}>
          <Text style={s.smallLabel}>Trigger</Text>
          <Text style={s.trigger}>{symbol} {trimMm(thresholdMm)} mm</Text>
        </View> : null}
      </View>

      {history.length ? <View accessible accessibilityLabel={`Weekly NOAA rainfall, last ${history.length} weeks: ${history.map((w, i) => `${formatWeekLabel(w.week)} ${values[i] == null ? "unavailable" : `${values[i]!.toFixed(1)} mm`}`).join("; ")}.${thresholdMm != null ? ` Trigger ${trimMm(thresholdMm)} mm.` : ""}`}>
        <View style={[s.chart, { height: CHART_H }]}>
          {thresholdMm != null ? <View style={[s.strike, { bottom: (thresholdMm / scale) * CHART_H }]} pointerEvents="none">
            {Array.from({ length: 40 }).map((_, i) => <View key={i} style={s.dash} />)}
          </View> : null}
          {values.map((v, i) => <View key={history[i].week} style={s.barCol}>
            {v == null ? <View style={s.barUnknown} /> : <View style={[s.bar, i === values.length - 1 && s.barCurrent, { height: Math.max(2, (v / scale) * CHART_H) }]} />}
          </View>)}
        </View>
        <View style={s.between}><Text style={s.caption}>{history.length} weeks · NOAA</Text>{thresholdMm != null ? <Text style={[s.caption, { color: C.payout }]}>– – trigger</Text> : null}</View>
      </View> : <Text style={[s.caption, { marginTop: 12 }]}>Weekly history isn’t available yet — nothing is estimated.</Text>}

      {per100 || countdown ? <View style={[s.between, { marginTop: 14 }]}>
        {per100 ? <Text style={s.body}>From <Text style={s.bodyStrong}>{per100} SKYT</Text> per 100 covered</Text> : <View />}
        {countdown ? <Pill label={countdown} tone="neutral" /> : null}
      </View> : null}
      <View style={{ marginTop: 14 }}><ActionButton label={live ? "Protect this window" : "See this window"} icon="shield" onPress={props.onProtect} /></View>
    </View>

    <Text style={s.overline}>Coming next</Text>
    <View style={[s.card, s.between]} accessible accessibilityLabel="Toronto Pearson, Ontario. Environment Canada rain data. Opens soon.">
      <View style={{ flex: 1 }}><Text style={s.cardTitleSm}>Toronto Pearson, ON</Text><Text style={s.cardSub}>Environment Canada · rain</Text></View>
      <Pill label="Opens soon" tone="neutral" />
    </View>
    {props.guide}
    <Disclosure>Devnet test token, not insurance. Observed station data only — missing values are never estimated.</Disclosure>
  </>;
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
  const blocking = props.unavailableReason && !/^Connect your Devnet wallet|finalized SKYT wallet balance/.test(props.unavailableReason) ? props.unavailableReason : null;
  const hasPosition = props.claimReadiness && props.claimReadiness.state !== "no_position";
  const youPay = q ? formatSkytFixed(q.premium, 2) : props.quoteBusy ? null : "—";

  return <>
    <Text style={s.eyebrow}>Des Moines · Rain</Text>
    <View style={s.between}><Text accessibilityRole="header" style={s.h1}>Protection ticket</Text>{!live ? <Pill label={salesCountdown(market?.salesCloseAt, props.nowSeconds) === "Sales closed" ? "Sales closed" : "Not open"} tone="warn" /> : null}</View>

    {!live ? <View style={[s.notice, { marginTop: 8 }]} accessibilityRole="alert">
      <Text style={s.noticeTitle}>This window isn’t selling right now</Text>
      <Text style={s.noticeBody}>Pricing appears as soon as the next Des Moines window opens. Pull down or tap refresh to check again.</Text>
      <Pressable accessibilityRole="button" onPress={props.onRefresh} style={s.inlineBtn}><Text style={s.link}>Refresh status</Text></Pressable>
    </View> : null}

    <Text style={s.overline}>Coverage</Text>
    <View style={s.chipRow} accessibilityRole="radiogroup" accessibilityLabel="Coverage amount in SKYT">
      {options.map((o) => {
        const on = o.id === props.coverageId;
        return <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: !o.enabled }} accessibilityLabel={o.id === "max" ? `Max${o.amountBase ? `, ${formatSkytFixed(o.amountBase, 0)} SKYT` : ", unavailable"}` : `${o.label} SKYT`} disabled={!o.enabled} onPress={() => props.onCoverage(o)} style={[s.chip, on && s.chipOn, !o.enabled && { opacity: 0.4 }]}>
          <Text style={[s.chipText, on && { color: C.rain }]}>{o.label}</Text>
        </Pressable>;
      })}
    </View>

    <View style={[s.card, { padding: 0, overflow: "hidden" }]} accessibilityLabel="Protection ticket">
      <View style={s.split}>
        <View style={s.splitCell} accessible accessibilityLabel={`You pay ${q ? `${formatSkytFixed(q.premium, 2)} SKYT` : "not priced yet"}`}>
          <Text style={s.smallLabel}>You pay</Text>
          {youPay === null ? <ActivityIndicator color={C.rain} style={{ alignSelf: "flex-start", marginVertical: 10 }} /> : <Text style={s.splitFigure}>{youPay}</Text>}
          <Text style={s.caption}>SKYT</Text>
        </View>
        <View style={[s.splitCell, { backgroundColor: C.payoutSoft }]} accessible accessibilityLabel={`You get ${props.amountBase ? formatSkytFixed(props.amountBase, 0) : "nothing selected"} SKYT automatically if it rains past the trigger`}>
          <Text style={s.smallLabel}>You get if it rains</Text>
          <Text style={[s.splitFigure, { color: C.payout }]}>{props.amountBase ? formatSkytFixed(props.amountBase, 0) : "—"}</Text>
          <Text style={s.caption}>SKYT · automatic</Text>
        </View>
      </View>
      <View style={{ padding: 16 }}>
        <Text style={s.body}>{sentence ?? "Trigger terms will appear once the market is finalized."}</Text>
        <View style={{ marginTop: 6 }}>
          <Row label="Chance of trigger" value={q ? `${(q.probabilityBps / 100).toFixed(1)}%` : "—"} />
          <Row label="Return if triggered" value={q ? returnMultiple(q.premium, q.protectedAmount) ?? "—" : "—"} gold />
          <Row label="Premium + 1% fee" value={q ? premiumFeeLine(q.premium, q.protocolFee) ?? `${formatSkytFixed(q.premium)}` : "—"} />
          <Row label="Settles" value={endDate ? `After ${endDate} · NOAA final` : "NOAA final data"} />
        </View>
        {!props.walletConnected ? <Text style={s.caption}>Connect your wallet to get a live price.</Text> : null}
      </View>
    </View>

    <View style={[s.card, s.between, { paddingVertical: 12 }]} accessibilityLiveRegion="polite">
      <Text style={s.rowLabel}>Wallet balance</Text>
      {!props.walletConnected ? <Text style={s.rowLabel}>Not connected</Text>
        : props.walletSkytBase == null ? <Text style={s.rowLabel}>Checking…</Text>
        : <View style={s.baseline}>
          <Text style={s.rowValue}>{formatSkytFixed(props.walletSkytBase, 2)} SKYT </Text>
          {balance === "enough" ? <AppIcon name="check" color={C.mint} size={16} /> : balance === "short" ? <AppIcon name="alert-circle" color={C.amber} size={16} /> : null}
        </View>}
    </View>
    {balance === "short" && q ? <Text style={[s.caption, { color: C.amber, marginTop: -6, marginBottom: 8 }]} accessibilityRole="alert">You need {formatSkytFixed(q.premium, 2)} SKYT — pick less coverage or top up your wallet.</Text> : null}

    {blocking && live ? <View style={s.notice} accessibilityRole="alert"><Text style={s.noticeTitle}>Not ready to price yet</Text><Text style={s.noticeBody}>{friendlyError(blocking)}</Text><Pressable accessibilityRole="button" onPress={props.onRefresh} style={s.inlineBtn}><Text style={s.link}>Refresh status</Text></Pressable></View> : null}
    {props.quoteError ? <View style={s.notice} accessibilityRole="alert"><Text style={s.noticeTitle}>{quoteErrorTitle(props.quoteError)}</Text><Text style={s.noticeBody}>{friendlyError(props.quoteError)}</Text><Pressable accessibilityRole="button" onPress={props.onRetryQuote} style={s.inlineBtn}><Text style={s.link}>Get a new price</Text></Pressable></View> : null}
    {props.transactionMessage ? <Text accessibilityLiveRegion="polite" style={[s.body, { color: C.rain, marginBottom: 10 }]}>{props.transactionMessage}</Text> : null}
    {props.transactionError ? <View style={[s.notice, { borderColor: C.coral }]} accessibilityRole="alert"><Text style={s.noticeTitle}>{transactionErrorTitle(props.transactionError, props.walletName)}</Text><Text style={s.noticeBody}>{friendlyError(props.transactionError)} Nothing was charged unless Explorer shows a transaction.</Text></View> : null}
    {props.transactionSignature ? <Reveal><View style={[s.card, { borderColor: C.mint }]}><View style={s.baseline}><AppIcon name="check-circle" color={C.mint} size={20} /><Text style={[s.cardTitleSm, { marginLeft: 8 }]}>You’re protected</Text></View><Text style={s.caption}>Finalized on Solana Devnet · {shortAddress(props.transactionSignature)}</Text><ExplorerButton url={`https://explorer.solana.com/tx/${encodeURIComponent(props.transactionSignature)}?cluster=devnet`} label="View on Explorer" /></View></Reveal> : null}

    {hasPosition && props.claimReadiness ? <View style={s.card}>
      <Text style={s.overlineIn}>Your position</Text>
      <Text style={s.body}>{props.claimReadiness.reason}</Text>
      {props.claimReadiness.observation ? <Row label="Verified rainfall" value={`${(Number(props.claimReadiness.observation.rainfallMmX100) / 100).toFixed(1)} mm · NOAA`} /> : null}
      {props.claimReadiness.resolutionSignature ? <ExplorerButton url={`https://explorer.solana.com/tx/${encodeURIComponent(props.claimReadiness.resolutionSignature)}?cluster=devnet`} label="Settlement proof" /> : null}
    </View> : props.claimError && props.walletConnected ? <Text style={s.caption}>{friendlyError(props.claimError)}</Text> : null}

    <View style={s.card}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: verifyOpen }} accessibilityLabel={`How it's verified, ${readyCount} of ${checks.length} checks passed`} onPress={() => setVerifyOpen((v) => !v)} style={[s.between, { minHeight: MIN_TOUCH }]}>
        <View style={{ flex: 1 }}><Text style={s.cardTitleSm}>How it’s verified</Text><Text style={s.caption}>{readyCount} of {checks.length} on-chain checks passed</Text></View>
        <AppIcon name={verifyOpen ? "chevron-up" : "chevron-down"} color={C.muted} size={20} />
      </Pressable>
      {verifyOpen ? <View style={{ marginTop: 6 }}>
        {checks.map((c) => <View key={c.label} style={s.checkRow}><AppIcon name={c.ready ? "check" : "clock"} color={c.ready ? C.mint : C.amber} size={16} /><Text style={[s.body, { flex: 1, marginLeft: 10 }]}>{c.label}</Text></View>)}
        <Row label="Settlement source" value={`NOAA · ${station}`} />
        {market?.salesCloseAt ? <Row label="Sales close" value={`${new Date(market.salesCloseAt * 1_000).toISOString().replace("T", " ").slice(0, 16)} UTC`} /> : null}
        {q ? <Row label="Quote" value={`${q.inputsHash.slice(0, 10)} · ${q.modelVersion}`} /> : null}
        {market?.address ? <ExplorerButton url={`https://explorer.solana.com/address/${encodeURIComponent(market.address)}?cluster=devnet`} label="Market account on Explorer" /> : null}
      </View> : null}
    </View>
    <Disclosure>Devnet test token · not insurance. SKYT has no monetary value. Your wallet shows and approves every transaction.</Disclosure>
  </>;
}

/** Sticky bottom CTA used by Protect. */
export function StickyCta(props: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; hint?: string | null }) {
  return <View style={s.sticky}>
    {props.hint ? <Text style={[s.caption, { textAlign: "center", marginBottom: 6 }]}>{props.hint}</Text> : null}
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
  portfolio: Portfolio | null;
  portfolioError: string | null;
  walletError: string | null;
  loading: boolean;
  marketAddress: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const skytBase = props.balances?.skytBaseUnits ?? null;
  return <>
    <Text accessibilityRole="header" style={[s.h1, { marginBottom: 16 }]}>Wallet</Text>
    {props.walletError ? <View style={s.notice} accessibilityRole="alert"><Text style={s.noticeTitle}>Wallet didn’t connect — try again</Text><Text style={s.noticeBody}>{friendlyError(props.walletError)}</Text></View> : null}
    {!props.wallet ? <View style={s.card}>
      <Text style={s.cardTitle}>Connect a Solana wallet</Text>
      <Text style={[s.body, { color: C.muted, marginTop: 6 }]}>Your wallet asks before sharing your address. Keys never leave it, and you approve every transaction there.</Text>
      <View style={{ marginTop: 16 }}><ActionButton label="Connect wallet" icon="credit-card" busy={props.loading} onPress={props.onConnect} /></View>
    </View> : <>
      <View style={s.card}>
        <View style={s.between}>
          <View style={s.baseline}>
            <View style={s.avatar}><AppIcon name="credit-card" color={C.rain} size={18} /></View>
            <View style={{ marginLeft: 12 }}><Text style={s.cardTitleSm}>{props.walletName}</Text><Text style={s.caption} accessibilityLabel={`Address ${props.wallet}`}>{shortAddress(props.wallet)}</Text></View>
          </View>
          <Pill label="Connected" tone="live" />
        </View>
        <Text style={[s.smallLabel, { marginTop: 18 }]}>Available</Text>
        <View style={s.baseline}>
          <Text style={s.hugeFigure}>{skytBase ? formatSkytFixed(skytBase, 2) : "—"}</Text>
          <Text style={s.unit}>SKYT</Text>
        </View>
        <Text style={s.caption}>{props.balances ? `${props.balances.sol.toFixed(4)} SOL for fees` : "Reading balances from Solana…"}</Text>
        <View style={{ marginTop: 14 }}><ExplorerButton url={`https://explorer.solana.com/address/${encodeURIComponent(props.wallet)}?cluster=devnet`} label="Open in Explorer" /></View>
      </View>

      <Text style={s.overline}>Positions</Text>
      <View style={s.card}>
        {props.portfolio?.indexed && props.portfolio.protections.length ? props.portfolio.protections.map((p) => <View key={p.address} style={[s.between, s.positionRow]}>
          <View style={{ flex: 1 }}><Text style={s.cardTitleSm}>{p.market === props.marketAddress ? "Des Moines · Rain" : `Market ${shortAddress(p.market)}`}</Text><Text style={s.caption}>Paid {formatSkytFixed(p.premiumPaid, 2)} SKYT</Text></View>
          <View style={{ alignItems: "flex-end" }}><Text style={[s.rowValue, { color: C.payout, fontSize: 18 }]}>{formatSkytFixed(p.protectedAmount, 0)}</Text><Text style={s.caption}>potential</Text></View>
        </View>) : <Text style={s.body}>{props.portfolio?.indexed ? "No positions yet. Protect a window from Markets." : friendlyError(props.portfolioError, props.portfolio?.message ?? "Positions will appear once Solana confirms them.")}</Text>}
      </View>

      <View style={{ marginTop: 16 }}><ActionButton variant="secondary" label="Disconnect" icon="log-out" onPress={props.onDisconnect} /></View>
    </>}
    <Disclosure>Balances are read directly from Solana Devnet. Missing values are shown as —, never as zero.</Disclosure>
  </>;
}

const s = StyleSheet.create({
  h1: { color: C.ink, fontFamily: F.headingBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  lead: { color: C.muted, fontFamily: F.body, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 14 },
  eyebrow: { color: C.muted, fontFamily: F.bodyMedium, fontSize: 13, marginBottom: 2 },
  overline: { color: C.quiet, fontFamily: F.bodySemi, fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 18, marginBottom: 8 },
  overlineIn: { color: C.quiet, fontFamily: F.bodySemi, fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 },
  card: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 12 },
  cardTitle: { color: C.ink, fontFamily: F.headingBold, fontSize: 19 },
  cardTitleSm: { color: C.ink, fontFamily: F.bodySemi, fontSize: 16 },
  cardSub: { color: C.muted, fontFamily: F.body, fontSize: 13, marginTop: 2 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  baseline: { flexDirection: "row", alignItems: "center" },
  smallLabel: { color: C.muted, fontFamily: F.bodyMedium, fontSize: 13 },
  bigFigure: { color: C.ink, fontFamily: F.headingBold, fontSize: 40, lineHeight: 46, letterSpacing: -1, fontVariant: TAB },
  hugeFigure: { color: C.ink, fontFamily: F.headingBold, fontSize: 40, lineHeight: 48, letterSpacing: -1, fontVariant: TAB },
  unit: { color: C.muted, fontFamily: F.bodySemi, fontSize: 16, marginLeft: 6, marginTop: 10 },
  trigger: { color: C.payout, fontFamily: F.headingBold, fontSize: 22, fontVariant: TAB },
  caption: { color: C.quiet, fontFamily: F.body, fontSize: 12, lineHeight: 18 },
  body: { color: C.ink, fontFamily: F.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { color: C.ink, fontFamily: F.bodyBold, fontVariant: TAB },
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  hazardChip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  hazardChipOn: { borderColor: C.rain, backgroundColor: C.rainSoft },
  hazardText: { color: C.muted, fontFamily: F.bodyMedium, fontSize: 14 },
  chip: { flex: 1, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  chipOn: { borderColor: C.rain, backgroundColor: C.rainSoft },
  chipText: { color: C.ink, fontFamily: F.bodySemi, fontSize: 15, fontVariant: TAB },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 16, marginBottom: 6 },
  barCol: { flex: 1, justifyContent: "flex-end", height: "100%" },
  bar: { backgroundColor: C.mutedSurface, borderRadius: 3 },
  barCurrent: { backgroundColor: C.rain },
  barUnknown: { height: 2, backgroundColor: C.border },
  strike: { position: "absolute", left: 0, right: 0, height: 1, flexDirection: "row", justifyContent: "space-between", overflow: "hidden", zIndex: 2 },
  dash: { width: 4, height: 1, backgroundColor: C.payout },
  split: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border },
  splitCell: { flex: 1, padding: 16 },
  splitFigure: { color: C.ink, fontFamily: F.headingBold, fontSize: 32, lineHeight: 40, fontVariant: TAB, marginTop: 4 },
  row: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  rowLabel: { color: C.muted, fontFamily: F.body, fontSize: 15 },
  rowValue: { color: C.ink, fontFamily: F.bodySemi, fontSize: 15, fontVariant: TAB },
  notice: { backgroundColor: C.surface, borderColor: C.amber, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  noticeTitle: { color: C.ink, fontFamily: F.bodySemi, fontSize: 15 },
  noticeBody: { color: C.muted, fontFamily: F.body, fontSize: 14, lineHeight: 20, marginTop: 4 },
  inlineBtn: { minHeight: MIN_TOUCH, justifyContent: "center", alignSelf: "flex-start" },
  link: { color: C.rain, fontFamily: F.bodySemi, fontSize: 14 },
  checkRow: { minHeight: 36, flexDirection: "row", alignItems: "center" },
  sticky: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10, backgroundColor: C.canvas, borderTopWidth: 1, borderTopColor: C.border },
  netPill: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 12, backgroundColor: C.surface },
  netPillText: { color: C.ink, fontFamily: F.bodySemi, fontSize: 12 },
  pill: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 14, paddingHorizontal: 10 },
  pillText: { fontFamily: F.bodySemi, fontSize: 12 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.rainSoft, alignItems: "center", justifyContent: "center" },
  positionRow: { minHeight: 56, paddingVertical: 6 },
});
