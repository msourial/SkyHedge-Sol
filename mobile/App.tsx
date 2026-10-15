import "./src/polyfills";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { InterTight_600SemiBold, InterTight_700Bold } from "@expo-google-fonts/inter-tight";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AdvisoryResponse, AgriculturalMarket, ClaimReadiness, CityIndex, DevnetStatus, FinalizedWalletState, getJson, NotAvailableYetError, claimReadinessPath, Portfolio, postJson, ProtectionQuote, UnsignedTransaction } from "./src/api";
import { DEVNET_RPC_URL, readFinalizedWalletStateAnyRpc, readWalletStateWithFallback } from "./src/chain";
import { type HazardId } from "./src/hazards";
import { resolveSelectedNoaaCity } from "./src/presentation";
import { buildCommittedQuoteRequest, formatSkyt, getProtectionUnavailableReason, parseSkytAmount } from "./src/protection";
import { authorizeDevnetWallet, signAndConfirmDevnetTransaction, type AuthorizedWallet } from "./src/wallet";
import { C, F } from "./src/theme";
import { ActionButton, AppIcon, Text, type AppIconName } from "./src/ui";
import { friendlyError, isNetworkError, stationLabel } from "./src/friendly-errors";
import { ScreenTransition, TactilePressable } from "./src/liquid-glass";
import { GuidePanel, type GuideTurn } from "./src/GuidePanel";
import { marketIsLive, MarketsScreen, ProtectTicket, StickyCta, WalletV2 } from "./src/v2";
import { buyCta, coverageOptions, type CoverageOption } from "./src/ticket";
import { Landing, MarketDetail } from "./src/revamp";
import { CollectPayoutView, ReceiptView } from "./src/journey";
import { BrandMark } from "./src/BrandMark";
import { BlurTargetView } from "expo-blur";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { GlassTargetContext } from "./src/liquid-glass";
import { formatSkytFixed, shortAddress } from "./src/ticket";
import { marketByCode, type CatalogMarket } from "./src/markets-catalog";
import { LinearGradient } from "expo-linear-gradient";
import { APP_BUILD, APP_VERSION } from "./src/version";

type Tab = "weather" | "catalog" | "protect" | "wallet";
type AmountMode = "usd-preview" | "devnet-test";

/** MWA does not report the wallet's name without changing the auth flow, so copy stays generic. */
const WALLET_NAME = "Your wallet";

const CITY_ORDER = ["des-moines", "chicago", "new-york", "miami"];

