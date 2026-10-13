import "./src/polyfills";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AdvisoryResponse, AgriculturalMarket, ClaimReadiness, CityIndex, DevnetStatus, FinalizedWalletState, getJson, NotAvailableYetError, claimReadinessPath, Portfolio, postJson, ProtectionQuote, UnsignedTransaction } from "./src/api";
import { DEVNET_RPC_URL, readFinalizedWalletState, readFinalizedWalletStateAnyRpc, readWalletStateWithFallback } from "./src/chain";
import { hazardPresentation, listHazards, type HazardId } from "./src/hazards";
import { catalogAvailability, formatOnchainMarketStatus, formatUsdPreview, isMarketReadyForCity, latestCompletedNoaaWeek, rainfallBarPercent, recentNoaaHistoryForArea, researchLocationLabel, resolveSelectedNoaaCity, riskChoiceForArea, searchAgriculturalMarkets, formatWeekLabel, formatRainfallBarValue } from "./src/presentation";
import { hedgeBalanceLine, hedgeWindowDays, marketHeadline, optionPremiumLine, triggerPhrase } from "./src/options-copy";
import { buildCommittedQuoteRequest, formatSkyt, getProtectionUnavailableReason, isOnchainMarketOpen, parseSkytAmount } from "./src/protection";
import { authorizeDevnetWallet, signAndConfirmDevnetTransaction, type AuthorizedWallet } from "./src/wallet";
import { C, F } from "./src/theme";
import { ActionButton, Disclosure, PayoffProfile, AppIcon, EvidenceTimeline, PrimaryAction, Reveal, ScreenHeader, SectionHeader, StatusPill, Text, type AppIconName } from "./src/ui";
import { friendlyError, isNetworkError, stationLabel } from "./src/friendly-errors";
import { ScreenTransition, TactilePressable } from "./src/liquid-glass";
import { GuidePanel, type GuideTurn } from "./src/GuidePanel";
import { ReferenceAreaMap } from "./src/ReferenceAreaMap";
import { marketIsLive, MarketsScreen, NetworkPill, ProtectTicket, StickyCta, WalletV2 } from "./src/v2";
import { coverageOptions, type CoverageOption } from "./src/ticket";
import { Landing, MarketDetail } from "./src/revamp";
import { marketByCode, type CatalogMarket } from "./src/markets-catalog";
import { LinearGradient } from "expo-linear-gradient";
import { referenceEvidenceLabel, referenceLocationFor, referencePointFor } from "./src/reference-map";

type Tab = "weather" | "catalog" | "protect" | "wallet";
type AmountMode = "usd-preview" | "devnet-test";

/** MWA does not report the wallet's name without changing the auth flow, so copy stays generic. */
const WALLET_NAME = "Your wallet";

const CITY_ORDER = ["des-moines", "chicago", "new-york", "miami"];

