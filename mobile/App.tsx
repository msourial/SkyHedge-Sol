import "./src/polyfills";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from "@expo-google-fonts/barlow-condensed";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";
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
import { AdvisoryResponse, AgriculturalMarket, ApiError, ClaimReadiness, CityIndex, DevnetStatus, FinalizedWalletState, getJson, NotAvailableYetError, claimReadinessPath, Portfolio, postJson, ProtectionQuote, UnsignedTransaction } from "./src/api";
import { DEVNET_RPC_URL, readFinalizedWalletStateAnyRpc, readWalletStateWithFallback } from "./src/chain";
import { readFinalizedProtections } from "./src/positions";
import { buyPhaseLabel, TransactionFailedError, transactionFailure, type BuyPhase } from "./src/buy-phase";
import { type HazardId } from "./src/hazards";
import { resolveSelectedNoaaCity } from "./src/presentation";
import { committedPremiumQuote } from "../shared/market-pricing.ts";
import { buildCommittedQuoteRequest, duplicatePositionReason, formatSkyt, getProtectionUnavailableReason, parseSkytAmount } from "./src/protection";
import { handleConfirmApprove } from "./src/confirm-buy";
import { buildOpenPositionOnDevice } from "./src/open-position-tx";
import { loadDevnetStatus, readDevnetStatusOnDevice } from "./src/chain-status";
import { prepareUnsignedTransaction } from "./src/prepare-tx";
import { authorizeDevnetWallet, signAndConfirmDevnetTransaction, type AuthorizedWallet } from "./src/wallet";
import { clearWalletSession, loadWalletSession, saveWalletSession } from "./src/wallet-session-store";
import { consumerCityBySlug, consumerCityName } from "../shared/consumer-cities.ts";
import { C, F, glass, MIN_TOUCH, space as S, type as T } from "./src/theme";
import { ActionButton, AppIcon, Text, type AppIconName } from "./src/ui";
import { friendlyError, isNetworkError, stationLabel } from "./src/friendly-errors";
import { ScreenTransition, TactilePressable } from "./src/liquid-glass";
import { GuidePanel, type GuideTurn } from "./src/GuidePanel";
import { ConfirmCover, MarketsScreen, ProtectTicket, StickyCta, WalletV2 } from "./src/v2";
import { liveMarketLabel, protectCityFor, sellingWindows, windowsForCity, type Tenor } from "./src/windows";
import { committedWindowLabel, expiryChipLabel, matchingWindowPackage, sortByExpiry, type WindowEvidencePackage } from "../shared/window-chain.ts";
import { confirmSentence, payGet, protectCta } from "../shared/pay-get.ts";
import { buyCtaVisible, nextWeeklyOpenCopy, openCityPrompt, protectSurface } from "../shared/protect-surface.ts";
import { buyCta, coverageOptions, type CoverageOption } from "./src/ticket";
import { Landing, MarketDetail } from "./src/revamp";
import { CollectPayoutView, ReceiptView } from "./src/journey";
import { BrandMark } from "./src/BrandMark";
import { BlurTargetView } from "expo-blur";
import { GlassTargetContext } from "./src/liquid-glass";
import { formatSkytFixed, shortAddress } from "./src/ticket";
import { consumerCityByCode } from "../shared/consumer-cities.ts";
import { marketByCode, type CatalogMarket } from "./src/markets-catalog";
import { LinearGradient } from "expo-linear-gradient";
import { APP_BUILD, APP_VERSION } from "./src/version";

type Tab = "weather" | "catalog" | "protect" | "wallet";
type AmountMode = "usd-preview" | "devnet-test";

/** MWA does not report the wallet's name without changing the auth flow, so copy stays generic. */
const WALLET_NAME = "Your wallet";

const CITY_ORDER = ["new-york", "chicago", "miami", "dallas", "los-angeles", "seattle", "boston", "austin", "des-moines"];

