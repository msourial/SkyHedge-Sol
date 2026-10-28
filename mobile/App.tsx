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
import { initialWindowMetrics, SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AdvisoryResponse, AgriculturalMarket, ApiError, ClaimReadiness, CityIndex, DevnetStatus, FinalizedWalletState, getJson, NotAvailableYetError, claimReadinessPath, Portfolio, postJson, ProtectionQuote, UnsignedTransaction } from "./src/api";
import { DEVNET_RPC_URL, readFinalizedWalletStateAnyRpc, readWalletStateWithFallback } from "./src/chain";
import { SKYHEDGE_PROGRAM_ID, readFinalizedProtections, type ChainProtection } from "./src/positions";
import { findPositionAfterBuy, isExistingPositionError, isWalletDecline, positionForWindow } from "./src/covered";
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
import { ActionButton, AppIcon, Text } from "./src/ui";
import { friendlyError, isNetworkError, stationLabel } from "./src/friendly-errors";
import { ScreenTransition, TactilePressable } from "./src/liquid-glass";
import { GuidePanel, type GuideTurn } from "./src/GuidePanel";
import { ConfirmCover, MarketsScreen, StickyCta, WalletV2 } from "./src/v2";
import { liveMarketLabel, protectCityFor, sellingWindows, windowsForCity, type Tenor } from "./src/windows";
import { committedWindowLabel, expiryChipLabel, matchingWindowPackage, sortByExpiry, type WindowEvidencePackage } from "../shared/window-chain.ts";
import { payGet } from "../shared/pay-get.ts";
import { coverBaseUnits, coverExceedsBalance, formatQuoteSkyt, notEnoughSkyt, protectButtonLabel, stakeSheetForCover, stationDisplayName, type CoverChip } from "../shared/protect-copy.ts";
import { showCityStep } from "./src/consumer-flow";
import { coverageOptions, type CoverageOption } from "./src/ticket";
import { TechnicalContext } from "./src/line/TechnicalContext";
import { MarketsLine, WalletLine, LandingLine } from "./src/line/Discovery";
import { useDiscovery, useReceipts } from "./src/line/use-discovery";
import { formatBaseGrouped } from "../shared/ui-money.ts";
import { marketModels } from "../shared/ui-discovery.ts";
import { scrollBottomPadding } from "../shared/ui-view.ts";
import { firstOpenPair } from "../shared/peril-registry.ts";
import { upcomingWindow } from "../shared/ui-ladder.ts";
import type { MarketSelection } from "../shared/ui-discovery.ts";
import { Landing, MarketDetail } from "./src/revamp";
import { CollectPayoutView, ReceiptView } from "./src/journey";
import { BrandMark } from "./src/BrandMark";
import { BlurTargetView } from "expo-blur";
import { GlassTargetContext } from "./src/liquid-glass";
import { formatSkytFixed, shortAddress } from "./src/ticket";
import { consumerCityByCode } from "../shared/consumer-cities.ts";
import { marketByCode, type CatalogMarket } from "./src/markets-catalog";
import { lineTokens } from "../shared/ui-tokens.ts";
import { LinePay, ProtectBody, TabGlyph } from "./src/line/ProtectLine";
import { useLineProtect } from "./src/line/use-line";
import { SignSheet, type SignReview } from "./src/line/SignSheet";
import { signFailure, signStepForPhase, submitLineOpenPosition } from "./src/line-submit";
import type { SignOutcome, SignStep } from "../shared/ui-sign.ts";
import { ScrollEdgeFade } from "./src/scroll-edge-fade";
import { SCROLL_FADE_HEIGHT } from "./src/scroll-fade";
import { APP_BUILD, APP_VERSION } from "./src/version";