export default function App() {
  const scrollRef = useRef<ScrollView>(null);
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, });
  const [tab, setTab] = useState<Tab>("catalog");
  const [cities, setCities] = useState<CityIndex[]>([]);
  const [catalog, setCatalog] = useState<AgriculturalMarket[]>([]);
  const [status, setStatus] = useState<DevnetStatus | null>(null);
  const [selectedCity, setSelectedCity] = useState("des-moines");
  const [hasChosenArea, setHasChosenArea] = useState(false);
  const [selectedHazard, setSelectedHazard] = useState<HazardId | null>("rainfall");
  const [city, setCity] = useState<CityIndex | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletSession, setWalletSession] = useState<AuthorizedWallet | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [walletBalances, setWalletBalances] = useState<FinalizedWalletState | null>(null);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [marketQuery, setMarketQuery] = useState("");
  const [guideTurns, setGuideTurns] = useState<GuideTurn[]>([]);
  const [guideBusy, setGuideBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [homeLoading, setHomeLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountMode, setAmountMode] = useState<AmountMode>("devnet-test");
  const [usdPreviewAmount, setUsdPreviewAmount] = useState("100");
  const [protectionAmount, setProtectionAmount] = useState("100");
  const [coverageId, setCoverageId] = useState<CoverageOption["id"]>("100");
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [indicativeQuote, setIndicativeQuote] = useState<ProtectionQuote | null>(null);
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1_000));
  const [guideOpen, setGuideOpen] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [detailCode, setDetailCode] = useState<string | null>(null);
  /** Local-only "notify me" choices (in memory on this device; never sent anywhere). */
  const [notifyCodes, setNotifyCodes] = useState<ReadonlySet<string>>(new Set());
  const quoteRequestId = useRef(0);
  useEffect(() => {
    const timer = setInterval(() => setNowSeconds(Math.floor(Date.now() / 1_000)), 30_000);
    return () => clearInterval(timer);
  }, []);
  const [quote, setQuote] = useState<ProtectionQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [claimReadiness, setClaimReadiness] = useState<ClaimReadiness | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [transactionBusy, setTransactionBusy] = useState(false);
  const [transactionMessage, setTransactionMessage] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);

  const loadHome = useCallback(async () => {
    setHomeLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      getJson<{ cities: CityIndex[] }>("/api/mobile?resource=cities"),
      getJson<{ markets: AgriculturalMarket[] }>("/api/mobile?resource=agricultural-markets"),
      getJson<DevnetStatus>("/api/devnet/status"),
    ]);
    const [cityResult, catalogResult, statusResult] = results;
    if (cityResult.status === "fulfilled") {
      const ordered = [...cityResult.value.cities].sort((a, b) => {
        const ai = CITY_ORDER.indexOf(a.slug);
        const bi = CITY_ORDER.indexOf(b.slug);
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      });
      setCities(ordered);
      setCity(resolveSelectedNoaaCity(selectedCity, ordered));
    } else {
      setError(cityResult.reason instanceof Error ? cityResult.reason.message : "Could not load NOAA index data.");
    }
    if (catalogResult.status === "fulfilled") setCatalog(catalogResult.value.markets);
    if (statusResult.status === "fulfilled") setStatus(statusResult.value);
    setHomeLoading(false);
  }, [selectedCity]);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  useEffect(() => {
    if (!selectedCity) return;
    if (!resolveSelectedNoaaCity(selectedCity, cities)) {
      setCity(null);
      return;
    }
    let cancelled = false;
    getJson<CityIndex>(`/api/mobile?resource=city&slug=${encodeURIComponent(selectedCity)}`)
      .then((details) => { if (!cancelled) setCity(details); })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load this NOAA index.");
      });
    return () => { cancelled = true; };
  }, [selectedCity, cities]);

  const loadWalletData = useCallback(async (address: string, force = false) => {
    const [balanceResult, portfolioResult] = await Promise.allSettled([
      readWalletStateWithFallback(address, { timeoutMs: 20_000, direct: (a) => readFinalizedWalletStateAnyRpc(a, { force }), server: (a) => getJson<FinalizedWalletState>(`/api/mobile?resource=wallet-balances&wallet=${encodeURIComponent(a)}`) }),
      getJson<Portfolio>(`/api/mobile?resource=portfolio&wallet=${encodeURIComponent(address)}`),
    ]);
    setWalletBalances(balanceResult.status === "fulfilled" ? balanceResult.value : null);
    setPortfolio(portfolioResult.status === "fulfilled" ? portfolioResult.value : null);
    setPortfolioError(portfolioResult.status === "rejected"
      ? portfolioResult.reason instanceof Error ? portfolioResult.reason.message : "Portfolio indexing is unavailable."
      : null);
  }, []);

  const retryData = useCallback(async () => {
    await loadHome();
    if (!resolveSelectedNoaaCity(selectedCity, cities)) {
      setError(null);
      return;
    }
    try {
      const details = await getJson<CityIndex>(`/api/mobile?resource=city&slug=${encodeURIComponent(selectedCity)}`);
      setCity(details);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load this NOAA index.");
    }
  }, [cities, loadHome, selectedCity]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadHome();
      if (wallet) await loadWalletData(wallet);
    } finally {
      setRefreshing(false);
    }
  }, [loadHome, loadWalletData, wallet]);

  const connect = useCallback(async () => {
    setLoading(true);
    setWalletError(null);
    try {
      const session = await authorizeDevnetWallet();
      setWalletSession(session);
      setWallet(session.address);
      await loadWalletData(session.address);
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "";
      setWalletError(/cancel|reject|declin/i.test(detail)
        ? "Wallet connection wasn’t approved. You can try again whenever you’re ready."
        : "The wallet didn’t connect. Check that a compatible Solana wallet is installed, then try again.");
    } finally {
      setLoading(false);
    }
  }, [loadWalletData]);

  const changeCity = (slug: string) => {
    setHasChosenArea(true);
    setSelectedCity(slug);
    setSelectedHazard(slug === "des-moines" ? "rainfall" : null);
    const next = resolveSelectedNoaaCity(slug, cities);
    setCity(next);
    setError(null);
    setQuote(null);
    setQuoteError(null);
    setTransactionSignature(null);
    setTransactionMessage(null);
    setTransactionError(null);
  };

  const askGuide = async (message: string) => {
    if (guideBusy) return;
    const id = Date.now();
    const context = [...guideTurns].reverse().find((turn) => turn.result)?.result?.intent;
    setGuideTurns((turns) => [...turns, { id, customer: message, result: null, error: null }]);
    setGuideBusy(true);
    try {
      const result = await postJson<AdvisoryResponse>("/api/advisory", { message, ...(context ? { context } : {}) });
      if (result.quote !== null || result.transaction !== null || result.explicitApprovalRequired !== true) throw new Error("The guide returned an unsupported transaction or quote state.");
      setGuideTurns((turns) => turns.map((turn) => turn.id === id ? { ...turn, result } : turn));
    } catch (reason) {
      setGuideTurns((turns) => turns.map((turn) => turn.id === id ? { ...turn, error: "The guide can't answer right now. You can still browse Markets and Protect; no quote or transaction was prepared." } : turn));
    } finally {
      setGuideBusy(false);
    }
  };

  const orderedHistory = useMemo(() => city?.weeklyHistoryMm?.slice(-8) ?? [], [city]);
  const marketReady = isMarketReadyForCity(city?.slug ?? selectedCity, status);
  const amountBase = parseSkytAmount(protectionAmount);
  const baseProtectionReason = getProtectionUnavailableReason({ status, citySlug: selectedCity, walletConnected: !!wallet, walletSkytBalanceBase: walletBalances?.skytBaseUnits ?? null, amountBase });
  const positionGateReason = !wallet ? null
    : claimError ? "The current on-chain position could not be verified; refresh before requesting another position."
      : !claimReadiness ? "Checking the finalized wallet position before allowing another position."
        : claimReadiness.state !== "no_position" ? "This wallet already has a Des Moines position or a pending outcome; a duplicate position is not available."
          : null;
  const protectionUnavailableReason = selectedHazard !== "rainfall"
    ? "Choose a place and its rainfall risk in Explore. Wind gust and snowfall remain research-only."
    : baseProtectionReason ?? positionGateReason;
  const quotePaymentReason = quote && walletBalances && BigInt(quote.premium) > BigInt(walletBalances.skytBaseUnits)
    ? `Your finalized wallet balance is ${formatSkyt(walletBalances.skytBaseUnits)} SKYT; the premium is ${formatSkyt(quote.premium)} SKYT.`
    : null;
  const marketLocation = catalog.find((item) => item.slug === selectedCity);
  const changeAmountMode = (nextMode: AmountMode) => {
    setAmountMode(nextMode);
    setQuote(null);
    setQuoteError(null);
    setTransactionError(null);
  };

  const requestProtectionQuote = async () => {
    const id = ++quoteRequestId.current;
    setQuoteError(null);
    setQuote(null);
    if (protectionUnavailableReason || !status || !amountBase) return;
    const request = buildCommittedQuoteRequest(status, amountBase);
    if (!request) {
      setQuoteError("This window's terms aren't finalized yet, so it can't be priced.");
      return;
    }
    setQuoteBusy(true);
    try {
      const result = await postJson<ProtectionQuote>("/api/quotes", request);
      if (result.protectedAmount !== amountBase || result.source !== "NOAA" || result.explicitApprovalRequired !== true) throw new Error("The price didn't match the selected coverage. Get a new price.");
      if (id === quoteRequestId.current) setQuote(result);
    } catch (reason) {
      if (id === quoteRequestId.current) setQuoteError(reason instanceof Error ? reason.message : "The NOAA-backed price is unavailable.");
    } finally {
      if (id === quoteRequestId.current) setQuoteBusy(false);
    }
  };

  // Re-price automatically whenever coverage changes or the market becomes quotable.
  useEffect(() => {
    if (tab !== "protect" || protectionUnavailableReason || !amountBase) { quoteRequestId.current++; setQuoteBusy(false); return; }
    void requestProtectionQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, amountBase, protectionUnavailableReason, status?.desMoinesMarket.quoteInputsHash]);

  // Indicative "From X SKYT per 100" for the Markets hero: a real NOAA quote for 100 SKYT, no wallet needed.
  useEffect(() => {
    if (!status) { setIndicativeQuote(null); return; }
    const reason = getProtectionUnavailableReason({ status, citySlug: "des-moines", walletConnected: true, walletSkytBalanceBase: "0", amountBase: "100000000" });
    const request = reason ? null : buildCommittedQuoteRequest(status, "100000000");
    if (!request) { setIndicativeQuote(null); return; }
    let cancelled = false;
    postJson<ProtectionQuote>("/api/quotes", request)
      .then((value) => { if (!cancelled && value.protectedAmount === "100000000" && value.source === "NOAA") setIndicativeQuote(value); })
      .catch(() => { if (!cancelled) setIndicativeQuote(null); });
    return () => { cancelled = true; };
  }, [status?.desMoinesMarket.quoteInputsHash, status?.desMoinesMarket.salesCloseAt, status]);

  const chooseCoverage = (option: CoverageOption) => {
    if (!option.enabled || !option.amountBase) return;
    setCoverageId(option.id);
    setProtectionAmount((Number(BigInt(option.amountBase) / 1_000_000n)).toString());
    setTransactionError(null);
  };
  // Keep "Max" in sync with the finalized balance.
  useEffect(() => {
    if (coverageId !== "max") return;
    const max = coverageOptions(walletBalances ? String(walletBalances.skytBaseUnits) : null)[3];
    if (max.amountBase) setProtectionAmount((Number(BigInt(max.amountBase) / 1_000_000n)).toString());
  }, [coverageId, walletBalances]);

  const submitApprovedAction = async (action: "open_position" | "claim_payout" | "claim_premium_refund") => {
    setTransactionBusy(true);
    setTransactionError(null);
    setTransactionMessage(action === "open_position" ? "Preparing your protection…" : "Preparing your claim…");
    setTransactionSignature(null);
    try {
      if (!walletSession || !wallet || !status?.desMoinesMarket.address) throw new Error("Connect the wallet and refresh finalized market status before continuing.");
      if (action === "open_position" && (amountMode !== "devnet-test" || protectionUnavailableReason || !quote || !amountBase || quotePaymentReason)) throw new Error(protectionUnavailableReason ?? quotePaymentReason ?? "Enter Devnet test mode and request a valid SKYT quote before approving a protection position.");
      if (action.startsWith("claim_") && selectedCity !== "des-moines") throw new Error("Select Des Moines to review this market’s claim status.");
      if (action.startsWith("claim_") && (claimReadiness?.state !== "claimable" || claimReadiness.action !== action)) throw new Error("The finalized claim-readiness API does not currently allow this claim.");
      const unsigned = await postJson<UnsignedTransaction>("/api/transactions/unsigned", {
        action, market: status.desMoinesMarket.address, wallet, ...(action === "open_position" ? { amount: amountBase } : {}), approved: true,
      });
      if (unsigned.network !== "devnet" || unsigned.market !== status.desMoinesMarket.address || unsigned.wallet !== wallet) throw new Error("The prepared transaction does not match this wallet, market, or Devnet.");
      setTransactionMessage("Approve it in your wallet…");
      const signature = await signAndConfirmDevnetTransaction({ transactionBase64: unsigned.base64, wallet: walletSession, rpcUrl: DEVNET_RPC_URL });
      setTransactionSignature(signature);
      setTransactionMessage(null);
      setQuote(null);
      await loadHome();
      await loadWalletData(wallet, true);
      if (status.desMoinesMarket.address) {
        const readiness = await getJson<ClaimReadiness>(claimReadinessPath(status.desMoinesMarket.address, wallet));
        setClaimReadiness(readiness);
      }
    } catch (reason) {
      setTransactionMessage(null);
      setTransactionError(reason instanceof Error ? reason.message : "The transaction did not complete.");
    } finally {
      setTransactionBusy(false);
    }
  };

  useEffect(() => {
    if (!wallet || !status?.desMoinesMarket.address) {
      setClaimReadiness(null);
      setClaimError(null);
      return;
    }
    let cancelled = false;
    getJson<ClaimReadiness>(claimReadinessPath(status.desMoinesMarket.address, wallet))
      .then((value) => { if (!cancelled) { setClaimReadiness(value); setClaimError(null); } })
      .catch((reason) => { if (!cancelled) setClaimError(reason instanceof NotAvailableYetError ? "Position status is not available yet." : reason instanceof Error ? reason.message : "Claim status is unavailable."); });
    return () => { cancelled = true; };
  }, [wallet, status?.desMoinesMarket.address]);

  if (!fontsLoaded && !fontError) return <SafeAreaProvider><SafeAreaView style={styles.fontLoading}><StatusBar barStyle="light-content" backgroundColor={C.canvas} /><ActivityIndicator color={C.green} /></SafeAreaView></SafeAreaProvider>;

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.canvas} translucent={false} />
      <LinearGradient pointerEvents="none" colors={["#0F1A24", "#0B0F14", "#0B0F14"]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      {!showLanding ? <View style={styles.header} accessibilityRole="header">
        <View style={styles.brandMark}><AppIcon name="cloud-drizzle" color={C.green} size={22} /></View>
        <View style={styles.brandCopy}>
          <Text style={styles.brand}>SkyHedge</Text>
          <Text style={styles.brandSub}>Weather protection</Text>
        </View>
        <NetworkPill />
      </View> : null}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.blue} />}
      >
        <ScreenTransition transitionKey={tab}>
        {error ? <ErrorBanner message={error} onRetry={() => { void retryData(); }} /> : null}
        {homeLoading && cities.length === 0 && catalog.length === 0 ? <View style={styles.loadingPanel}><ActivityIndicator color={C.blue} /><Text style={styles.emptyText}>Loading finalized weather, market catalog, and Devnet readiness…</Text></View> : null}
        {showLanding ? (
          <Landing live={!!status && marketIsLive(status, nowSeconds)} busy={loading} onBrowse={() => setShowLanding(false)} onConnect={() => { void connect().then(() => setShowLanding(false)); }} />
        ) : null}
        {!showLanding && tab === "catalog" && detailCode && marketByCode(detailCode) ? (
          <MarketDetail
            market={marketByCode(detailCode)!}
            notified={notifyCodes.has(detailCode)}
            onNotify={() => setNotifyCodes((prev) => { const next = new Set(prev); if (next.has(detailCode)) next.delete(detailCode); else next.add(detailCode); return next; })}
            onBack={() => setDetailCode(null)}
            onExploreLive={() => { setDetailCode(null); if (selectedCity !== "des-moines") changeCity("des-moines"); setSelectedHazard("rainfall"); setTab("protect"); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
          />
        ) : null}
        {!showLanding && tab === "catalog" && !detailCode ? (
          <MarketsScreen
            onOpenMarket={(m: CatalogMarket) => { setDetailCode(m.code); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
            status={status}
            city={city}
            indicativeQuote={indicativeQuote}
            nowSeconds={nowSeconds}
            onProtect={() => { if (selectedCity !== "des-moines") changeCity("des-moines"); setSelectedHazard("rainfall"); setTab("protect"); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
            guide={<>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: guideOpen }} accessibilityLabel="Describe your plans and let the guide find a market" onPress={() => setGuideOpen((open) => !open)} style={styles.guideToggle}><AppIcon name="message-circle" color={C.blue} size={20} /><Text style={styles.guideToggleText}>Describe your plans instead</Text><AppIcon name={guideOpen ? "chevron-up" : "chevron-down"} color={C.muted} size={18} /></Pressable>
              {guideOpen ? <GuidePanel turns={guideTurns} busy={guideBusy} onSend={(message) => { void askGuide(message); }} onViewMatch={(result) => { if (result.match?.slug !== "des-moines") return; changeCity("des-moines"); setTab("protect"); scrollRef.current?.scrollTo({ y: 0, animated: false }); }} /> : null}
            </>}
          />
        ) : null}
        {!showLanding && tab === "protect" ? (
          !status && (isNetworkError(error) || isNetworkError(walletError) || isNetworkError(portfolioError)) ? (
            <View style={styles.emptyState} accessibilityRole="alert">
              <AppIcon name="wifi-off" color={C.amber} size={22} />
              <Text style={[styles.emptyTitle, { marginTop: 10 }]}>You’re offline</Text>
              <Text style={styles.emptyText}>SkyHedge can’t reach its market service from this phone. Check Wi‑Fi or mobile data, then retry.</Text>
              <View style={{ marginTop: 16 }}><ActionButton label="Retry" icon="refresh-cw" onPress={() => { void retryData(); }} /></View>
            </View>
          ) : (
            <ProtectTicket
              status={status}
              nowSeconds={nowSeconds}
              coverageId={coverageId}
              onCoverage={chooseCoverage}
              walletConnected={!!wallet}
              walletSkytBase={walletBalances ? String(walletBalances.skytBaseUnits) : null}
              amountBase={amountBase}
              quote={quote}
              quoteBusy={quoteBusy}
              quoteError={quoteError}
              onRetryQuote={() => { void requestProtectionQuote(); }}
              unavailableReason={protectionUnavailableReason}
              claimReadiness={claimReadiness}
              claimError={claimError}
              transactionMessage={transactionMessage}
              transactionError={transactionError}
              transactionSignature={transactionSignature}
              walletName={WALLET_NAME}
              onRefresh={() => { void refresh(); }}
              observedMm={city?.slug === "des-moines" ? city.cumulativeMm : null}
              onProtectAgain={() => { setTransactionSignature(null); setTransactionMessage(null); setTransactionError(null); scrollRef.current?.scrollTo({ y: 0, animated: true }); }}
              onBackToMarkets={() => { setTransactionSignature(null); setTab("catalog"); setDetailCode(null); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
            />
          )
        ) : null}
        {!showLanding && tab === "wallet" ? (
          <WalletV2
            wallet={wallet}
            walletName={WALLET_NAME}
            balances={walletBalances}
            portfolio={portfolio}
            portfolioError={portfolioError}
            walletError={walletError}
            loading={loading}
            marketAddress={status?.desMoinesMarket.address ?? null}
            onConnect={() => { void connect(); }}
            onDisconnect={() => { setWallet(null); setWalletSession(null); setPortfolio(null); setWalletBalances(null); setPortfolioError(null); setWalletError(null); setClaimReadiness(null); setQuote(null); }}
          />
        ) : null}
        </ScreenTransition>
      </ScrollView>

      {!showLanding && tab === "protect" && status ? (() => {
        const claimable = claimReadiness?.state === "claimable" && claimReadiness.action;
        if (claimable) return <StickyCta label={claimReadiness.action === "claim_payout" ? "Collect payout to wallet" : "Claim refund in wallet"} busy={transactionBusy} onPress={() => { if (claimReadiness?.action) void submitApprovedAction(claimReadiness.action); }} />;
        if (!wallet) return <StickyCta label="Connect wallet to protect" busy={loading} onPress={() => { void connect(); }} />;
        const quoteReady = !!quote && quote.protectedAmount === amountBase;
        return <StickyCta
          label={`Review in ${WALLET_NAME === "Your wallet" ? "wallet" : WALLET_NAME}`}
          hint={quoteBusy ? "Getting a live NOAA price…" : null}
          disabled={!quoteReady || !!quotePaymentReason || !!protectionUnavailableReason || quoteBusy}
          busy={transactionBusy}
          onPress={() => { void submitApprovedAction("open_position"); }}
        />;
      })() : null}
      {showLanding ? null : <View style={styles.bottomBar} accessibilityRole="tablist" accessibilityLabel="Main navigation">
        <TabButton label="Markets" icon="map-pin" selected={tab === "catalog" || tab === "weather"} onPress={() => { setTab("catalog"); setDetailCode(null); scrollRef.current?.scrollTo({ y: 0, animated: false }); }} />
        <TabButton label="Protect" icon="shield" selected={tab === "protect"} onPress={() => setTab("protect")} />
        <TabButton label="Wallet" icon="credit-card" selected={tab === "wallet"} onPress={() => setTab("wallet")} />
      </View>}
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

function ExplorerLink({ signature, label = "View finalized transaction in Solana Explorer" }: { signature: string; label?: string }) {
  const url = `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet`;
  return <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => { void Linking.openURL(url); }} style={styles.explorerLink}><Text style={styles.explorerLinkText}>{label}</Text></Pressable>;
}

function TabButton({ label, icon, selected, onPress }: { label: string; icon: AppIconName; selected: boolean; onPress: () => void }) {
  return (
    <TactilePressable containerStyle={styles.tabButtonWrap} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} android_ripple={{ color: C.purpleSoft }} style={[styles.tabButton, selected && styles.tabButtonSelected]}>
      <AppIcon name={icon} color={selected ? C.green : C.quiet} size={21} />
      <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{label}</Text>
    </TactilePressable>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.metricRow}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  const lowerMessage = message.toLowerCase();
  const evidenceMissing = message === "NOT_FOUND" || message === "DATA_UNAVAILABLE";
  const mobileRoutesMissing = lowerMessage.includes("missing the mobile read routes");
  const readableMessage = lowerMessage.includes("cleartext") || lowerMessage.includes("fetch failed") || lowerMessage.includes("network request failed")
    ? "SkyHedge couldn’t reach its data service from this device. Check the device connection and try again."
    : message === "NOT_FOUND"
      ? "No published NOAA evidence is available for this market yet."
      : message === "DATA_UNAVAILABLE"
        ? "NOAA could not provide a valid observation package for this window."
        : message;
  return (
    <View accessibilityRole="alert" style={styles.errorBanner}>
      <Text style={styles.errorTitle}>{evidenceMissing ? "NOAA evidence unavailable" : mobileRoutesMissing ? "Mobile API needs an update" : "Can’t reach SkyHedge"}</Text>
      <Text style={styles.errorBody}>{friendlyError(readableMessage)}</Text>
      <View style={styles.errorActions}>
        <View />
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}><Text style={styles.retryButtonText}>Try again</Text></Pressable>
      </View>
    </View>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <View style={styles.emptyState}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{body}</Text></View>;
}

function shorten(value: string) {
  return `${value.slice(0, 5)}…${value.slice(-5)}`;
}

const styles = StyleSheet.create({
  fontLoading: { flex: 1, backgroundColor: C.canvas, justifyContent: "center", alignItems: "center" },
  safe: { flex: 1, backgroundColor: C.canvas },
  header: { minHeight: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, backgroundColor: "transparent", borderBottomWidth: 1, borderBottomColor: C.border },
  card: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 12 },
  brandMark: { width: 36, height: 36, borderRadius: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  brandCopy: { marginLeft: 10, flex: 1 },
  brand: { color: C.ink, fontFamily: F.headingBold, fontSize: 18, letterSpacing: -0.4 },
  brandSub: { color: C.quiet, fontFamily: F.bodyMedium, fontSize: 12, marginTop: 1 },
  scrollContent: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 18, paddingTop: 18, paddingBottom: 32 },
  screenLead: { marginBottom: 18 },
  kicker: { color: C.muted, fontFamily: F.bodySemi, fontSize: 12, marginBottom: 5 },
  title: { color: C.ink, fontFamily: F.headingBold, fontSize: 27, lineHeight: 33, letterSpacing: -0.8 },
  intro: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 22 },
  changePlace: { minWidth: 60, minHeight: 48, alignItems: "flex-end", justifyContent: "center" },
  changePlaceText: { color: C.blue, fontFamily: F.bodySemi, fontSize: 14, textDecorationLine: "underline" },
  chosenPrompt: { color: C.muted, fontFamily: F.body, fontSize: 14, lineHeight: 21, marginTop: 16 },
  riskSegments: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border },
  riskSegment: { flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  riskSegmentSelected: { borderBottomWidth: 2, borderBottomColor: C.green },
  riskSegmentText: { color: C.muted, fontFamily: F.bodyMedium, fontSize: 13, textAlign: "center" },
  riskSegmentTextSelected: { color: C.ink, fontFamily: F.bodySemi },
  outcomeSurface: { marginTop: 16 },
  outcomeSurfaceContent: { padding: 16 },
  outcomeSummary: { color: C.muted, fontFamily: F.body, fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 14 },
  outcomeFacts: { marginTop: 8 },
  detailsToggle: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  detailsToggleText: { color: C.blue, fontFamily: F.bodySemi, fontSize: 13 },
  cityRail: { gap: 8, paddingBottom: 16 },
  cityChip: { minHeight: 48, paddingHorizontal: 15, justifyContent: "center", borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.surface },
  cityChipSelected: { borderColor: C.rain, backgroundColor: C.rainSoft },
  cityChipText: { color: C.ink, fontFamily: F.bodyMedium, fontSize: 13 },
  cityChipTextSelected: { color: C.white },
  heroCard: { backgroundColor: C.surface, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, padding: 20, overflow: "hidden" },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroLabel: { color: C.blue, fontFamily: F.bodySemi, fontSize: 12 },
  heroPlace: { color: C.white, fontFamily: F.headingBold, fontSize: 22, marginTop: 6 },
  heroSub: { color: C.muted, fontSize: 12, marginTop: 5 },
  indexBadge: { backgroundColor: C.greenSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  indexBadgeText: { color: C.green, fontFamily: F.bodySemi, fontSize: 12 },
  indexBadgeUnavailable: { backgroundColor: C.amberSoft },
  indexBadgeUnavailableText: { color: C.amber },
  rainValueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 18 },
  rainValue: { color: C.white, fontFamily: F.headingBold, fontSize: 52, lineHeight: 62, letterSpacing: -1.8, fontVariant: ["tabular-nums"] },
  rainUnit: { color: C.muted, fontSize: 18, marginLeft: 8 },
  rainCaption: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 2 },
  windowRow: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 18, paddingTop: 13, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
  windowLabel: { color: C.quiet, fontSize: 12 },
  windowDates: { color: C.white, fontFamily: F.bodySemi, fontSize: 12 },
  sectionHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 5, marginTop: 23, marginBottom: 11 },
  sectionTitle: { color: C.ink, fontFamily: F.heading, fontSize: 19 },
  sectionMeta: { color: C.quiet, fontSize: 12 },
  chartCard: { flexDirection: "row", minHeight: 170, alignItems: "stretch", justifyContent: "space-between", gap: 4, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 12 },
  loadingPanel: { minHeight: 110, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 12, padding: 18, marginBottom: 14 },
  barColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  barValue: { color: C.ink, fontFamily: F.bodySemi, fontSize: 12, marginBottom: 6, fontVariant: ["tabular-nums"] },
  barTrack: { flex: 1, width: 20, maxHeight: 85, justifyContent: "flex-end", backgroundColor: C.mutedSurface, borderRadius: 8, overflow: "hidden" },
  barFill: { width: "100%", backgroundColor: C.blue, borderRadius: 4 },
  barUnknown: { width: "100%", height: 2, backgroundColor: C.border, marginTop: "auto" },
  barDate: { color: C.muted, fontFamily: F.bodyMedium, fontSize: 12, marginTop: 6, textAlign: "center" },
  emptyText: { color: C.muted, fontSize: 13, lineHeight: 20 },
  noteCard: { backgroundColor: C.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingVertical: 17, marginTop: 17 },
  noteTitle: { color: C.ink, fontFamily: F.heading, fontSize: 16 },
  noteBody: { color: C.muted, fontSize: 12, lineHeight: 19, marginTop: 5 },
  secondaryAction: { minHeight: 72, justifyContent: "center", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 15, paddingHorizontal: 15, paddingVertical: 12, marginTop: 13 },
  secondaryActionTitle: { color: C.ink, fontFamily: F.bodySemi, fontSize: 13 },
  secondaryActionBody: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  releaseCard: { backgroundColor: C.amberSoft, borderRadius: 12, padding: 15, marginTop: 15, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  releaseIcon: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: C.amber, alignItems: "center", justifyContent: "center" },
  releaseIconText: { color: C.amber, fontSize: 13, fontWeight: "700" },
  releaseCopy: { flex: 1 },
  releaseTitle: { color: C.ink, fontFamily: F.bodySemi, fontSize: 13 },
  releaseBody: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  searchWrap: { minHeight: 56, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 13, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  selectionPrompt: { color: C.ink, fontFamily: F.heading, fontSize: 18, lineHeight: 24, marginBottom: 12 },
  riskSheet: { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 8, marginBottom: 16 },
  guideToggle: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, marginTop: 7 },
  guideToggleText: { flex: 1, color: C.blue, fontFamily: F.bodySemi, fontSize: 14 },
  searchInput: { flex: 1, minHeight: 48, color: C.ink, fontSize: 14, paddingVertical: 8 },
  clearSearch: { minWidth: 48, minHeight: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  resultMeta: { color: C.muted, fontSize: 12, marginTop: 8, marginBottom: 11 },
  marketCard: { backgroundColor: C.canvas, borderTopColor: C.border, borderTopWidth: StyleSheet.hairlineWidth, minHeight: 78, paddingVertical: 15 },
  marketCardSelected: { backgroundColor: C.surface },
  marketActionRow: { borderTopWidth: 1, borderTopColor: C.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, marginTop: 13 },
  marketAction: { color: C.blue, fontFamily: F.bodySemi, fontSize: 12 },
  marketTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  marketPin: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.blueSoft, alignItems: "center", justifyContent: "center" },
  marketMain: { flex: 1 },
  marketName: { color: C.ink, fontFamily: F.heading, fontSize: 15, lineHeight: 20 },
  marketPlace: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  researchPill: { paddingHorizontal: 9, paddingVertical: 6, backgroundColor: C.amberSoft, borderRadius: 12 },
  researchPillText: { color: C.amber, fontFamily: F.bodySemi, fontSize: 12 },
  marketContext: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 10, marginLeft: 50 },
  marketCrops: { color: C.muted, fontFamily: F.bodyMedium, fontSize: 12, marginTop: 8, textTransform: "capitalize" },
  marketFoot: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, marginTop: 11, color: C.muted, fontSize: 12, lineHeight: 17 },
  hazardRail: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 13 },
  hazardChip: { minHeight: 48, paddingHorizontal: 14, justifyContent: "center", borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.surface },
  hazardChipSelected: { borderColor: C.rain, backgroundColor: C.rainSoft },
  hazardChipText: { color: C.ink, fontFamily: F.bodyMedium, fontSize: 13 },
  hazardChipTextSelected: { color: C.white },
  hazardCard: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 7 },
  miniHistory: { marginTop: 18, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  miniHistoryTitle: { color: C.ink, fontFamily: F.bodySemi, fontSize: 13, marginBottom: 10 },
  miniChart: { flexDirection: "row", minHeight: 120, justifyContent: "space-between", gap: 6 },
  miniBarTrack: { maxHeight: 72, width: 22 },
  miniHistoryNote: { color: C.quiet, fontSize: 12, lineHeight: 17, marginTop: 8 },
  hazardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  hazardTitle: { color: C.ink, fontFamily: F.heading, fontSize: 17 },
  hazardNote: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  hazardBlocked: { color: C.amber, fontFamily: F.bodySemi, fontSize: 12, marginTop: 9 },
  walletCard: { marginTop: 4 },
  walletCardContent: { alignItems: "flex-start", padding: 20 },
  walletOrb: { width: 52, height: 52, borderRadius: 12, backgroundColor: C.rainSoft, justifyContent: "center", alignItems: "center" },
  walletTitle: { color: C.ink, fontFamily: F.heading, fontSize: 20 },
  walletAddress: { color: C.ink, fontFamily: F.mono, fontSize: 14, marginTop: 6 },
  primaryButton: { minHeight: 52, width: "100%", alignItems: "center", justifyContent: "center", backgroundColor: C.green, borderRadius: 14, marginTop: 18 },
  primaryButtonText: { color: C.actionText, fontFamily: F.bodyBold, fontSize: 14 },
  disabledButton: { opacity: 0.65 },
  secondaryButton: { minHeight: 48, minWidth: 150, alignItems: "center", justifyContent: "center", borderColor: C.border, borderWidth: 1, borderRadius: 13, marginTop: 18 },
  secondaryButtonText: { color: C.ink, fontFamily: F.bodySemi, fontSize: 13 },
  walletActionWrap: { width: "100%", marginTop: 18 },
  walletHint: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 14 },
  portfolioCard: { backgroundColor: C.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingVertical: 14, marginTop: 16 },
  evidenceStep: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingVertical: 9 },
  evidenceDot: { width: 9, height: 9, borderRadius: 5 },
  evidenceDotReady: { backgroundColor: C.green },
  evidenceDotPending: { backgroundColor: C.amber },
  evidenceStepText: { color: C.ink, fontSize: 12, flex: 1 },
  evidenceStepState: { fontFamily: F.bodySemi, fontSize: 12 },
  readyText: { color: C.green },
  pendingText: { color: C.amber },
  protectCard: { backgroundColor: C.canvas, paddingTop: 4, paddingBottom: 12 },
  protectHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 14 },
  heroLabelLight: { color: C.muted, fontFamily: F.bodySemi, fontSize: 12 },
  protectPlace: { color: C.ink, fontFamily: F.headingBold, fontSize: 23, lineHeight: 28, marginTop: 4 },
  protectLocation: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  stepperWrap: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 16 },
  sourceLine: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sourceText: { color: C.muted, fontSize: 12, lineHeight: 17, flex: 1 },
  triggerPanel: { backgroundColor: C.surfaceRaised, borderWidth: 1, borderColor: C.border, borderLeftWidth: 3, borderLeftColor: C.rain, borderRadius: 12, padding: 16, marginBottom: 24 },
  triggerLabel: { color: C.rain, fontFamily: F.bodySemi, fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 },
  triggerValue: { color: C.white, fontFamily: F.headingBold, fontSize: 22, lineHeight: 28, fontVariant: ["tabular-nums"] },
  triggerWindow: { color: C.muted, fontSize: 12, marginTop: 5 },
  protectBlocked: { color: C.amber, backgroundColor: C.amberSoft, borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 18, marginBottom: 16 },
  hedgeBalance: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, marginBottom: 20 },
  hedgeBalanceText: { flex: 1, color: C.ink, fontFamily: F.bodySemi, fontSize: 15, lineHeight: 22 },
  optionLine: { color: C.ink, fontFamily: F.heading, fontSize: 18, lineHeight: 25, marginVertical: 10 },
  amountHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 },
  inputLabel: { color: C.ink, fontFamily: F.bodySemi, fontSize: 13 },
  amountUnit: { color: C.quiet, fontSize: 12 },
  amountInput: { minHeight: 56, borderWidth: 1, borderColor: C.border, borderRadius: 13, backgroundColor: C.canvas, color: C.ink, paddingHorizontal: 14, fontFamily: F.heading, fontSize: 20, fontVariant: ["tabular-nums"] },
  inputHint: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 6 },
  actionWrap: { marginTop: 16 },
  previewBlocker: { color: C.amber, fontFamily: F.bodyMedium, fontSize: 13, lineHeight: 19, marginTop: 12 },
  modeBack: { minHeight: 48, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 4, paddingRight: 12 },
  modeBackText: { color: C.blue, fontFamily: F.bodySemi, fontSize: 13 },
  testModeHeading: { color: C.ink, fontFamily: F.heading, fontSize: 18, marginBottom: 5 },
  testModeNote: { color: C.muted, fontSize: 12, lineHeight: 19, marginBottom: 16 },
  quoteCard: { marginTop: 16 },
  ticket: { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: 1, borderRadius: 12, padding: 16 },
  ticketHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  ticketEyebrow: { color: C.quiet, fontFamily: F.bodySemi, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },
  ticketHero: { flexDirection: "row", marginTop: 16, borderRadius: 12, backgroundColor: C.canvas, borderWidth: 1, borderColor: C.border, paddingVertical: 14 },
  ticketHeroCell: { flex: 1, paddingHorizontal: 14 },
  ticketDivider: { width: 1, backgroundColor: C.border },
  ticketHeroLabel: { color: C.muted, fontFamily: F.bodySemi, fontSize: 12 },
  ticketHeroMoney: { color: C.payout, fontFamily: F.headingBold, fontSize: 26, lineHeight: 32, marginTop: 4, fontVariant: ["tabular-nums"] },
  ticketHeroUnit: { color: C.quiet, fontSize: 11 },
  ticketTable: { marginTop: 2 },
  ticketFoot: { color: C.quiet, fontSize: 11, marginTop: 10 },
  quoteCardContent: { padding: 13 },
  quoteHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  quoteTitle: { color: C.ink, fontFamily: F.heading, fontSize: 16 },
  quoteWarning: { color: C.amber, fontSize: 12, lineHeight: 17, marginTop: 11 },
  blockedNotice: { backgroundColor: C.amberSoft, borderRadius: 12, padding: 12, marginTop: 14, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  blockedCopy: { flex: 1 },
  blockedTitle: { color: C.amber, fontFamily: F.bodySemi, fontSize: 12 },
  blockedBody: { color: C.ink, fontSize: 12, lineHeight: 17, marginTop: 4 },
  inlineRetry: { minHeight: 44, alignSelf: "flex-start", justifyContent: "center", marginTop: 5, paddingRight: 8 },
  inlineRetryText: { color: C.blue, fontFamily: F.bodySemi, fontSize: 12 },
  actionError: { backgroundColor: C.redSoft, borderColor: C.red, borderWidth: 1, borderRadius: 11, padding: 12, marginTop: 12 },
  actionProgress: { color: C.blue, fontFamily: F.bodyMedium, fontSize: 12, marginTop: 13 },
  signatureCard: { backgroundColor: C.greenSoft, borderColor: C.green, borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 16 },
  proofHeading: { flexDirection: "row", alignItems: "center", gap: 9 },
  signatureTitle: { color: C.green, fontFamily: F.heading, fontSize: 15 },
  signatureText: { color: C.muted, fontSize: 12, lineHeight: 16, marginTop: 8, fontVariant: ["tabular-nums"] },
  explorerLink: { minHeight: 48, alignSelf: "flex-start", justifyContent: "center", paddingRight: 7 },
  explorerLinkText: { color: C.blue, fontFamily: F.bodySemi, fontSize: 12, textDecorationLine: "underline" },
  verificationCard: { backgroundColor: C.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, marginTop: 19 },
  verificationButton: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 15 },
  verificationText: { flex: 1 },
  verificationTitle: { color: C.ink, fontFamily: F.bodySemi, fontSize: 13 },
  verificationSummary: { color: C.muted, fontSize: 12, marginTop: 3 },
  verificationBody: { paddingHorizontal: 15, paddingBottom: 9 },
  claimReason: { color: C.muted, fontSize: 12, lineHeight: 18 },
  metricRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10, borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 12 },
  metricLabel: { color: C.muted, fontSize: 12, flex: 1 },
  metricValue: { color: C.ink, fontFamily: F.bodySemi, fontSize: 12, maxWidth: "58%", textAlign: "right", fontVariant: ["tabular-nums"] },
  portfolioFoot: { color: C.muted, fontSize: 12, lineHeight: 16, marginTop: 4 },
  errorBanner: { backgroundColor: C.redSoft, borderWidth: 1, borderColor: C.red, borderRadius: 15, padding: 14, marginBottom: 18 },
  errorTitle: { color: C.red, fontFamily: F.bodySemi, fontSize: 13 },
  errorBody: { color: C.ink, fontSize: 12, lineHeight: 18, marginTop: 4 },
  errorActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  retryButton: { minHeight: 48, justifyContent: "center", paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.surface, borderColor: C.border, borderWidth: 1 },
  retryButtonText: { color: C.ink, fontFamily: F.bodySemi, fontSize: 12 },
  walletAlert: { width: "100%", backgroundColor: C.redSoft, borderColor: C.red, borderWidth: 1, borderRadius: 13, padding: 12, marginBottom: 16 },
  emptyState: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 12, padding: 18, marginTop: 8 },
  emptyTitle: { color: C.ink, fontFamily: F.heading, fontSize: 17, marginBottom: 6 },
  emptyAction: { minHeight: 48, justifyContent: "center", alignSelf: "flex-start", paddingRight: 12 },
  emptyActionText: { color: C.blue, fontFamily: F.bodySemi, fontSize: 13 },
  bottomBar: { minHeight: 72, backgroundColor: "rgba(11,15,20,0.96)", borderTopWidth: 1, borderTopColor: C.border, flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingBottom: 10, paddingHorizontal: 8 },
  tabButtonWrap: { flex: 1, minWidth: 0 },
  tabButton: { flex: 1, minWidth: 0, minHeight: 58, alignItems: "center", justifyContent: "center", borderRadius: 14, paddingHorizontal: 2 },
  tabButtonSelected: { borderTopWidth: 2, borderTopColor: C.mint, borderRadius: 0 },
  tabLabel: { color: C.quiet, fontFamily: F.bodyMedium, fontSize: 12, marginTop: 5 },
  tabLabelSelected: { color: C.green, fontFamily: F.bodySemi },
});