export default function App() {
  const scrollRef = useRef<ScrollView>(null);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, IBMPlexMono_500Medium,
  });
  const [tab, setTab] = useState<Tab>("catalog");
  const [coverConfirm, setCoverConfirm] = useState<{ sentence: string; station: string; expiry: string; windowLabel: string; pay: string; getLabel: string; market: string; amount: string } | null>(null);
  const [showGuide, setShowGuide] = useState(true);
  const [cities, setCities] = useState<CityIndex[]>([]);
  const [catalog, setCatalog] = useState<AgriculturalMarket[]>([]);
  const [status, setStatus] = useState<DevnetStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState("new-york");
  const [selectedHazard, setSelectedHazard] = useState<HazardId | null>("rainfall");
  const [city, setCity] = useState<CityIndex | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletSession, setWalletSession] = useState<AuthorizedWallet | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [walletBalances, setWalletBalances] = useState<FinalizedWalletState | null>(null);
  const [balancesError, setBalancesError] = useState<string | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
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
  const [tenor, setTenor] = useState<Tenor>("weekly");
  const [selectedWindow, setSelectedWindow] = useState<string | null>(null);
  const [windowEvidence, setWindowEvidence] = useState<WindowEvidencePackage[] | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(true);
  const [evidenceError, setEvidenceError] = useState(false);
  const [evidenceNonce, setEvidenceNonce] = useState(0);
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
  const [transactionMessage, setTransactionMessage] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [transactionDetail, setTransactionDetail] = useState<string | null>(null);
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);
  const [buyPhase, setBuyPhase] = useState<BuyPhase | null>(null);

  const loadHome = useCallback(async () => {
    setHomeLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      getJson<{ cities: CityIndex[] }>("/api/mobile?resource=cities"),
      getJson<{ markets: AgriculturalMarket[] }>("/api/mobile?resource=agricultural-markets"),
      loadDevnetStatus({ onDevice: readDevnetStatusOnDevice, server: () => getJson<DevnetStatus>("/api/devnet/status") }),
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
    if (statusResult.status === "fulfilled") {
      setStatus(statusResult.value);
      setStatusError(null);
    } else {
      setStatusError(statusResult.reason instanceof Error ? statusResult.reason.message : "Couldn't load prices");
    }
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
    setBalancesLoading(true);
    setBalancesError(null);
    try {
      const [balanceResult, portfolioResult] = await Promise.allSettled([
        readWalletStateWithFallback(address, { timeoutMs: 20_000, direct: (a) => readFinalizedWalletStateAnyRpc(a, { force }), server: (a) => getJson<FinalizedWalletState>(`/api/mobile?resource=wallet-balances&wallet=${encodeURIComponent(a)}`) }),
        readFinalizedProtections(address).then((protections) => ({
          wallet: address,
          source: "finalized-solana-rpc" as const,
          indexed: true,
          protections,
          liquidity: [],
        })),
      ]);
      if (balanceResult.status === "fulfilled") {
        setWalletBalances(balanceResult.value);
        setBalancesError(null);
      } else {
        setWalletBalances(null);
        setBalancesError(balanceResult.reason instanceof Error ? balanceResult.reason.message : "Couldn’t read balances from Solana.");
      }
      setPortfolio(portfolioResult.status === "fulfilled" ? portfolioResult.value : null);
      setPortfolioError(portfolioResult.status === "rejected"
        ? portfolioResult.reason instanceof Error ? portfolioResult.reason.message : "Couldn’t read protections from Solana."
        : null);
    } finally {
      setBalancesLoading(false);
    }
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
    setEvidenceNonce((nonce) => nonce + 1);
    try {
      await loadHome();
      if (wallet) await loadWalletData(wallet);
    } finally {
      setRefreshing(false);
    }
  }, [loadHome, loadWalletData, wallet]);

  useEffect(() => {
    let cancelled = false;
    loadWalletSession().then((session) => {
      if (cancelled || !session) return;
      setWalletSession(session);
      setWallet(session.address);
      setShowLanding(false);
      void loadWalletData(session.address);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [loadWalletData]);

  const connect = useCallback(async () => {
    setLoading(true);
    setWalletError(null);
    try {
      const session = await authorizeDevnetWallet();
      setWalletSession(session);
      setWallet(session.address);
      await saveWalletSession(session);
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
    setSelectedWindow(null);
    setSelectedHazard(slug === "toronto" ? null : "rainfall");
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
  const selling = sellingWindows(status, nowSeconds);
  const nycWindows = windowsForCity(selling, "new-york");
  const protectCity = protectCityFor(selectedCity, selling);
  const openWindows = sortByExpiry(windowsForCity(selling, protectCity));
  const activeWindow = openWindows.find((window) => window.address === selectedWindow) ?? openWindows[0] ?? null;
  const protectView = protectSurface({
    loading: (homeLoading && !status) || (openWindows.length > 0 && evidenceLoading),
    failed: (!!statusError && !status) || (openWindows.length > 0 && evidenceError),
    openWindowCount: openWindows.length,
  });
  const nextOpenCopy = nextWeeklyOpenCopy(protectCity, nowSeconds);
  const openCity = openCityPrompt(selling, protectCity);
  const activePackage = matchingWindowPackage(windowEvidence, protectCity, activeWindow?.observationStart, activeWindow?.observationEnd);
  useEffect(() => {
    let cancelled = false;
    setEvidenceLoading(true);
    getJson<{ packages: WindowEvidencePackage[] }>(`/api/devnet/status?resource=window-evidence&city=${encodeURIComponent(protectCity)}`)
      .then((value) => { if (!cancelled) { setWindowEvidence(value.packages ?? []); setEvidenceError(false); } })
      .catch(() => { if (!cancelled) { setWindowEvidence([]); setEvidenceError(true); } })
      .finally(() => { if (!cancelled) setEvidenceLoading(false); });
    return () => { cancelled = true; };
  }, [protectCity, evidenceNonce]);
  // Price from the open market's NOAA terms even before wallet connect; purchase still requires a wallet.
  const quoteUnavailableReason = selectedHazard !== "rainfall"
    ? "Choose a place and its rainfall risk in Explore. Wind gust and snowfall remain research-only."
    : evidenceLoading
      ? null
      : getProtectionUnavailableReason({ status, citySlug: protectCity, walletConnected: true, walletSkytBalanceBase: walletBalances?.skytBaseUnits ?? null, amountBase, market: activeWindow, windowEvidence });
  const baseProtectionReason = evidenceLoading ? null : getProtectionUnavailableReason({ status, citySlug: protectCity, walletConnected: !!wallet, walletSkytBalanceBase: walletBalances?.skytBaseUnits ?? null, amountBase, market: activeWindow, windowEvidence });
  const positionGateReason = !wallet ? null
    : claimError ? "The current on-chain position could not be verified; refresh before requesting another position."
      : !claimReadiness ? "Checking the finalized wallet position before allowing another position."
        : duplicatePositionReason(consumerCityName(protectCity), claimReadiness.state);
  const protectionUnavailableReason = selectedHazard !== "rainfall"
    ? "Choose a place and its rainfall risk in Explore. Wind gust and snowfall remain research-only."
    : baseProtectionReason ?? positionGateReason;
  const quotePaymentReason = quote && walletBalances && BigInt(quote.premium) > BigInt(walletBalances.skytBaseUnits)
    ? `Your finalized wallet balance is ${formatSkyt(walletBalances.skytBaseUnits)} SKYT; the premium is ${formatSkyt(quote.premium)} SKYT.`
    : null;

  const requestProtectionQuote = async () => {
    const id = ++quoteRequestId.current;
    setQuoteError(null);
    if (quoteUnavailableReason || !status || !amountBase || !activeWindow) {
      setQuote(null);
      return;
    }
    const request = buildCommittedQuoteRequest(status, amountBase, activeWindow, protectCity);
    if (!request) {
      setQuote(null);
      setQuoteError("This window's terms aren't finalized yet, so it can't be priced.");
      return;
    }
    const committed = committedPremiumQuote({
      protectedAmount: amountBase,
      probabilityBps: activeWindow.quoteProbabilityBps,
      premiumRateBps: activeWindow.premiumRateBps,
      inputsHash: activeWindow.quoteInputsHash,
    });
    const committedQuote: ProtectionQuote | null = committed
      ? { ...committed, source: "NOAA", explicitApprovalRequired: true }
      : null;
    if (committedQuote) setQuote(committedQuote);
    else setQuote(null);
    setQuoteBusy(committedQuote == null);
    try {
      const result = await postJson<ProtectionQuote>("/api/quotes", request, { timeoutMs: 12_000, attempts: 2 });
      if (id !== quoteRequestId.current) return;
      if (result.protectedAmount !== amountBase || result.source !== "NOAA" || result.explicitApprovalRequired !== true) {
        throw new Error("The price didn't match the selected coverage. Get a new price.");
      }
      if (activeWindow.quoteInputsHash && result.inputsHash.toLowerCase() !== activeWindow.quoteInputsHash.toLowerCase()) {
        throw new Error("The price didn't match this window's committed terms. Get a new price.");
      }
      setQuote(result);
      setQuoteError(null);
    } catch (reason) {
      if (id !== quoteRequestId.current) return;
      const message = reason instanceof Error ? reason.message : "The NOAA-backed price is unavailable.";
      const mismatch = /committed terms|didn't match the selected coverage/.test(message);
      if (mismatch) setQuote(null);
      if (mismatch || !committedQuote) setQuoteError(message);
    } finally {
      if (id === quoteRequestId.current) setQuoteBusy(false);
    }
  };

  // Re-price automatically whenever coverage changes or the market becomes quotable.
  useEffect(() => {
    if (tab !== "protect" || evidenceLoading || !activePackage || quoteUnavailableReason || !amountBase) { quoteRequestId.current++; setQuoteBusy(false); return; }
    void requestProtectionQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, amountBase, quoteUnavailableReason, evidenceLoading, activePackage?.observationStart, activeWindow?.address, activeWindow?.quoteInputsHash]);

  // Indicative "From X SKYT per 100" for the Markets hero: a real NOAA quote for 100 SKYT, no wallet needed.
  useEffect(() => {
    const indicativeWindow = windowsForCity(selling, "des-moines")[0] ?? null;
    if (!status || !indicativeWindow) { setIndicativeQuote(null); return; }
    const reason = getProtectionUnavailableReason({ status, citySlug: "des-moines", walletConnected: true, walletSkytBalanceBase: "0", amountBase: "100000000", market: indicativeWindow });
    const request = reason ? null : buildCommittedQuoteRequest(status, "100000000", indicativeWindow, "des-moines");
    if (!request) { setIndicativeQuote(null); return; }
    let cancelled = false;
    postJson<ProtectionQuote>("/api/quotes", request)
      .then((value) => { if (!cancelled && value.protectedAmount === "100000000" && value.source === "NOAA") setIndicativeQuote(value); })
      .catch(() => { if (!cancelled) setIndicativeQuote(null); });
    return () => { cancelled = true; };
  }, [selling.find((window) => window.city === "des-moines")?.address, selling.find((window) => window.city === "des-moines")?.quoteInputsHash, status]);

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

  const submitApprovedAction = async (action: "open_position" | "claim_payout" | "claim_premium_refund", marketAddress?: string, amountOverride?: string) => {
    setTransactionError(null);
    setTransactionDetail(null);
    setBuyPhase("preparing");
    setTransactionMessage(buyPhaseLabel("preparing"));
    setTransactionSignature(null);
    try {
      const market = marketAddress ?? activeWindow?.address;
      const amount = amountOverride ?? amountBase;
      if (!walletSession || !wallet || !market) throw new Error("Connect the wallet and refresh finalized market status before continuing.");
      if (action === "open_position" && quote?.inputsHash && activeWindow?.quoteInputsHash && quote.inputsHash.toLowerCase() !== activeWindow.quoteInputsHash.toLowerCase()) {
        void requestProtectionQuote();
        throw new Error("The price changed for this window. Review the new price, then approve again.");
      }
      if (action === "open_position" && (amountMode !== "devnet-test" || protectionUnavailableReason || !quote || !amount || quotePaymentReason)) throw new Error(protectionUnavailableReason ?? quotePaymentReason ?? "Enter Devnet test mode and request a valid SKYT quote before approving a protection position.");
      if (action.startsWith("claim_") && (claimReadiness?.state !== "claimable" || claimReadiness.action !== action)) throw new Error("The finalized claim-readiness API does not currently allow this claim.");
      const unsigned = await prepareUnsignedTransaction({
        action, market, wallet, amount: amount ?? "",
        onDevice: (input) => buildOpenPositionOnDevice(input),
        server: () => postJson<UnsignedTransaction>("/api/transactions/unsigned", {
          action, market, wallet, ...(action === "open_position" ? { amount } : {}), approved: true,
        }, { attempts: 2, timeoutMs: 20_000 }),
      });
      if (unsigned.network !== "devnet" || unsigned.market !== market || unsigned.wallet !== wallet) throw new Error("The prepared transaction does not match this wallet, market, or Devnet.");
      const signature = await signAndConfirmDevnetTransaction({
        transactionBase64: unsigned.base64,
        wallet: walletSession,
        rpcUrl: DEVNET_RPC_URL,
        onPhase: (phase) => {
          setBuyPhase(phase);
          setTransactionMessage(buyPhaseLabel(phase));
        },
      });
      setTransactionSignature(signature);
      setBuyPhase("confirmed");
      setTransactionMessage(buyPhaseLabel("confirmed"));
      setQuote(null);
      try {
        await loadHome();
        await loadWalletData(wallet, true);
        if (activeWindow.address) {
          const readiness = await getJson<ClaimReadiness>(claimReadinessPath(activeWindow.address, wallet));
          setClaimReadiness(readiness);
        }
      } catch {
        // The transaction is already confirmed. A later Wallet refresh can retry the read.
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "The transaction did not complete.";
      const shown = transactionFailure(message, reason instanceof ApiError ? reason.detail : null);
      if (/just closed|price changed|committed terms/i.test(shown.message)) void requestProtectionQuote();
      if (reason instanceof TransactionFailedError && reason.signature) setTransactionSignature(reason.signature);
      setBuyPhase("failed");
      setTransactionMessage(buyPhaseLabel("failed"));
      setTransactionError(shown.message);
      setTransactionDetail(shown.detail);
    }
  };

  useEffect(() => {
    if (!wallet || !activeWindow?.address) {
      setClaimReadiness(null);
      setClaimError(null);
      return;
    }
    let cancelled = false;
    getJson<ClaimReadiness>(claimReadinessPath(activeWindow.address, wallet))
      .then((value) => { if (!cancelled) { setClaimReadiness(value); setClaimError(null); } })
      .catch((reason) => { if (!cancelled) setClaimError(reason instanceof NotAvailableYetError ? "Position status is not available yet." : reason instanceof Error ? reason.message : "Claim status is unavailable."); });
    return () => { cancelled = true; };
  }, [wallet, activeWindow?.address]);

  if (!fontsLoaded && !fontError) return <SafeAreaProvider><SafeAreaView style={styles.fontLoading}><StatusBar barStyle="light-content" backgroundColor={C.canvas} /><ActivityIndicator color={C.green} /></SafeAreaView></SafeAreaProvider>;

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.canvas} translucent={false} />
      <GlassTargetContext.Provider value={glassTarget}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}><BlurTargetView ref={glassTarget} style={StyleSheet.absoluteFill}>
        <LinearGradient colors={["#122033", C.canvas, C.canvas, "#121820"]} locations={[0, 0.35, 0.75, 1]} style={StyleSheet.absoluteFill} />
      </BlurTargetView></View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.rain} />}
      >
        <ScreenTransition transitionKey={tab}>
        {error ? <ErrorBanner message={error} onRetry={() => { void retryData(); }} /> : null}
        {!showLanding && homeLoading && cities.length === 0 && catalog.length === 0 ? <View style={styles.loadingPanel} accessibilityLabel="Loading"><ActivityIndicator color={C.rain} /><Text style={styles.emptyText}>Loading finalized weather, market catalog, and Devnet readiness…</Text></View> : null}
        {showLanding ? (
          <Landing live={nycWindows.length > 0} openLabel={nycWindows.length > 0 ? liveMarketLabel(nycWindows) : undefined} busy={loading} onBrowse={() => setShowLanding(false)} onConnect={() => { void connect().then(() => setShowLanding(false)); }} />
        ) : null}
        {!showLanding && tab === "catalog" && detailCode && marketByCode(detailCode) ? (
          <MarketDetail
            market={marketByCode(detailCode)!}
            notified={notifyCodes.has(detailCode)}
            onNotify={() => setNotifyCodes((prev) => { const next = new Set(prev); if (next.has(detailCode)) next.delete(detailCode); else next.add(detailCode); return next; })}
            onBack={() => setDetailCode(null)}
            onExploreLive={() => { setDetailCode(null); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
          />
        ) : null}
        {!showLanding && tab === "catalog" && !detailCode ? (
          <MarketsScreen
            onOpenMarket={(m: CatalogMarket) => { setDetailCode(m.code); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
            status={status}
            city={city}
            indicativeQuote={indicativeQuote}
            nowSeconds={nowSeconds}
            showGuide={showGuide}
            onProtect={(code) => { const slug = consumerCityByCode(code)?.slug; if (!slug) return; setShowGuide(false); changeCity(slug); setSelectedHazard("rainfall"); setTab("protect"); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
            guide={<>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: guideOpen }} accessibilityLabel="Describe your plans and let the guide find a market" onPress={() => setGuideOpen((open) => !open)} style={styles.guideToggle}><AppIcon name="message-circle" color={C.rain} size={20} /><Text style={styles.guideToggleText}>Describe your plans instead</Text><AppIcon name={guideOpen ? "chevron-up" : "chevron-down"} color={C.muted} size={18} /></Pressable>
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
            triggerMm={activeWindow?.thresholdMmX100 && /^\d+$/.test(activeWindow.thresholdMmX100) ? Number(activeWindow.thresholdMmX100) / 100 : null}
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
              transactionDetail={transactionDetail}
              transactionSignature={transactionSignature}
              buyPhase={buyPhase}
              onViewWallet={() => { setTab("wallet"); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
              onRetryBuy={() => { void submitApprovedAction("open_position"); }}
              walletName={WALLET_NAME}
              onRefresh={() => { void refresh(); }}
              observedMm={city?.slug === "des-moines" ? city.cumulativeMm : null}
              onProtectAgain={() => { setTransactionSignature(null); setTransactionMessage(null); setTransactionError(null); setBuyPhase(null); scrollRef.current?.scrollTo({ y: 0, animated: true }); }}
              onBackToMarkets={() => { setTransactionSignature(null); setTab("catalog"); setDetailCode(null); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
              tenor={tenor}
              onTenor={(next) => { setTenor(next); setSelectedWindow(null); setQuote(null); }}
              windows={openWindows}
              city={protectCity}
              selectedAddress={activeWindow?.address ?? null}
              onSelectWindow={(address) => { setSelectedWindow(address); setQuote(null); }}
              windowEvidence={windowEvidence}
              evidenceLoading={evidenceLoading}
              cities={CITY_ORDER.map((slug) => ({ slug, label: consumerCityBySlug(slug)?.city ?? slug }))}
              onCity={changeCity}
              surface={protectView}
              nextOpenCopy={nextOpenCopy}
              openCity={openCity}
            />
          )
        ) : null}
        {!showLanding && tab === "wallet" ? (
          <WalletV2
            wallet={wallet}
            walletName={WALLET_NAME}
            balances={walletBalances}
            balancesError={balancesError}
            balancesLoading={balancesLoading}
            portfolio={portfolio}
            portfolioError={portfolioError}
            walletError={walletError}
            loading={loading}
            marketAddress={status?.desMoinesMarket.address ?? null}
            windows={selling}
            claimReadiness={claimReadiness}
            observationEnd={activeWindow?.observationEnd ?? null}
            onBrowseMarkets={() => { setTab("protect"); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
            onConnect={() => { void connect(); }}
            onRetryBalances={() => { if (wallet) void loadWalletData(wallet, true); }}
            onDisconnect={() => { void clearWalletSession(); setWallet(null); setWalletSession(null); setPortfolio(null); setWalletBalances(null); setBalancesError(null); setBalancesLoading(false); setPortfolioError(null); setWalletError(null); setClaimReadiness(null); setQuote(null); }}
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
      {!showLanding && tab === "protect" && !demo && buyCtaVisible(protectView, !!activePackage) ? (() => {
        if (!status) return null;
        const claimable = claimReadiness?.state === "claimable" && claimReadiness.action;
        if (claimable) return <StickyCta label={claimReadiness.action === "claim_payout" ? "Collect payout to wallet" : "Claim refund in wallet"} busy={buyPhase === "preparing" || buyPhase === "waiting" || buyPhase === "sending"} busyLabel={buyPhase ? buyPhaseLabel(buyPhase) : undefined} onPress={() => { if (claimReadiness?.action) void submitApprovedAction(claimReadiness.action); }} />;
        if (!wallet) return <StickyCta label="Connect wallet" busy={loading} onPress={() => { void connect(); }} />;
        const quoteReady = !!quote && quote.protectedAmount === amountBase;
        const cta = buyCta({ premiumBase: quoteReady ? quote!.premium : null, busy: quoteBusy, error: quoteError, blockedReason: protectionUnavailableReason ? friendlyError(protectionUnavailableReason) : null, paymentReason: quotePaymentReason ? "Not enough SKYT in this wallet for this premium." : null });
        const threshold = activeWindow?.thresholdMmX100 && /^\d+$/.test(activeWindow.thresholdMmX100) ? Number(activeWindow.thresholdMmX100) / 100 : null;
        const deal = quoteReady && quote?.premiumRateBps && quote.probabilityBps && amountBase
          ? payGet({ coverageSkyt: Number(BigInt(amountBase) / 1_000_000n), premiumRateBps: quote.premiumRateBps, probabilityBps: quote.probabilityBps })
          : null;
        const dealLabel = protectCta({ connected: !!wallet, quote: deal, thresholdMm: threshold });
        if (!deal && cta.disabled && !quoteBusy) return null;
        const windowLabel = activeWindow ? committedWindowLabel(activeWindow) : null;
        const expiry = windowLabel?.split(" – ")[1] ?? (activeWindow ? expiryChipLabel(activeWindow)?.split(" · ")[0] ?? "expiry" : "expiry");
        const station = consumerCityBySlug(protectCity)?.source ?? "NOAA station";
        const buying = buyPhase === "preparing" || buyPhase === "waiting" || buyPhase === "sending";
        return <StickyCta
          label={buyPhase === "failed" ? "Retry" : deal ? dealLabel : cta.label}
          hint={deal ? null : cta.hint}
          disabled={buying ? true : deal ? false : cta.disabled}
          busy={buying}
          busyLabel={buying && buyPhase ? buyPhaseLabel(buyPhase) : undefined}
          pay={deal?.payLabel ?? null}
          getLabel={deal?.getLabel ?? null}
          payBase={deal?.payBase ?? null}
          getBase={deal?.getBase ?? null}
          onPress={() => {
            if (buyPhase === "failed") { void submitApprovedAction("open_position"); return; }
            if (!deal || threshold == null || !activeWindow || !amountBase || !windowLabel) return;
            setCoverConfirm({
              sentence: confirmSentence({ thresholdMm: threshold, station, expiry, getLabel: deal.getLabel }),
              station,
              expiry,
              windowLabel,
              pay: deal.payLabel,
              getLabel: deal.getLabel,
              market: activeWindow.address,
              amount: amountBase,
            });
          }}
        />;
      })() : null}
      {coverConfirm ? <ConfirmCover {...coverConfirm} onClose={() => setCoverConfirm(null)} onApprove={() => {
        const pending = coverConfirm;
        handleConfirmApprove({ close: () => setCoverConfirm(null), signOpenPosition: () => { void submitApprovedAction("open_position", pending.market, pending.amount); } });
      }} /> : null}
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
    <TactilePressable containerStyle={styles.tabButtonWrap} accessibilityRole="tab" accessibilityLabel={`${label} tab`} accessibilityState={{ selected }} onPress={onPress} android_ripple={{ color: C.rainSoft }} style={[styles.tabButton, selected && styles.tabButtonSelected]}>
      <AppIcon name={icon} color={selected ? C.rain : C.quiet} size={21} />
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
      <AppIcon name="alert-circle" color={C.coral} size={18} />
      <View style={{ flex: 1, gap: S.xs }}>
        <Text style={styles.errorTitle}>{evidenceMissing ? "NOAA evidence unavailable" : mobileRoutesMissing ? "Mobile API needs an update" : "Can’t reach SkyHedge"}</Text>
        <Text style={styles.errorBody}>{friendlyError(readableMessage)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Try again" onPress={onRetry} style={styles.retryButton}><Text style={styles.retryButtonText}>Try again</Text></Pressable>
      </View>
    </View>
  );
}



const styles = StyleSheet.create({
  fontLoading: { flex: 1, backgroundColor: C.canvas, justifyContent: "center", alignItems: "center" },
  safe: { flex: 1, backgroundColor: C.canvas },
  versionText: { color: C.quiet, fontFamily: F.mono, fontSize: 12, padding: 10 },
  demoPanel: { width: "100%", borderWidth: 1, borderStyle: "dashed", borderColor: C.amber, backgroundColor: C.amberSoft, borderRadius: glass.radius - 8, padding: S.md, marginTop: S.sm },
  demoTitle: { color: C.amber, fontFamily: F.mono, fontSize: 13, letterSpacing: 1.2, marginBottom: 4 },
  demoBtn: { flex: 1, minHeight: MIN_TOUCH, borderRadius: 14, borderWidth: 1, borderColor: C.amber, alignItems: "center", justifyContent: "center" },
  demoBtnText: { color: C.amber, fontFamily: F.bodySemi, fontSize: 14 },
  scroll: { flex: 1 },
  scrollContent: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 18, paddingTop: 18, paddingBottom: 76 + 34 },
  loadingPanel: { minHeight: 110, alignItems: "center", justifyContent: "center", gap: S.md - 2, backgroundColor: glass.fill, borderColor: glass.border, borderWidth: 1, borderRadius: glass.radius, padding: S.lg, marginBottom: S.md, boxShadow: glass.shadow },
  emptyText: { ...T.caption, color: C.muted, fontSize: 13, lineHeight: 20 },
  guideToggle: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: glass.border, marginTop: S.xs },
  guideToggleText: { flex: 1, color: C.rain, fontFamily: F.bodySemi, fontSize: 14 },
  errorBanner: { flexDirection: "row", alignItems: "flex-start", gap: S.md, backgroundColor: C.redSoft, borderWidth: 1, borderColor: C.coral, borderRadius: glass.radius - 10, padding: S.lg, marginBottom: S.lg },
  errorTitle: { ...T.bodyStrong, color: C.coral, fontSize: 14, lineHeight: 20 },
  errorBody: { ...T.caption, color: C.ink, fontSize: 13, lineHeight: 18 },
  retryButton: { minHeight: MIN_TOUCH, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: S.md, borderRadius: 12, backgroundColor: C.surfaceRaised, borderColor: glass.border, borderWidth: 1 },
  retryButtonText: { ...T.label, color: C.ink },
  emptyState: { backgroundColor: glass.fill, borderColor: glass.border, borderWidth: 1, borderRadius: glass.radius, padding: S.lg, marginTop: S.sm, boxShadow: glass.shadow },
  emptyTitle: { ...T.heading, color: C.ink, marginBottom: S.xs },
  bottomBar: { minHeight: 76, backgroundColor: C.canvas + "F0", borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: "0px -8px 24px rgba(0,0,0,0.45)", borderTopWidth: 1, borderTopColor: glass.border, flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingBottom: 10, paddingHorizontal: S.sm },
  tabButtonWrap: { flex: 1, minWidth: 0 },
  tabButton: { flex: 1, minWidth: 0, minHeight: 58, alignItems: "center", justifyContent: "center", borderRadius: 14, paddingHorizontal: 2 },
  tabButtonSelected: { backgroundColor: C.surfaceRaised, borderWidth: 1, borderColor: C.border, borderRadius: 16 },
  tabLabel: { ...T.caption, color: C.quiet, fontFamily: F.bodyMedium, marginTop: 5 },
  tabLabelSelected: { color: C.rain, fontFamily: F.bodySemi },
});