const SCROLL_CONTENT_PADDING_TOP = 18;

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
  const [signReview, setSignReview] = useState<SignReview | null>(null);
  const [confirmedLine, setConfirmedLine] = useState<{ wallet: string; market: string } | null>(null);
  const lineSubmitting = useRef(false);
  const [coverConfirm, setCoverConfirm] = useState<{ sentence: string; station: string; expiry: string; windowLabel: string; pay: string; getLabel: string; market: string; amount: string; multiple: string | null; feeLine: string | null; getLine: string | null; preSign: string | null; conditionLine: string | null; placeLine: string | null; triggerLine: string | null; shortLabel: string | null; coverSkyt: CoverChip } | null>(null);
  const [stickyHeight, setStickyHeight] = useState(188);
  const [tabHeight, setTabHeight] = useState(76);
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const [cities, setCities] = useState<CityIndex[]>([]);
  const [catalog, setCatalog] = useState<AgriculturalMarket[]>([]);
  const [status, setStatus] = useState<DevnetStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState("new-york");
  // Session-only Markets choice. Cold starts recompute the New York fallback.
  const [selectedMarketsCity, setSelectedMarketsCity] = useState<string | null>(null);
  const [selectedHazard, setSelectedHazard] = useState<HazardId | null>("rainfall");
  const [city, setCity] = useState<CityIndex | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletSession, setWalletSession] = useState<AuthorizedWallet | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  /** Finalized position accounts for this wallet, read on device. Drives the "You're covered" state. */
  const [chainPositions, setChainPositions] = useState<ChainProtection[] | null>(null);
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
    setWalletBalances(null); setChainPositions(null); setPortfolio(null);
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
      setChainPositions(portfolioResult.status === "fulfilled" ? portfolioResult.value.protections : null);
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
    loadWalletSession().catch(() => null).then((session) => {
      if (cancelled) return;
      if (session) {
        setWalletSession(session);
        setWallet(session.address);
        setShowLanding(false);
        setTab("protect");
        void loadWalletData(session.address);
        return;
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [loadWalletData]);

  const discovery = useDiscovery(status?.cityWindows ?? [], evidenceNonce, nowSeconds);
  const connect = useCallback(async () => {
    setLoading(true);
    setWalletError(null);
    try {
      const session = await authorizeDevnetWallet();
      setWalletSession(session);
      setWallet(session.address);
      await saveWalletSession(session);
      setShowLanding(false);
      setTab("protect");
      const first = discovery.markets.find((m) => m.tenor === "weekly");
      const pair = first ?? firstOpenPair(upcomingWindow(Date.now(), "weekly").start, "weekly");
      if (pair) { setSelectedCity(pair.cityId); line.setPeril(pair.peril); line.setTenor("weekly"); line.setCover(100); }
      await loadWalletData(session.address);
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "";
      setWalletError(/cancel|reject|declin/i.test(detail)
        ? "Wallet connection wasn’t approved. You can try again whenever you’re ready."
        : "The wallet didn’t connect. Check that a compatible Solana wallet is installed, then try again.");
    } finally {
      setLoading(false);
    }
  }, [loadWalletData, discovery.markets]);

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
  const coveredPosition = wallet ? positionForWindow(chainPositions, activeWindow?.address) : null;
  const alreadyCovered = !!coveredPosition || (!!claimReadiness && claimReadiness.state !== "no_position");
  const activePackage = matchingWindowPackage(windowEvidence, protectCity, activeWindow?.observationStart, activeWindow?.observationEnd);
  const safeBottom = initialWindowMetrics?.insets.bottom ?? 0;
  const stickyOpen = !showLanding && tab === "protect";
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
    : coveredPosition ? duplicatePositionReason(consumerCityName(protectCity), "pending")
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

  const submitApprovedAction = async (action: "open_position" | "claim_payout" | "claim_premium_refund", marketAddress?: string, amountOverride?: string, lineRequest?: { review: SignReview; onStep: (step: SignStep) => void }): Promise<SignOutcome> => {
    if (action === "open_position" && lineRequest) {
      if (lineSubmitting.current) return { kind: "error", error: "unconfirmed" };
      lineSubmitting.current = true;
      const { review, onStep } = lineRequest;
      try {
        const outcome = await submitLineOpenPosition({
          target: review.target, wallet, sessionAddress: walletSession?.address ?? null, reviewWallet: review.wallet,
          positions: chainPositions, balanceBase: walletBalances ? String(walletBalances.skytBaseUnits) : null,
          nowSeconds: Math.floor(Date.now() / 1000),
          prepare: (target, owner) => prepareUnsignedTransaction({
            action, market: target.market, wallet: owner, amount: target.amount,
            onDevice: (input) => buildOpenPositionOnDevice(input),
            server: () => postJson<UnsignedTransaction>("/api/transactions/unsigned", { action, market: target.market, wallet: owner, amount: target.amount, approved: true }, { attempts: 2, timeoutMs: 20_000 }),
          }),
          sign: (base64, onPhase) => signAndConfirmDevnetTransaction({ transactionBase64: base64, wallet: walletSession!, rpcUrl: DEVNET_RPC_URL, onPhase }),
          check: async (duplicate) => {
            const found = await findPositionAfterBuy({ read: () => readFinalizedProtections(wallet!), windowAddress: review.target.market, attempts: duplicate ? 2 : 4 });
            if (found.protections) setChainPositions([...found.protections]);
            return !!found.position;
          },
          onPhase: (phase) => onStep(signStepForPhase(phase)),
          onSignature: setTransactionSignature,
          refresh: async () => { await loadHome(); await loadWalletData(wallet!, true); },
          logError: (reason) => console.warn("Line cover submission failed", reason),
        });
        if ((outcome.kind === "confirmed" || outcome.kind === "already-covered") && wallet) setConfirmedLine({ wallet, market: review.target.market });
        return outcome;
      } finally { lineSubmitting.current = false; }
    }
    const targetMarket = marketAddress ?? activeWindow?.address ?? null;
    if (action === "open_position" && positionForWindow(chainPositions, targetMarket)) {
      // Already covered on this window: show the position, never a second buy or a Failed card.
      setBuyPhase(null);
      setTransactionMessage(null);
      setTransactionError(null);
      setTransactionDetail(null);
      return { kind: "already-covered" };
    }
    let reachedWallet = false;
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
          reachedWallet = true;
          const legacyPhase = phase === "confirming" ? "checking" : phase;
          setBuyPhase(legacyPhase);
          setTransactionMessage(buyPhaseLabel(legacyPhase));
        },
      });
      setTransactionSignature(signature);
      setBuyPhase("confirmed");
      setTransactionMessage(buyPhaseLabel("confirmed"));
      setQuote(null);
      try {
        await loadHome();
        await loadWalletData(wallet, true);
        if (activeWindow?.address) {
          const readiness = await getJson<ClaimReadiness>(claimReadinessPath(activeWindow.address, wallet));
          setClaimReadiness(readiness);
        }
      } catch {
        // The transaction is already confirmed. A later Wallet refresh can retry the read.
      }
      return { kind: "confirmed" };
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "The transaction did not complete.";
      const shown = transactionFailure(message, reason instanceof ApiError ? reason.detail : null);
      if (/just closed|price changed|committed terms/i.test(shown.message)) void requestProtectionQuote();
      if (reason instanceof TransactionFailedError && reason.signature) setTransactionSignature(reason.signature);
      // Before saying "Failed", check the chain: the wallet may have sent it (app closed, confirmation timed out) or it already exists.
      const duplicate = isExistingPositionError(shown.message) || isExistingPositionError(shown.detail);
      if (action === "open_position" && wallet && targetMarket && (duplicate || (reachedWallet && !isWalletDecline(shown.message)))) {
        setBuyPhase("checking");
        setTransactionMessage(buyPhaseLabel("checking"));
        const found = await findPositionAfterBuy({ read: () => readFinalizedProtections(wallet), windowAddress: targetMarket, attempts: duplicate ? 2 : 4 });
        if (found.protections) setChainPositions([...found.protections]);
        if (found.position) {
          setBuyPhase(null);
          setTransactionMessage(null);
          setTransactionError(null);
          setTransactionDetail(null);
          setQuote(null);
          void loadWalletData(wallet, true);
          return duplicate ? { kind: "already-covered" } : { kind: "confirmed" };
        }
      }
      setBuyPhase("failed");
      setTransactionMessage(buyPhaseLabel("failed"));
      setTransactionError(shown.message);
      setTransactionDetail(shown.detail);
      return signFailure(reason, reachedWallet);
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

  const line = useLineProtect({
    cityId: protectCity,
    windows: openWindows,
    retryKey: evidenceNonce,
    statusLoading: homeLoading && !status,
    statusFailed: Boolean(statusError && !status),
    connected: Boolean(wallet),
    signing: buyPhase === "preparing" || buyPhase === "waiting" || buyPhase === "sending" || buyPhase === "checking",
    coveredMarket: confirmedLine?.wallet === wallet ? confirmedLine.market : coveredPosition?.market ?? (alreadyCovered && activeWindow?.address ? activeWindow.address : null),
    chainPositions: wallet ? chainPositions : null,
    nowSeconds,
  });

  const storedCovers = chainPositions ?? portfolio?.protections ?? [];
  const walletCovers = useReceipts(storedCovers, wallet, status?.cityWindows ?? [], discovery.quotes, evidenceNonce);
  const scrollBottom = stickyOpen ? scrollBottomPadding(line.model) : SCROLL_FADE_HEIGHT + 16;
  const openMarketSelection = (market: MarketSelection) => {
    changeCity(market.cityId); line.chooseMarket(market);
    setTab("protect"); scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  if (!fontsLoaded && !fontError) return <SafeAreaProvider><SafeAreaView style={styles.fontLoading}><StatusBar barStyle="light-content" backgroundColor={C.canvas} /><ActivityIndicator color={C.green} /></SafeAreaView></SafeAreaProvider>;

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.canvas} translucent={false} />
      <GlassTargetContext.Provider value={glassTarget}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}><BlurTargetView ref={glassTarget} style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.canvas }]} />
      </BlurTargetView></View>

      <View style={styles.scrollWrap} onLayout={(event) => { const next = Math.round(event.nativeEvent.layout.height); setScrollViewportHeight((prev) => prev === next ? prev : next); }}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottom }, !showLanding && (tab === "protect" || tab === "catalog") && { paddingHorizontal: 16, paddingTop: 0 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.rain} />}
      >
        <ScreenTransition transitionKey={tab}>
        {error ? <ErrorBanner message={error} onRetry={() => { void retryData(); }} /> : null}
        {!showLanding && homeLoading && cities.length === 0 && catalog.length === 0 ? <View style={styles.loadingPanel} accessibilityLabel="Loading"><ActivityIndicator color={C.rain} /><Text style={styles.emptyText}>Loading finalized weather, market catalog, and Devnet readiness…</Text></View> : null}
        {showLanding ? (
          <LandingLine quotes={discovery.quotes} loading={discovery.loading} failed={discovery.failed} onBrowse={() => setShowLanding(false)} onConnect={() => { void connect(); }} />
        ) : null}
        {!showLanding && tab === "catalog" ? <MarketsLine {...discovery} markets={marketModels(discovery.quotes, nowSeconds, 100, storedCovers.map((position) => position.market))} receipts={walletCovers.receipts} totals={walletCovers.totals} onSelect={openMarketSelection} selectedCity={selectedMarketsCity} onCity={setSelectedMarketsCity} onRetry={() => setEvidenceNonce((count) => count + 1)} onPreview={(preview) => { line.clearMarketSelection(); setSelectedCity(preview.cityId); line.setPeril(preview.peril); line.setTenor(preview.tenor); setTab("protect"); scrollRef.current?.scrollTo({ y: 0, animated: false }); }} onWallet={() => setTab("wallet")} /> : null}
        {!showLanding && tab === "protect" && claimReadiness?.state === "claimable" && claimReadiness.action === "claim_payout" ? (
          <CollectPayoutView
            observedMm={claimReadiness.observation ? Number(claimReadiness.observation.rainfallMmX100) / 100 : null}
            triggerMm={activeWindow?.thresholdMmX100 && /^\d+$/.test(activeWindow.thresholdMmX100) ? Number(activeWindow.thresholdMmX100) / 100 : null}
            source={`NOAA · ${stationLabel(status?.noaaEvidence.package?.stationId)}`} windowLabel={null}
            amountLabel={claimReadiness.amount ? formatSkytFixed(claimReadiness.amount, 0) : null}
            walletLabel={wallet ? shortAddress(wallet) : null}
            onBack={() => setTab("catalog")} />
        ) : null}
        {!showLanding && tab === "protect" && !(claimReadiness?.state === "claimable" && claimReadiness.action === "claim_payout") ? (
          !status && (isNetworkError(error) || isNetworkError(walletError) || isNetworkError(portfolioError)) ? (
            <View style={styles.emptyState} accessibilityRole="alert">
              <AppIcon name="wifi-off" color={C.coral} size={22} />
              <Text style={[styles.emptyTitle, { marginTop: 10 }]}>You’re offline</Text>
              <Text style={styles.emptyText}>SkyHedge can’t reach its market service from this phone. Check Wi‑Fi or mobile data, then retry.</Text>
              <View style={{ marginTop: 16 }}><ActionButton label="Retry" icon="refresh-cw" onPress={() => { void retryData(); }} /></View>
            </View>
          ) : (
            <>
            <ProtectBody
              line={line}
              onCity={changeCity}
              onWallet={() => { setTab("wallet"); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
              onRetry={() => setEvidenceNonce((count) => count + 1)}
            />
            </>
          )
        ) : null}
        {!showLanding && tab === "wallet" ? <WalletLine wallet={wallet} balance={walletBalances ? formatBaseGrouped(BigInt(walletBalances.skytBaseUnits)) : null} {...walletCovers}
          loading={balancesLoading || loading} failed={Boolean(balancesError || portfolioError || walletError || portfolio?.indexed === false)}
          onConnect={() => { void connect(); }} onRetry={() => { if (wallet) void loadWalletData(wallet, true); setEvidenceNonce((n) => n + 1); }}
          onDisconnect={() => { void clearWalletSession(); setWallet(null); setWalletSession(null); setPortfolio(null); setChainPositions(null); setWalletBalances(null); setBalancesError(null); setPortfolioError(null); setWalletError(null); }}
          technical={<TechnicalContext catalog={catalog} program={SKYHEDGE_PROGRAM_ID.toBase58()}/>}
        /> : null}
        </ScreenTransition>
      </ScrollView>
      </View>


      {!showLanding && tab === "protect" && line.model.panel.kind !== "covered" && (claimReadiness?.state === "claimable" && claimReadiness.action || line.model.showBar) ? <View collapsable={false} style={styles.payPanel} onLayout={(event) => { const next = Math.ceil(event.nativeEvent.layout.height); setStickyHeight((prev) => prev === next ? prev : next); }}><ScrollEdgeFade style={styles.scrollEdgeFade} />{claimReadiness?.state === "claimable" && claimReadiness.action ? <StickyCta label={claimReadiness.action === "claim_payout" ? "Collect payout to wallet" : "Claim refund in wallet"} busy={buyPhase === "preparing" || buyPhase === "waiting" || buyPhase === "sending"} busyLabel={buyPhase ? buyPhaseLabel(buyPhase) : undefined} onPress={() => { if (claimReadiness.action) void submitApprovedAction(claimReadiness.action); }} /> : <LinePay line={line} sheetOpen={signReview != null} onConnect={() => { void connect(); }} onReview={() => {
        if (!line.approveTarget || !line.model.ticket) return;
        const target = { ...line.approveTarget };
        setSignReview({ target, wallet, ticket: line.model.ticket, context: { premiumBase: target.premiumBase, balanceBase: walletBalances ? String(walletBalances.skytBaseUnits) : null, cityName: line.model.cityName, peril: line.model.peril, triggerLabel: target.triggerLabel, windowLabel: target.windowLabel } });
      }} onWallet={() => setTab("wallet")} onRetry={() => setEvidenceNonce((count) => count + 1)} onCity={changeCity} />}</View> : null}
      {coverConfirm ? <ConfirmCover {...coverConfirm} onClose={() => setCoverConfirm(null)} onCover={(skyt) => {
        const option = coverageOptions(walletBalances ? String(walletBalances.skytBaseUnits) : null).find((item) => item.id === String(skyt));
        if (option) chooseCoverage(option);
        if (!activeWindow) return;
        const windowLabel = committedWindowLabel(activeWindow);
        const station = stationDisplayName(consumerCityBySlug(protectCity)?.source ?? null);
        const threshold = activeWindow.thresholdMmX100 && /^\d+$/.test(activeWindow.thresholdMmX100) ? Number(activeWindow.thresholdMmX100) / 100 : null;
        const amount = coverBaseUnits(skyt);
        const model = windowLabel && station && threshold != null ? stakeSheetForCover({
          coverSkyt: skyt,
          probabilityBps: activeWindow.quoteProbabilityBps,
          premiumRateBps: activeWindow.premiumRateBps,
          inputsHash: activeWindow.quoteInputsHash,
          protocolFeeBase: quote && amount && quote.protectedAmount === amount ? quote.protocolFee : null,
          city: consumerCityBySlug(protectCity)?.city,
          station,
          triggerMm: threshold,
          windowLabel,
        }) : null;
        if (!model || !amount) return;
        const nextBalance = walletBalances ? formatQuoteSkyt(String(walletBalances.skytBaseUnits), 2) : null;
        setCoverConfirm((prev) => prev ? { ...prev, ...model, sentence: model.getLine, pay: model.premiumLabel, getLabel: model.coverLabel, amount, conditionLine: model.conditionLine, placeLine: model.placeLine, triggerLine: model.triggerLine, shortLabel: nextBalance && coverExceedsBalance(model.payBase, walletBalances ? String(walletBalances.skytBaseUnits) : null) ? notEnoughSkyt(nextBalance) : null, coverSkyt: skyt } : prev);
      }} onApprove={() => {
        const pending = coverConfirm;
        handleConfirmApprove({ close: () => setCoverConfirm(null), signOpenPosition: () => { void submitApprovedAction("open_position", pending.market, pending.amount); } });
      }} /> : null}
      {showLanding ? null : <View style={styles.bottomBar} onLayout={(event) => { const next = Math.ceil(event.nativeEvent.layout.height); setTabHeight((prev) => prev === next ? prev : next); }} accessibilityRole="tablist" accessibilityLabel="Main navigation">
        <TabButton label="Markets" glyph="markets" selected={tab === "catalog" || tab === "weather"} onPress={() => { setTab("catalog"); setDetailCode(null); scrollRef.current?.scrollTo({ y: 0, animated: false }); }} />
        <TabButton label="Protect" glyph="protect" selected={tab === "protect"} onPress={() => setTab("protect")} />
        <TabButton label="Wallet" glyph="wallet" selected={tab === "wallet"} onPress={() => { setTab("wallet"); }} />
      </View>}
      {signReview ? <SignSheet review={signReview} onClose={() => setSignReview(null)}
        onApprove={(review, onStep) => submitApprovedAction("open_position", review.target.market, review.target.amount, { review, onStep })}
        onWallet={() => { setTab("wallet"); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
        onMarkets={() => { setTab("catalog"); scrollRef.current?.scrollTo({ y: 0, animated: false }); }} /> : null}
      </GlassTargetContext.Provider>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}


function TabButton({ label, glyph, selected, onPress }: { label: string; glyph: "markets" | "protect" | "wallet"; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={`${label} tab`} accessibilityState={{ selected }} onPress={onPress} style={styles.tabButton}>
      <View style={selected ? styles.tabTick : styles.tabTickSpace} />
      <TabGlyph name={glyph} color={selected ? lineTokens.fg : lineTokens.fg2} />
      <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{label}</Text>
    </Pressable>
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
  safe: { flex: 1, backgroundColor: C.canvas, overflow: "visible" },
  versionText: { color: C.quiet, fontFamily: F.mono, fontSize: 13, padding: 10 },
  scrollWrap: { flex: 1, zIndex: 0 },
  scroll: { flex: 1 },
  scrollEdgeFade: { position: "absolute", left: 0, right: 0, top: -SCROLL_FADE_HEIGHT },
  payPanel: { overflow: "visible" },
  scrollContent: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 18, paddingTop: SCROLL_CONTENT_PADDING_TOP, paddingBottom: 168 },
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
  bottomBar: { zIndex: 6, minHeight: 64, backgroundColor: lineTokens.bg, flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingBottom: 6, paddingHorizontal: S.sm },
  tabButtonWrap: { flex: 1, minWidth: 0 },
  tabButton: { flex: 1, minWidth: 0, minHeight: 64, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  tabTick: { width: 24, height: 3, backgroundColor: lineTokens.glacier, marginBottom: 4 },
  tabTickSpace: { width: 24, height: 3, marginBottom: 4 },
  tabLabel: { color: lineTokens.fg2, fontFamily: F.bodyMedium, fontSize: 13, marginTop: 2 },
  tabLabelSelected: { color: lineTokens.fg },
});