export default function App() {
  const scrollRef = useRef<ScrollView>(null);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    InterTight_600SemiBold, InterTight_700Bold,
  });
  const [tab, setTab] = useState<Tab>("catalog");
  const [cities, setCities] = useState<CityIndex[]>([]);
  const [catalog, setCatalog] = useState<AgriculturalMarket[]>([]);
  const [status, setStatus] = useState<DevnetStatus | null>(null);
  const [selectedCity, setSelectedCity] = useState("des-moines");
  const [selectedHazard, setSelectedHazard] = useState<HazardId | null>("rainfall");
  const [city, setCity] = useState<CityIndex | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletSession, setWalletSession] = useState<AuthorizedWallet | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [walletBalances, setWalletBalances] = useState<FinalizedWalletState | null>(null);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [guideTurns, setGuideTurns] = useState<GuideTurn[]>([]);
  const [guideBusy, setGuideBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [homeLoading, setHomeLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountMode] = useState<AmountMode>("devnet-test");
  const [protectionAmount, setProtectionAmount] = useState("100");
  const [coverageId, setCoverageId] = useState<CoverageOption["id"]>("100");
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [indicativeQuote, setIndicativeQuote] = useState<ProtectionQuote | null>(null);
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1_000));
  const [guideOpen, setGuideOpen] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const glassTarget = useRef<View>(null);
  /** Hidden design-review mode (long-press the version line on Wallet). Shows sample values under a DEMO banner; never signs. */
  const [demoUnlocked, setDemoUnlocked] = useState(false);
  const [demo, setDemo] = useState<null | "collect" | "receipt">(null);
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
      <GlassTargetContext.Provider value={glassTarget}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}><BlurTargetView ref={glassTarget} style={StyleSheet.absoluteFill}>
        <LinearGradient colors={["#122033", C.canvas, C.canvas, "#121820"]} locations={[0, 0.35, 0.75, 1]} style={StyleSheet.absoluteFill} />
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <RadialGradient id="aB" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={C.rain} stopOpacity="0.16" /><Stop offset="1" stopColor={C.rain} stopOpacity="0" /></RadialGradient>
            <RadialGradient id="aA" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#F5B544" stopOpacity="0.10" /><Stop offset="1" stopColor="#F5B544" stopOpacity="0" /></RadialGradient>
            <RadialGradient id="aM" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#34D399" stopOpacity="0.07" /><Stop offset="1" stopColor="#34D399" stopOpacity="0" /></RadialGradient>
          </Defs>
          <Circle cx="85%" cy="6%" r="320" fill="url(#aB)" />
          <Circle cx="0%" cy="45%" r="260" fill="url(#aM)" />
          <Circle cx="100%" cy="88%" r="300" fill="url(#aA)" />
        </Svg>
      </BlurTargetView></View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.blue} />}
      >
        <ScreenTransition transitionKey={tab}>
        {error ? <ErrorBanner message={error} onRetry={() => { void retryData(); }} /> : null}
        {!showLanding && homeLoading && cities.length === 0 && catalog.length === 0 ? <View style={styles.loadingPanel}><ActivityIndicator color={C.blue} /><Text style={styles.emptyText}>Loading finalized weather, market catalog, and Devnet readiness…</Text></View> : null}
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
        {!showLanding && tab === "protect" && demo === "collect" ? (
          <CollectPayoutView demo observedMm={57.4} triggerMm={50} source="NOAA · Des Moines Intl Airport (sample)" windowLabel="sample window" amountLabel="100" walletLabel="demo wallet" onBack={() => setDemo(null)} />
        ) : null}
        {!showLanding && tab === "protect" && demo === "receipt" ? (
          <ReceiptView demo title="Payout settled (demo)" badge="SAMPLE" symbol="SKYT · DSM-RAIN" amount="+100.00" caption="▲ sample payout · coverage paid in full"
            rows={[{ k: "Observed", v: "57.4 mm" }, { k: "Trigger", v: "50.0 mm", tone: "gold" }, { k: "Delta", v: "▲ +7.4 mm", tone: "mint" }, { k: "Source", v: "NOAA · DSM Intl Airport" }, { k: "Tx", v: "demo — none", tone: "rain" }, { k: "Network", v: "SOLANA DEVNET", tone: "gold" }]}
            ticker={["DEMO", "+100 SKYT (sample)", "OBS 57.4 MM", "TRG 50.0 MM", "NOT A REAL TRANSACTION"]} signature={null}
            onClose={() => setDemo(null)} onAgain={() => setDemo(null)} onMarkets={() => { setDemo(null); setTab("catalog"); }} />
        ) : null}
        {!showLanding && tab === "protect" && !demo && claimReadiness?.state === "claimable" && claimReadiness.action === "claim_payout" ? (
          <CollectPayoutView
            observedMm={claimReadiness.observation ? Number(claimReadiness.observation.rainfallMmX100) / 100 : null}
            triggerMm={status?.desMoinesMarket.thresholdMmX100 && /^\d+$/.test(status.desMoinesMarket.thresholdMmX100) ? Number(status.desMoinesMarket.thresholdMmX100) / 100 : null}
            source={`NOAA · ${stationLabel(status?.noaaEvidence.package?.stationId)}`} windowLabel={null}
            amountLabel={claimReadiness.amount ? formatSkytFixed(claimReadiness.amount, 0) : null}
            walletLabel={wallet ? shortAddress(wallet) : null}
            onBack={() => setTab("catalog")} />
        ) : null}
        {!showLanding && tab === "protect" && !demo && !(claimReadiness?.state === "claimable" && claimReadiness.action === "claim_payout") ? (
          !status && (isNetworkError(error) || isNetworkError(walletError) || isNetworkError(portfolioError)) ? (
            <View style={styles.emptyState} accessibilityRole="alert">
              <AppIcon name="wifi-off" color={C.coral} size={22} />
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
            claimReadiness={claimReadiness}
            observationEnd={status?.desMoinesMarket.observationEnd ?? null}
            onBrowseMarkets={() => { setTab("catalog"); setDetailCode(null); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
            onConnect={() => { void connect(); }}
            onDisconnect={() => { setWallet(null); setWalletSession(null); setPortfolio(null); setWalletBalances(null); setPortfolioError(null); setWalletError(null); setClaimReadiness(null); setQuote(null); }}
          />
        ) : null}
        {!showLanding && tab === "wallet" ? (
          <View style={{ alignItems: "center", marginTop: 18 }}>
            <Pressable onLongPress={() => setDemoUnlocked((v) => !v)} delayLongPress={900} accessibilityLabel={`SkyHedge version ${APP_VERSION}, build ${APP_BUILD}, Solana Devnet`} style={{ alignItems: "center", gap: 8, minHeight: 48, justifyContent: "center" }}><BrandMark size={28} /><Text style={styles.versionText}>SkyHedge {APP_VERSION} ({APP_BUILD}) · Devnet</Text></Pressable>
            {demoUnlocked ? <View style={styles.demoPanel}>
              <Text style={styles.demoTitle}>DEMO · Preview states</Text>
              <Text style={styles.emptyText}>Design review only. Sample values, clearly labelled; nothing is signed or sent.</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <Pressable style={styles.demoBtn} onPress={() => { setDemo("collect"); setTab("protect"); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}><Text style={styles.demoBtnText}>Collect payout</Text></Pressable>
                <Pressable style={styles.demoBtn} onPress={() => { setDemo("receipt"); setTab("protect"); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}><Text style={styles.demoBtnText}>Receipt</Text></Pressable>
              </View>
            </View> : null}
          </View>
        ) : null}
        </ScreenTransition>
      </ScrollView>

      {!showLanding && tab === "protect" && demo === "collect" ? <StickyCta label="Collect payout to wallet" disabled hint="DEMO preview — disabled, nothing to sign" onPress={() => {}} /> : null}
      {!showLanding && tab === "protect" && !demo && status ? (() => {
        const claimable = claimReadiness?.state === "claimable" && claimReadiness.action;
        if (claimable) return <StickyCta label={claimReadiness.action === "claim_payout" ? "Collect payout to wallet" : "Claim refund in wallet"} busy={transactionBusy} onPress={() => { if (claimReadiness?.action) void submitApprovedAction(claimReadiness.action); }} />;
        if (!wallet) return <StickyCta label="Connect wallet to protect" busy={loading} onPress={() => { void connect(); }} />;
        const quoteReady = !!quote && quote.protectedAmount === amountBase;
        const cta = buyCta({ premiumBase: quoteReady ? quote!.premium : null, busy: quoteBusy, error: quoteError, blockedReason: protectionUnavailableReason ? friendlyError(protectionUnavailableReason) : null, paymentReason: quotePaymentReason ? "Not enough SKYT in this wallet for this premium." : null });
        return <StickyCta
          label={cta.label}
          hint={cta.hint}
          disabled={cta.disabled}
          busy={transactionBusy}
          onPress={() => { void submitApprovedAction("open_position"); }}
        />;
      })() : null}
      {showLanding ? null : <View style={styles.bottomBar} accessibilityRole="tablist" accessibilityLabel="Main navigation">
        <TabButton label="Markets" icon="map-pin" selected={tab === "catalog" || tab === "weather"} onPress={() => { setDemo(null); setTab("catalog"); setDetailCode(null); scrollRef.current?.scrollTo({ y: 0, animated: false }); }} />
        <TabButton label="Protect" icon="shield" selected={tab === "protect"} onPress={() => setTab("protect")} />
        <TabButton label="Wallet" icon="credit-card" selected={tab === "wallet"} onPress={() => { setDemo(null); setTab("wallet"); }} />
      </View>}
      </GlassTargetContext.Provider>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}


function TabButton({ label, icon, selected, onPress }: { label: string; icon: AppIconName; selected: boolean; onPress: () => void }) {
  return (
    <TactilePressable containerStyle={styles.tabButtonWrap} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} android_ripple={{ color: C.purpleSoft }} style={[styles.tabButton, selected && styles.tabButtonSelected]}>
      <AppIcon name={icon} color={selected ? C.green : C.quiet} size={21} />
      <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{label}</Text>
    </TactilePressable>
  );
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



const styles = StyleSheet.create({
  fontLoading: { flex: 1, backgroundColor: C.canvas, justifyContent: "center", alignItems: "center" },
  safe: { flex: 1, backgroundColor: C.canvas },
  versionText: { color: C.quiet, fontFamily: F.mono, fontSize: 12, padding: 10 },
  demoPanel: { width: "100%", borderWidth: 1, borderStyle: "dashed", borderColor: C.amber, borderRadius: 16, padding: 14, marginTop: 8 },
  demoTitle: { color: C.amber, fontFamily: F.mono, fontSize: 13, letterSpacing: 1.2, marginBottom: 4 },
  demoBtn: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: C.amber, alignItems: "center", justifyContent: "center" },
  demoBtnText: { color: C.amber, fontFamily: F.bodySemi, fontSize: 14 },
  scrollContent: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 18, paddingTop: 18, paddingBottom: 32 },
  loadingPanel: { minHeight: 110, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 12, padding: 18, marginBottom: 14 },
  emptyText: { color: C.muted, fontSize: 13, lineHeight: 20 },
  guideToggle: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, marginTop: 7 },
  guideToggleText: { flex: 1, color: C.blue, fontFamily: F.bodySemi, fontSize: 14 },
  errorBanner: { backgroundColor: C.redSoft, borderWidth: 1, borderColor: C.red, borderRadius: 15, padding: 14, marginBottom: 18 },
  errorTitle: { color: C.red, fontFamily: F.bodySemi, fontSize: 13 },
  errorBody: { color: C.ink, fontSize: 12, lineHeight: 18, marginTop: 4 },
  errorActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  retryButton: { minHeight: 48, justifyContent: "center", paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.surface, borderColor: C.border, borderWidth: 1 },
  retryButtonText: { color: C.ink, fontFamily: F.bodySemi, fontSize: 12 },
  emptyState: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 12, padding: 18, marginTop: 8 },
  emptyTitle: { color: C.ink, fontFamily: F.heading, fontSize: 17, marginBottom: 6 },
  bottomBar: { minHeight: 76, backgroundColor: "rgba(14,19,26,0.94)", borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: "0px -8px 24px rgba(0,0,0,0.45)", borderTopWidth: 1, borderTopColor: C.border, flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingBottom: 10, paddingHorizontal: 8 },
  tabButtonWrap: { flex: 1, minWidth: 0 },
  tabButton: { flex: 1, minWidth: 0, minHeight: 58, alignItems: "center", justifyContent: "center", borderRadius: 14, paddingHorizontal: 2 },
  tabButtonSelected: { backgroundColor: C.rain + "1F", borderWidth: 1, borderColor: C.rain + "59", borderRadius: 16, boxShadow: `0px 0px 16px ${C.rain}4D` },
  tabLabel: { color: C.quiet, fontFamily: F.bodyMedium, fontSize: 12, marginTop: 5 },
  tabLabelSelected: { color: C.green, fontFamily: F.bodySemi },
});
