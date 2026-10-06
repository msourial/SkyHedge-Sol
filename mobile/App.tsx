import "./src/polyfills";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
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
import { AdvisoryResponse, AgriculturalMarket, ClaimReadiness, CityIndex, DevnetStatus, FinalizedWalletState, getJson, Portfolio, postJson, ProtectionQuote, UnsignedTransaction } from "./src/api";
import { DEVNET_RPC_URL, readFinalizedWalletState } from "./src/chain";
import { hazardPresentation, listHazards, type HazardId } from "./src/hazards";
import { formatOnchainMarketStatus, formatUsdPreview, isMarketReadyForCity, rainfallBarPercent, recentNoaaHistoryForArea, researchLocationLabel, resolveSelectedNoaaCity, riskChoiceForArea, searchAgriculturalMarkets } from "./src/presentation";
import { buildCommittedQuoteRequest, formatSkyt, getProtectionUnavailableReason, isOnchainMarketOpen, parseSkytAmount } from "./src/protection";
import { authorizeDevnetWallet, signAndConfirmDevnetTransaction, type AuthorizedWallet } from "./src/wallet";
import { C, F } from "./src/theme";
import { ActionButton, AppIcon, Reveal, StatusPill, Text, type AppIconName } from "./src/ui";
import { GuidePanel, type GuideTurn } from "./src/GuidePanel";
import { ReferenceAreaMap } from "./src/ReferenceAreaMap";
import { referenceEvidenceLabel, referenceLocationFor, referencePointFor } from "./src/reference-map";

type Tab = "weather" | "catalog" | "protect" | "wallet";
type AmountMode = "usd-preview" | "devnet-test";

const CITY_ORDER = ["des-moines", "chicago", "new-york", "miami"];

export default function App() {
  const scrollRef = useRef<ScrollView>(null);
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold });
  const [tab, setTab] = useState<Tab>("catalog");
  const [cities, setCities] = useState<CityIndex[]>([]);
  const [catalog, setCatalog] = useState<AgriculturalMarket[]>([]);
  const [status, setStatus] = useState<DevnetStatus | null>(null);
  const [selectedCity, setSelectedCity] = useState("des-moines");
  const [hasChosenArea, setHasChosenArea] = useState(false);
  const [selectedHazard, setSelectedHazard] = useState<HazardId | null>(null);
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
  const [amountMode, setAmountMode] = useState<AmountMode>("usd-preview");
  const [usdPreviewAmount, setUsdPreviewAmount] = useState("100");
  const [protectionAmount, setProtectionAmount] = useState("");
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

  const loadWalletData = useCallback(async (address: string) => {
    const [balanceResult, portfolioResult] = await Promise.allSettled([
      readFinalizedWalletState(address),
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
    setSelectedHazard(null);
    setAmountMode("usd-preview");
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
      setGuideTurns((turns) => turns.map((turn) => turn.id === id ? { ...turn, error: reason instanceof Error ? reason.message : "The guide is unavailable. No quote or transaction was prepared." } : turn));
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
    setQuoteError(null);
    setTransactionError(null);
    setTransactionSignature(null);
    setQuote(null);
    if (amountMode !== "devnet-test") {
      setQuoteError("A NOAA quote is available only in the separate Devnet test flow. USD previews are not payable quotes.");
      return;
    }
    if (protectionUnavailableReason || !status || !amountBase) {
      setQuoteError(protectionUnavailableReason ?? "Finalized market terms are incomplete; a quote cannot be requested.");
      return;
    }
    const request = buildCommittedQuoteRequest(status, amountBase);
    if (!request) {
      setQuoteError("Finalized market terms are incomplete; a quote cannot be requested.");
      return;
    }
    setTransactionBusy(true);
    try {
      const result = await postJson<ProtectionQuote>("/api/quotes", request);
      if (result.protectedAmount !== amountBase || result.source !== "NOAA" || result.explicitApprovalRequired !== true) throw new Error("The quote did not match the entered amount or NOAA approval requirements.");
      setQuote(result);
    } catch (reason) {
      setQuoteError(reason instanceof Error ? reason.message : "The NOAA-backed quote is unavailable.");
    } finally {
      setTransactionBusy(false);
    }
  };

  const submitApprovedAction = async (action: "open_position" | "claim_payout" | "claim_premium_refund") => {
    setTransactionBusy(true);
    setTransactionError(null);
    setTransactionMessage(action === "open_position" ? "Review and approve the protection in your wallet." : "Review and approve the claim in your wallet.");
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
      setTransactionMessage("Waiting for wallet approval…");
      const signature = await signAndConfirmDevnetTransaction({ transactionBase64: unsigned.base64, wallet: walletSession, rpcUrl: DEVNET_RPC_URL });
      setTransactionSignature(signature);
      setTransactionMessage("Finalized on Solana Devnet.");
      setQuote(null);
      await loadHome();
      await loadWalletData(wallet);
      if (status.desMoinesMarket.address) {
        const readiness = await getJson<ClaimReadiness>(`/api/markets/${encodeURIComponent(status.desMoinesMarket.address)}/positions/${encodeURIComponent(wallet)}/claim-readiness`);
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
    getJson<ClaimReadiness>(`/api/markets/${encodeURIComponent(status.desMoinesMarket.address)}/positions/${encodeURIComponent(wallet)}/claim-readiness`)
      .then((value) => { if (!cancelled) { setClaimReadiness(value); setClaimError(null); } })
      .catch((reason) => { if (!cancelled) setClaimError(reason instanceof Error ? reason.message : "Claim status is unavailable."); });
    return () => { cancelled = true; };
  }, [wallet, status?.desMoinesMarket.address]);

  if (!fontsLoaded && !fontError) return <SafeAreaProvider><SafeAreaView style={styles.fontLoading}><StatusBar barStyle="light-content" backgroundColor={C.canvas} /><ActivityIndicator color={C.green} /></SafeAreaView></SafeAreaProvider>;

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.canvas} translucent={false} />
      <View style={styles.header}>
        <View style={styles.brandMark}><AppIcon name="cloud-drizzle" color={C.green} size={22} /></View>
        <View style={styles.brandCopy}>
          <Text style={styles.brand}>SkyHedge</Text>
          <Text style={styles.brandSub}>Weather protection</Text>
        </View>
        <StatusPill label="Devnet" tone="pending" />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.blue} />}
      >
        {error ? <ErrorBanner message={error} onRetry={() => { void retryData(); }} /> : null}
        {homeLoading && cities.length === 0 && catalog.length === 0 ? <View style={styles.loadingPanel}><ActivityIndicator color={C.blue} /><Text style={styles.emptyText}>Loading finalized weather, market catalog, and Devnet readiness…</Text></View> : null}
        {tab === "weather" ? (
          <WeatherScreen
            cities={cities}
            city={city}
            selectedCity={selectedCity}
            selectedPlace={catalog.find((item) => item.slug === selectedCity)}
            status={status}
            history={orderedHistory}
            marketReady={marketReady}
            onCityChange={changeCity}
            onProtect={() => setTab("catalog")}
          />
        ) : null}
        {tab === "catalog" ? <CatalogScreen markets={catalog} city={city} status={status} query={marketQuery} activeArea={hasChosenArea ? selectedCity : null} hazard={selectedHazard} guideTurns={guideTurns} guideBusy={guideBusy} onAskGuide={(message) => { void askGuide(message); }} onQueryChange={setMarketQuery} onSelectArea={(slug) => { changeCity(slug); setMarketQuery(""); scrollRef.current?.scrollTo({ y: 0, animated: false }); }} onSelectHazard={(risk) => { setSelectedHazard(risk); setQuote(null); setQuoteError(null); setTransactionSignature(null); setTransactionMessage(null); setTransactionError(null); }} onOpenProtect={() => setTab("protect")} onViewGuideMatch={(result) => { if (!result.match) return; changeCity(result.match.slug); setSelectedHazard("rainfall"); setTab("protect"); scrollRef.current?.scrollTo({ y: 0, animated: false }); }} /> : null}
        {tab === "protect" ? (
          <ProtectScreen
            status={status} selectedCity={selectedCity} selectedHazard={selectedHazard} marketLocation={marketLocation} amountMode={amountMode} usdPreviewAmount={usdPreviewAmount} amount={protectionAmount}
            amountBase={amountBase} quote={quote} quoteError={quoteError} unavailableReason={protectionUnavailableReason}
            quotePaymentReason={quotePaymentReason}
            claimReadiness={claimReadiness} claimError={claimError} transactionBusy={transactionBusy}
            transactionMessage={transactionMessage} transactionError={transactionError} transactionSignature={transactionSignature}
            walletConnected={!!wallet}
            onAmountModeChange={changeAmountMode}
            onUsdPreviewChange={(value) => { if (/^\d{0,9}(?:\.\d{0,2})?$/.test(value)) setUsdPreviewAmount(value); }}
            onAmountChange={(value) => { setProtectionAmount(value); setQuote(null); setQuoteError(null); }}
            onRequestQuote={() => { void requestProtectionQuote(); }}
            onApprove={() => { void submitApprovedAction("open_position"); }}
            onClaim={() => { if (claimReadiness?.action) void submitApprovedAction(claimReadiness.action); }}
            onRefresh={() => { void refresh(); }}
            onOpenWallet={() => setTab("wallet")}
            onExplore={() => setTab("catalog")}
          />
        ) : null}
        {tab === "wallet" ? (
          <WalletScreen
            wallet={wallet}
            portfolio={portfolio}
            walletBalances={walletBalances}
            portfolioError={portfolioError}
            walletError={walletError}
            loading={loading}
            onConnect={connect}
            onDisconnect={() => { setWallet(null); setWalletSession(null); setPortfolio(null); setWalletBalances(null); setPortfolioError(null); setWalletError(null); setClaimReadiness(null); setQuote(null); }}
          />
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar} accessibilityRole="tablist" accessibilityLabel="Main navigation">
        <TabButton label="Explore" icon="map-pin" selected={tab === "catalog"} onPress={() => setTab("catalog")} />
        <TabButton label="Weather" icon="cloud-rain" selected={tab === "weather"} onPress={() => setTab("weather")} />
        <TabButton label="Protect" icon="shield" selected={tab === "protect"} onPress={() => setTab("protect")} />
        <TabButton label="Wallet" icon="credit-card" selected={tab === "wallet"} onPress={() => setTab("wallet")} />
      </View>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

function WeatherScreen({
  cities,
  city,
  selectedCity,
  selectedPlace,
  status,
  history,
  marketReady,
  onCityChange,
  onProtect,
}: {
  cities: CityIndex[];
  city: CityIndex | null;
  selectedCity: string;
  selectedPlace: AgriculturalMarket | undefined;
  status: DevnetStatus | null;
  history: NonNullable<CityIndex["weeklyHistoryMm"]>;
  marketReady: boolean;
  onCityChange: (slug: string) => void;
  onProtect: () => void;
}) {
  const maxRain = Math.max(1, ...history.map((week) => week.mm ?? 0));
  const researchPlace = researchLocationLabel(selectedCity, selectedPlace);
  return (
    <>
      <Text style={styles.kicker}>NOAA weather</Text>
      <Text style={styles.title}>Rainfall evidence</Text>
      <Text style={styles.intro}>Observed conditions for the selected reference area.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cityRail}>
        {cities.map((item) => (
          <Pressable
            key={item.slug}
            accessibilityRole="button"
            accessibilityState={{ selected: item.slug === city?.slug }}
            onPress={() => onCityChange(item.slug)}
            style={[styles.cityChip, item.slug === city?.slug && styles.cityChipSelected]}
          >
            <Text style={[styles.cityChipText, item.slug === city?.slug && styles.cityChipTextSelected]}>{item.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {city ? (
        <>
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroLabel}>Observed rainfall · NOAA</Text>
                <Text style={styles.heroPlace}>{city.name}</Text>
                <Text style={styles.heroSub}>{city.country} · {city.stationName}</Text>
              </View>
              <View style={[styles.indexBadge, city.cumulativeMm == null && styles.indexBadgeUnavailable]}><Text style={[styles.indexBadgeText, city.cumulativeMm == null && styles.indexBadgeUnavailableText]}>{city.cumulativeMm == null ? "No data" : "Observed"}</Text></View>
            </View>
            <View style={styles.rainValueRow}>
              <Text style={styles.rainValue}>{city.cumulativeMm == null ? "—" : city.cumulativeMm.toFixed(1)}</Text>
              <Text style={styles.rainUnit}>mm</Text>
            </View>
            <Text style={styles.rainCaption}>
              {city.cumulativeMm == null
                ? "Observation unavailable from NOAA right now. No value is estimated."
                : `Observed through ${city.observedThrough ?? "the latest NOAA report"}. This is not a forecast.`}
            </Text>
            <View style={styles.windowRow}>
              <Text style={styles.windowLabel}>Observation window</Text>
              <Text style={styles.windowDates}>{city.currentWindow.start} — {city.currentWindow.end}</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>The recent pattern</Text>
            <Text style={styles.sectionMeta}>Completed weeks · mm</Text>
          </View>
          <View style={styles.chartCard} accessible accessibilityLabel={`NOAA completed weekly rainfall history, in millimetres. ${history.map((week) => `${week.week}: ${week.mm == null ? "unavailable" : `${week.mm.toFixed(1)} millimetres`}`).join("; ") || "No history available."}`}>
            {history.length ? history.map((week) => (
              <View key={week.week} style={styles.barColumn}>
                <Text style={styles.barValue}>{week.mm == null ? "—" : week.mm.toFixed(0)}</Text>
                <View style={styles.barTrack}>
                {week.mm == null ? <View style={styles.barUnknown} /> : <View style={[styles.barFill, { height: `${rainfallBarPercent(week.mm, maxRain) ?? 0}%` }]} />}
                </View>
                <Text style={styles.barDate}>{week.week.slice(5)}</Text>
              </View>
            )) : (
              <Text style={styles.emptyText}>Historical observations are not available yet. The chart stays blank until NOAA provides them.</Text>
            )}
          </View>

          <View style={styles.noteCard}>
            <Text style={styles.noteEyebrow}>Source note</Text>
            <Text style={styles.noteTitle}>Observed is not forecast.</Text>
            <Text style={styles.noteBody}>SkyHedge uses a published NOAA station and observation window. A final payout only follows verified settlement evidence on Solana.</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Choose a weather risk for ${city.name}`} onPress={onProtect} style={styles.secondaryAction}>
            <Text style={styles.secondaryActionTitle}>Choose a weather risk for {city.name}</Text>
            <Text style={styles.secondaryActionBody}>Observed NOAA rainfall is context, not a quote or proof that a market is open.</Text>
          </Pressable>
        </>
      ) : (
        <EmptyState title={researchPlace ? "No validated NOAA observations for this place" : "NOAA index unavailable"} body={researchPlace ? `${researchPlace} is a research-only reference place. No readings or chart are substituted from another area.` : "Connect to the SkyHedge API to load the current index. No sample weather values are shown."} />
      )}

      <View style={styles.releaseCard}>
        <View style={styles.releaseIcon}><AppIcon name={marketReady ? "check" : "info"} color={marketReady ? C.green : C.amber} size={16} /></View>
        <View style={styles.releaseCopy}>
          <Text style={styles.releaseTitle}>{marketReady ? "A market is release-ready" : "Protection checkout is closed"}</Text>
          <Text style={styles.releaseBody}>
            {marketReady
              ? "The app still requires a current quote and your wallet approval before any transaction."
              : status?.noaaEvidence.message ?? "The Devnet market has not passed all evidence and collateral checks. Nothing can be purchased yet."}
          </Text>
        </View>
      </View>
    </>
  );
}

function CatalogScreen({ markets, city, status, query, activeArea, hazard, guideTurns, guideBusy, onAskGuide, onViewGuideMatch, onQueryChange, onSelectArea, onSelectHazard, onOpenProtect }: { markets: AgriculturalMarket[]; city: CityIndex | null; status: DevnetStatus | null; query: string; activeArea: string | null; hazard: HazardId | null; guideTurns: GuideTurn[]; guideBusy: boolean; onAskGuide: (message: string) => void; onViewGuideMatch: (result: AdvisoryResponse) => void; onQueryChange: (value: string) => void; onSelectArea: (slug: string) => void; onSelectHazard: (risk: HazardId) => void; onOpenProtect: () => void }) {
  const [pickerOpen, setPickerOpen] = useState(!activeArea);
  const [guideOpen, setGuideOpen] = useState(false);
  const matchingMarkets = useMemo(() => searchAgriculturalMarkets(markets, query), [markets, query]);
  const pilotAreas = [
    { slug: "saskatoon", location: "Saskatoon, Saskatchewan, Canada", context: "Farm dry-spell pilot · NOAA research in progress" },
    { slug: "toronto", location: "Toronto, Ontario, Canada", context: "Outdoor-event rain pilot · NOAA research in progress" },
  ].filter((area) => !query.trim() || `${area.location} ${area.context}`.toLowerCase().includes(query.trim().toLowerCase()));
  const chosenMarket = markets.find((market) => market.slug === activeArea);
  const chosenPlace = referenceLocationFor(activeArea, chosenMarket);
  const chooseArea = (slug: string) => { onSelectArea(slug); setPickerOpen(false); };
  const riskChoice = activeArea && hazard ? riskChoiceForArea(activeArea, hazard) : null;
  const rainfallHistory = activeArea && hazard === "rainfall" ? recentNoaaHistoryForArea(activeArea, city) : null;
  const stationReady = activeArea === "des-moines" && status?.desMoinesMarket.evidenceStatus === "validated" && status.noaaEvidence.status === "ready";
  const marketState = activeArea === "des-moines" ? formatOnchainMarketStatus(status?.desMoinesMarket.onchainStatus ?? null) : "Research only";
  const collateralReady = activeArea === "des-moines" && !!status?.desMoinesMarket.vaultBalance && /^\d+$/.test(status.desMoinesMarket.vaultBalance) && BigInt(status.desMoinesMarket.vaultBalance) > 0n;
  const evidenceLabel = referenceEvidenceLabel(hazard, stationReady);

  if (chosenPlace && !pickerOpen) return <View accessibilityLiveRegion="polite">
    <View style={styles.journeyRail} accessibilityLabel="Place selected, choose risk, then review evidence">
      <Text style={styles.journeyStepActive}>Place</Text><View style={styles.journeyRule} />
      <Text style={hazard ? styles.journeyStepActive : styles.journeyStep}>Risk</Text><View style={styles.journeyRule} />
      <Text style={hazard ? styles.journeyStepActive : styles.journeyStep}>Evidence</Text>
    </View>
    <View style={styles.chosenHeader}>
      <View style={styles.chosenCopy}>
        <Text style={styles.title}>{chosenPlace}</Text>
        <Text style={styles.chosenContext}>{activeArea === "toronto" ? "Outdoor-event rainfall · research only" : activeArea === "saskatoon" ? "Prairie dry-spell · research only" : chosenMarket?.agriculturalContext}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Change selected place" onPress={() => setPickerOpen(true)} style={styles.changePlace}><Text style={styles.changePlaceText}>Change</Text></Pressable>
    </View>
    <Text style={styles.selectionPrompt}>Which weather risk matters here?</Text>
    <View style={styles.riskSegments} accessibilityRole="tablist" accessibilityLabel="Weather risk for the selected place">
      {listHazards().map((option) => <Pressable key={option.id} accessibilityRole="tab" accessibilityState={{ selected: hazard === option.id }} accessibilityLabel={option.label} onPress={() => onSelectHazard(option.id)} style={[styles.riskSegment, hazard === option.id && styles.riskSegmentSelected]}>
        <Text style={[styles.riskSegmentText, hazard === option.id && styles.riskSegmentTextSelected]}>{option.label}</Text>
      </Pressable>)}
    </View>
    {hazard ? <View style={styles.outcomeSection} accessibilityLiveRegion="polite">
      <Text style={styles.sectionTitle}>{hazard === "rainfall" ? "Rainfall evidence" : `${hazardPresentation(hazard).label} research`}</Text>
      <Text style={styles.outcomeSummary}>{hazard === "rainfall" && activeArea === "des-moines"
        ? stationReady
          ? collateralReady ? `NOAA station package validated. On-chain market: ${marketState}.` : `NOAA station package validated. The on-chain market is ${marketState} and its SKYT vault is empty.`
          : `NOAA station evidence is not ready. On-chain market: ${marketState}.`
        : riskChoice?.detail}</Text>
      {hazard === "rainfall" && activeArea === "des-moines" ? <View style={styles.outcomeFacts}>
        <MetricRow label="NOAA station" value={stationReady ? status?.noaaEvidence.package?.stationId ?? "Validated station" : "Not validated"} />
        <MetricRow label="Contract trigger" value={status?.desMoinesMarket.thresholdMmX100 ? `${Number(status.desMoinesMarket.thresholdMmX100) / 100} mm cumulative liquid rain` : "No finalized trigger"} />
        <MetricRow label="On-chain market" value={`${marketState}${collateralReady ? " · collateral funded" : " · vault empty"}`} />
      </View> : <Text style={styles.hazardBlocked}>Research only · no quote or transaction is available.</Text>}
      {hazard === "rainfall" ? <RainfallHistoryPreview history={rainfallHistory} place={chosenPlace} /> : null}
      {riskChoice?.canReview ? <View style={styles.actionWrap}><ActionButton label="See protection status" icon="arrow-right" onPress={onOpenProtect} /></View> : null}
    </View> : <Text style={styles.chosenPrompt}>Choose one risk to see its evidence and availability.</Text>}
    <ReferenceAreaMap point={referencePointFor(chosenMarket)} location={chosenPlace} evidenceLabel={evidenceLabel} />
  </View>;

  return (
    <>
      <Text style={styles.title}>Where will it matter?</Text>
      <Text style={styles.intro}>Search a place or choose a suggestion. A listed reference place is not automatically covered.</Text>
      <View style={styles.searchWrap}>
        <AppIcon name="search" color={C.blue} size={20} />
        <TextInput
          accessibilityLabel="Search a location, state, country, or crop in the researched catalog"
          placeholder="City, state, country, or crop"
          placeholderTextColor={C.muted}
          value={query}
          onChangeText={onQueryChange}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {query.length ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onQueryChange("")} style={styles.clearSearch}><AppIcon name="x" size={20} /></Pressable> : null}
      </View>
      {!query.trim() ? <View style={styles.exampleRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Explore Toronto, Ontario, Canada for an outdoor event; research only" onPress={() => chooseArea("toronto")} style={styles.exampleButton}><Text style={styles.exampleText}>Event · Toronto</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Explore Saskatoon, Saskatchewan, Canada for a dry-spell pilot; research only" onPress={() => chooseArea("saskatoon")} style={styles.exampleButton}><Text style={styles.exampleText}>Farm · Saskatoon</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Explore Des Moines, Iowa, United States for a farm; rainfall pilot" onPress={() => chooseArea("des-moines")} style={styles.exampleButton}><Text style={styles.exampleText}>Farm · Des Moines</Text></Pressable>
      </View> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: guideOpen }} accessibilityLabel="Ask SkyHedge guide about a place and weather risk" onPress={() => setGuideOpen((open) => !open)} style={styles.guideToggle}><AppIcon name="message-circle" color={C.blue} size={20} /><Text style={styles.guideToggleText}>Describe your plans instead</Text><AppIcon name={guideOpen ? "chevron-up" : "chevron-down"} color={C.muted} size={18} /></Pressable>
      {guideOpen ? <GuidePanel turns={guideTurns} busy={guideBusy} onSend={onAskGuide} onViewMatch={onViewGuideMatch} /> : null}
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Researched areas</Text><Text style={styles.sectionMeta}>{markets.length} crop areas · 2 Canadian pilots</Text></View>
      <Text style={styles.resultMeta} accessibilityLiveRegion="polite">{markets.length === 0 ? "Catalog unavailable" : `${matchingMarkets.length + pilotAreas.length} matching ${(matchingMarkets.length + pilotAreas.length) === 1 ? "area" : "areas"}`}</Text>
      {pilotAreas.map((area) => <Pressable key={area.slug} accessibilityRole="button" accessibilityLabel={`${area.location}. ${area.context}. Select place and choose a weather risk.`} accessibilityState={{ selected: activeArea === area.slug }} onPress={() => chooseArea(area.slug)} style={[styles.marketCard, activeArea === area.slug && styles.marketCardSelected]}>
        <View style={styles.marketTop}><View style={styles.marketPin}><AppIcon name="map-pin" color={C.blue} size={19} /></View><View style={styles.marketMain}><Text style={styles.marketName}>{area.location}</Text><Text style={styles.marketPlace}>{area.context}</Text></View></View>
        <Text style={styles.marketFoot}>Researching NOAA evidence · no quote or purchase</Text>
      </Pressable>)}
      {matchingMarkets.length ? matchingMarkets.map((market) => {
        const pilotStationReady = market.slug === "des-moines" && status?.desMoinesMarket.evidenceStatus === "validated" && status.noaaEvidence.status === "ready";
        const evidenceLabel = pilotStationReady ? "NOAA station ready" : market.evidenceStatus === "validated" ? "Validated" : "Research";
        return <Pressable key={market.slug} accessibilityRole="button" accessibilityLabel={`${market.name}, ${market.locality}, ${market.administrativeArea}, ${market.country}. ${pilotStationReady ? "NOAA station package ready" : market.evidenceStatus === "validated" ? "NOAA evidence validated" : "Researching evidence"}. Select place and choose a weather risk.`} accessibilityState={{ selected: activeArea === market.slug }} onPress={() => chooseArea(market.slug)} style={[styles.marketCard, activeArea === market.slug && styles.marketCardSelected]}>
          <View style={styles.marketTop}>
            <View style={styles.marketPin}><AppIcon name="map-pin" color={C.blue} size={19} /></View>
            <View style={styles.marketMain}>
              <Text style={styles.marketName}>{market.name}</Text>
              <Text style={styles.marketPlace}>{market.locality}, {market.administrativeArea}, {market.country}</Text>
            </View>
            <View style={styles.researchPill}><Text style={styles.researchPillText}>{evidenceLabel}</Text></View>
          </View>
          <Text style={styles.marketContext}>{market.agriculturalContext}</Text>
          <Text style={styles.marketCrops}>{market.crops.join(" · ")}</Text>
          <Text style={styles.marketFoot}>
            {pilotStationReady
              ? `Pinned NOAA station ${status.noaaEvidence.package?.stationId ?? "ready"} · market ${formatOnchainMarketStatus(status.desMoinesMarket.onchainStatus)}`
              : market.noaaStationId ? `NOAA station ${market.noaaStationId}` : "No validated NOAA settlement station yet"}
          </Text>
          <View style={styles.marketActionRow}><Text style={styles.marketAction}>{activeArea === market.slug ? "Selected · choose a weather risk above" : "Select this place"}</Text><AppIcon name="arrow-right" color={C.blue} size={16} /></View>
        </Pressable>;
      }) : pilotAreas.length === 0 ? <EmptyState title={query ? "No researched areas match" : "Catalog unavailable"} body={query ? "Try another place, state or province, country, or crop. Search covers only the current research catalog." : "Researched locations appear after the API responds."} /> : null}
      <Text style={styles.catalogFootnote}>Research status is not coverage. Wind and snowfall never inherit a rainfall market’s evidence or readiness.</Text>
    </>
  );
}

function RainfallHistoryPreview({ history, place }: { history: CityIndex["weeklyHistoryMm"]; place: string }) {
  const values = history?.map((week) => week.mm !== null && Number.isFinite(week.mm) && week.mm >= 0 ? week.mm : null) ?? [];
  const maxRain = Math.max(1, ...values.map((value) => value ?? 0));
  return <View style={styles.miniHistory}>
    <Text style={styles.miniHistoryTitle}>Recent completed weeks · NOAA</Text>
    {history?.length ? <View style={styles.miniChart} accessible accessibilityLabel={`Observed NOAA weekly rainfall for ${place}: ${history.map((week, index) => `${week.week}, ${values[index] === null ? "unavailable" : `${values[index]?.toFixed(1)} millimetres`}`).join("; ")}`}>
      {history.map((week, index) => <View key={week.week} style={styles.barColumn}>
        <Text style={styles.barValue}>{values[index] === null ? "—" : values[index]?.toFixed(0)}</Text>
        <View style={[styles.barTrack, styles.miniBarTrack]}>{values[index] === null ? <View style={styles.barUnknown} /> : <View style={[styles.barFill, { height: `${rainfallBarPercent(values[index], maxRain) ?? 0}%` }]} />}</View>
        <Text style={styles.barDate}>{week.week.slice(5)}</Text>
      </View>)}
    </View> : <Text style={styles.hazardNote}>No completed NOAA rainfall history is available for this selected place. No diagram is estimated.</Text>}
    <Text style={styles.miniHistoryNote}>Past observations are context, not a forecast or a protection quote.</Text>
  </View>;
}

function ProtectScreen(props: {
  status: DevnetStatus | null;
  selectedCity: string;
  selectedHazard: HazardId | null;
  marketLocation: AgriculturalMarket | undefined;
  amountMode: AmountMode;
  usdPreviewAmount: string;
  amount: string;
  amountBase: string | null;
  quote: ProtectionQuote | null;
  quoteError: string | null;
  quotePaymentReason: string | null;
  unavailableReason: string | null;
  claimReadiness: ClaimReadiness | null;
  claimError: string | null;
  transactionBusy: boolean;
  transactionMessage: string | null;
  transactionError: string | null;
  transactionSignature: string | null;
  walletConnected: boolean;
  onAmountModeChange: (mode: AmountMode) => void;
  onUsdPreviewChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onRequestQuote: () => void;
  onApprove: () => void;
  onClaim: () => void;
  onRefresh: () => void;
  onOpenWallet: () => void;
  onExplore: () => void;
}) {
  const [verificationOpen, setVerificationOpen] = useState(false);
  if (props.selectedHazard !== "rainfall" || props.selectedCity !== "des-moines") {
    const location = props.marketLocation
      ? `${props.marketLocation.locality}, ${props.marketLocation.administrativeArea}, ${props.marketLocation.country}`
      : props.selectedCity === "toronto" ? "Toronto, Ontario, Canada" : props.selectedCity === "saskatoon" ? "Saskatoon, Saskatchewan, Canada" : null;
    const title = !location || !props.selectedHazard ? "Choose a place and weather risk" : `${hazardPresentation(props.selectedHazard).label} protection is not available here`;
    const detail = location && props.selectedHazard
      ? riskChoiceForArea(props.selectedCity, props.selectedHazard).detail
      : "Start in Explore. Select the place first, then the weather risk that matters to you.";
    return <View style={styles.protectCard}>
      <Text style={styles.kicker}>Protection status</Text>
      <Text style={styles.protectPlace}>{title}</Text>
      {location ? <Text style={styles.protectLocation}>{location}</Text> : null}
      <Text style={styles.protectBlocked}>{detail} No quote, payment, or transaction is prepared for this selection.</Text>
      <ActionButton label="Explore places" icon="map-pin" onPress={props.onExplore} />
    </View>;
  }
  const market = props.status?.desMoinesMarket;
  const isPilot = props.selectedCity === "des-moines";
  const threshold = market?.thresholdMmX100 ? Number(market.thresholdMmX100) / 100 : null;
  const windowStart = market?.observationStart ? new Date(market.observationStart * 1_000).toISOString().slice(0, 10) : null;
  const windowEnd = market?.observationEnd ? new Date(market.observationEnd * 1_000).toISOString().slice(0, 10) : null;
  const marketOpen = isPilot && !!market?.address && market.status === "ready" && isOnchainMarketOpen(market.onchainStatus);
  const evidenceReady = isPilot && market?.evidenceStatus === "validated" && !!market.targetCityHash && props.status?.noaaEvidence.status === "ready";
  const usdPreview = formatUsdPreview(props.usdPreviewAmount);
  const checks = [
    { ready: !!props.status?.program.executable && props.status.program.status === "ready", label: "Solana program executable" },
    { ready: props.status?.idl.status === "ready", label: "Program instructions available" },
    { ready: !!props.status?.protocol.initialized, label: "Protocol initialized" },
    { ready: marketOpen, label: "Des Moines market open" },
    { ready: evidenceReady, label: "NOAA station package pinned" },
    { ready: !!market?.vaultBalance && /^\d+$/.test(market.vaultBalance) && BigInt(market.vaultBalance) > 0n, label: "SKYT vault funded" },
  ];
  const readyChecks = checks.filter((check) => check.ready).length;
  const vaultFunded = checks[5].ready;
  const needsWallet = props.unavailableReason?.startsWith("Connect your Devnet wallet");
  const stage = (ready: boolean, label: string) => (
    <View key={label} style={styles.evidenceStep}>
      <View style={[styles.evidenceDot, ready ? styles.evidenceDotReady : styles.evidenceDotPending]} />
      <Text style={styles.evidenceStepText}>{label}</Text>
      <Text style={[styles.evidenceStepState, ready ? styles.readyText : styles.pendingText]}>{ready ? "Verified" : "Pending"}</Text>
    </View>
  );
  return (
    <>
      <View style={styles.protectCard}>
        <View style={styles.protectHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabelLight}>Rainfall protection</Text>
            <Text style={styles.protectPlace}>{props.marketLocation?.name ?? props.marketLocation?.locality ?? (isPilot ? "Des Moines crop belt" : props.selectedCity)}</Text>
            <Text style={styles.protectLocation}>{props.marketLocation ? `${props.marketLocation.locality}, ${props.marketLocation.administrativeArea}, ${props.marketLocation.country}` : "Location evidence is not available in this mobile data feed."}</Text>
          </View>
          <StatusPill label={isPilot ? (marketOpen ? "Open" : formatOnchainMarketStatus(market?.onchainStatus ?? null)) : "Research"} tone={marketOpen ? "ready" : "pending"} />
        </View>
        <View style={styles.sourceLine}>
          <AppIcon name="database" color={evidenceReady ? C.blue : C.amber} size={17} />
          <Text style={styles.sourceText}>{evidenceReady ? `NOAA station package ready${props.status?.noaaEvidence.package?.stationId ? ` · ${props.status.noaaEvidence.package.stationId}` : ""}` : market?.evidenceStatus === "validated" ? "Pinned NOAA package temporarily unavailable" : "NOAA station validation pending"}</Text>
        </View>
        {isPilot && market?.observationStart && market?.observationEnd ? (
          <View style={styles.triggerPanel}>
            <Text style={styles.triggerLabel}>Protection trigger</Text>
            <Text style={styles.triggerValue}>{threshold == null ? "Final terms pending" : `Rainfall ${market?.operator === "lt" || market?.operator === "lte" ? "at or below" : "at or above"} ${threshold.toFixed(2)} mm`}</Text>
            <Text style={styles.triggerWindow}>NOAA observation · {windowStart} to {windowEnd} UTC</Text>
          </View>
        ) : (
          <Text style={styles.protectBlocked}>Only Des Moines is eligible for the Devnet pilot. Other catalog locations remain research-only; selecting them cannot produce a quote or transaction.</Text>
        )}
        {props.amountMode === "usd-preview" ? <>
          <View style={styles.amountHeading}><Text style={styles.inputLabel}>Protection amount · USD preview</Text></View>
          <TextInput
            accessibilityLabel="Protection amount in US dollars, non-binding preview"
            accessibilityHint="This is not a payable quote. USD checkout is unavailable."
            value={props.usdPreviewAmount}
            onChangeText={props.onUsdPreviewChange}
            keyboardType="decimal-pad"
            style={styles.amountInput}
            placeholder="$100"
            placeholderTextColor={C.muted}
          />
          <Text style={styles.inputHint}>{usdPreview ? `${usdPreview} is a non-binding protection preview.` : "Enter a positive dollar amount for a non-binding preview."} No USD premium or payout is quoted, and USD checkout is unavailable.</Text>
          <View style={styles.actionWrap}><ActionButton label="Try on Devnet" icon="arrow-right" onPress={() => props.onAmountModeChange("devnet-test")} /></View>
          <Text style={styles.testDisclosure}>The Devnet test uses a separate SKYT amount. It is not USD or USDC, and no exchange rate is implied.</Text>
          {!marketOpen || !vaultFunded ? <Text accessibilityRole="alert" style={styles.previewBlocker}>Devnet testing is not ready: the on-chain market is {formatOnchainMarketStatus(market?.onchainStatus ?? null)}{vaultFunded ? "." : " and its test collateral vault is empty."}</Text> : null}
        </> : <>
          <Pressable accessibilityRole="button" accessibilityLabel="Return to USD preview" onPress={() => props.onAmountModeChange("usd-preview")} style={styles.modeBack}><AppIcon name="arrow-left" color={C.blue} size={16} /><Text style={styles.modeBackText}>USD preview</Text></Pressable>
          <Text style={styles.testModeHeading}>Try on Devnet</Text>
          <Text style={styles.testModeNote}>SKYT is a test token with no real-world value. It is not USDC. Your wallet must approve any test transaction.</Text>
          <View style={styles.amountHeading}><Text style={styles.inputLabel}>Test protection amount</Text><Text style={styles.amountUnit}>SKYT test tokens</Text></View>
          <TextInput
            accessibilityLabel="Test protection amount in SKYT"
            accessibilityHint="Maximum 500 SKYT per wallet. This amount is separate from the USD preview."
            value={props.amount}
            onChangeText={props.onAmountChange}
            keyboardType="decimal-pad"
            style={styles.amountInput}
            editable={isPilot}
            placeholder="Enter SKYT amount"
            placeholderTextColor={C.muted}
          />
          <Text style={styles.inputHint}>{props.amountBase ? `${formatSkyt(props.amountBase)} SKYT · maximum 500 SKYT per wallet` : "Enter a positive test amount up to 500 SKYT, with up to six decimal places."}</Text>
          {!props.quote ? (
            <View style={styles.actionWrap}><ActionButton label={needsWallet ? "Connect Devnet wallet" : "Get NOAA quote in SKYT"} icon={needsWallet ? "credit-card" : "arrow-right"} disabled={!needsWallet && !!props.unavailableReason} busy={props.transactionBusy} onPress={needsWallet ? props.onOpenWallet : props.onRequestQuote} /></View>
          ) : (
          <Reveal><View style={styles.quoteCard}>
            <View style={styles.quoteHead}><AppIcon name="file-text" color={C.purple} size={18} /><Text style={styles.quoteTitle}>NOAA-based quote</Text></View>
            <MetricRow label="Chance of trigger" value={`${(props.quote.probabilityBps / 100).toFixed(2)}%`} />
            <MetricRow label="Premium · total charged" value={`${formatSkyt(props.quote.premium)} SKYT`} />
            <MetricRow label="Protocol fee" value={`${formatSkyt(props.quote.protocolFee)} SKYT`} />
            <MetricRow label="Inputs hash" value={`${props.quote.inputsHash.slice(0, 12)}…`} />
            <Text style={styles.quoteWarning}>The protocol fee is included in the total premium above. This is a Devnet test position, not insurance or a real-money product. Your wallet will show the transaction before it is sent.</Text>
            {props.quotePaymentReason ? <View accessibilityRole="alert" style={styles.blockedNotice}><Text style={styles.blockedTitle}>Not enough SKYT for the premium</Text><Text style={styles.blockedBody}>{props.quotePaymentReason}</Text></View> : null}
            <View style={styles.actionWrap}><ActionButton label="Review in wallet" icon="arrow-right" disabled={!!props.quotePaymentReason || !!props.unavailableReason} busy={props.transactionBusy} onPress={props.onApprove} /></View>
          </View></Reveal>
          )}
          {props.unavailableReason && !needsWallet ? <View accessibilityRole="alert" style={styles.blockedNotice}><AppIcon name="alert-circle" color={C.amber} size={18} /><View style={styles.blockedCopy}><Text style={styles.blockedTitle}>Waiting for market readiness</Text><Text style={styles.blockedBody}>{props.unavailableReason}</Text><Pressable accessibilityRole="button" onPress={props.onRefresh} style={styles.inlineRetry}><Text style={styles.inlineRetryText}>Refresh status</Text></Pressable></View></View> : null}
          {props.quoteError ? <View accessibilityRole="alert" style={styles.actionError}><Text style={styles.blockedTitle}>Quote unavailable</Text><Text style={styles.blockedBody}>{props.quoteError}</Text></View> : null}
        </>}
        {props.transactionMessage ? <Text accessibilityLiveRegion="polite" style={styles.actionProgress}>{props.transactionMessage}</Text> : null}
        {props.transactionError ? <View accessibilityRole="alert" style={styles.actionError}><Text style={styles.blockedTitle}>Transaction not finalized</Text><Text style={styles.blockedBody}>{props.transactionError}</Text></View> : null}
        {props.transactionSignature ? <Reveal><View style={styles.signatureCard}><View style={styles.proofHeading}><AppIcon name="check-circle" color={C.green} size={23} /><Text style={styles.signatureTitle}>Finalized on Solana Devnet</Text></View><Text style={styles.signatureText}>{props.transactionSignature}</Text><ExplorerLink signature={props.transactionSignature} /></View></Reveal> : null}
      </View>

      <View style={styles.proofRail} accessibilityLabel="Protection progress">
        <Text style={[styles.proofStep, evidenceReady && styles.proofStepActive]}>Evidence</Text><View style={styles.proofConnector} />
        <Text style={[styles.proofStep, !!props.quote && styles.proofStepActive]}>Quote</Text><View style={styles.proofConnector} />
        <Text style={[styles.proofStep, props.transactionBusy && styles.proofStepActive]}>Wallet</Text><View style={styles.proofConnector} />
        <Text style={[styles.proofStep, !!props.transactionSignature && styles.proofStepActive]}>Proof</Text>
      </View>

      <View style={styles.verificationCard}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: verificationOpen }} accessibilityLabel={`Verification details, ${readyChecks} of ${checks.length} checks verified`} onPress={() => setVerificationOpen((open) => !open)} style={styles.verificationButton}>
          <AppIcon name="shield" color={C.purple} size={20} />
          <View style={styles.verificationText}><Text style={styles.verificationTitle}>Verification details</Text><Text style={styles.verificationSummary}>{readyChecks} of {checks.length} Devnet checks verified</Text></View>
          <AppIcon name={verificationOpen ? "chevron-up" : "chevron-down"} color={C.muted} size={20} />
        </Pressable>
        {verificationOpen ? <View style={styles.verificationBody}>
          {checks.map((check) => stage(check.ready, check.label))}
          {isPilot && market ? <><MetricRow label="Market state" value={formatOnchainMarketStatus(market.onchainStatus)} /><MetricRow label="Sales close" value={market.salesCloseAt ? new Date(market.salesCloseAt * 1_000).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "Not finalized"} /><MetricRow label="Settlement source" value="NOAA final observations" /></> : null}
        </View> : null}
      </View>

      {isPilot ? <View style={styles.portfolioCard}>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Your position</Text><Text style={styles.sectionMeta}>{props.claimReadiness?.state ?? "Not available"}</Text></View>
        {props.claimReadiness ? (
          <>
            <Text style={styles.claimReason}>{props.claimReadiness.reason}</Text>
            {props.claimReadiness.observation ? <MetricRow label="Verified rainfall" value={`${(Number(props.claimReadiness.observation.rainfallMmX100) / 100).toFixed(2)} mm · NOAA`} /> : null}
            {props.claimReadiness.state === "claimable" ? <View style={styles.actionWrap}><ActionButton label={props.claimReadiness.action === "claim_payout" ? "Review payout claim" : "Review premium refund"} icon="arrow-right" busy={props.transactionBusy} onPress={props.onClaim} /></View> : null}
            {props.claimReadiness.resolutionSignature ? <ExplorerLink signature={props.claimReadiness.resolutionSignature} label="Open finalized settlement proof" /> : null}
          </>
        ) : <Text style={styles.emptyText}>{props.walletConnected ? props.claimError ?? (props.status?.desMoinesMarket.address ? "Checking this wallet’s finalized position and claim status." : "A claim appears here only after finalized on-chain settlement or DATA_UNAVAILABLE status.") : "Connect your wallet to view a finalized position or claim."}</Text>}
      </View> : null}
    </>
  );
}

function ExplorerLink({ signature, label = "View finalized transaction in Solana Explorer" }: { signature: string; label?: string }) {
  const url = `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet`;
  return <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => { void Linking.openURL(url); }} style={styles.explorerLink}><Text style={styles.explorerLinkText}>{label}</Text></Pressable>;
}

function WalletScreen({
  wallet,
  portfolio,
  walletBalances,
  portfolioError,
  walletError,
  loading,
  onConnect,
  onDisconnect,
}: {
  wallet: string | null;
  portfolio: Portfolio | null;
  walletBalances: FinalizedWalletState | null;
  portfolioError: string | null;
  walletError: string | null;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <>
      <Text style={styles.kicker}>Devnet wallet</Text>
      <Text style={styles.title}>Your account</Text>
      <Text style={styles.intro}>Connect a compatible Solana wallet on this Android device. Your keys remain in your wallet.</Text>
      <View style={styles.walletCard}>
        {walletError ? <View accessibilityRole="alert" style={styles.walletAlert}><Text style={styles.errorTitle}>Wallet not connected</Text><Text style={styles.errorBody}>{walletError}</Text></View> : null}
        <Text style={styles.walletTitle}>{wallet ? "Wallet connected" : "Connect a Devnet wallet"}</Text>
        <Text style={styles.walletAddress}>{wallet ? shorten(wallet) : "No account shared"}</Text>
        {wallet ? (
          <Pressable accessibilityRole="button" onPress={onDisconnect} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Disconnect</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" disabled={loading} onPress={onConnect} style={[styles.primaryButton, loading && styles.disabledButton]}>
            {loading ? <ActivityIndicator color={C.white} /> : <Text style={styles.primaryButtonText}>Connect wallet</Text>}
          </Pressable>
        )}
        <Text style={styles.walletHint}>Your wallet asks before sharing its public address. SkyHedge uses it only to read Devnet balances and indexed positions.</Text>
      </View>

      {wallet ? (
        <View style={styles.portfolioCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Finalized Devnet balances</Text>
            <Text style={styles.sectionMeta}>{walletBalances ? `Slot ${walletBalances.slot}` : "Live RPC"}</Text>
          </View>
          {walletBalances ? (
            <>
              <MetricRow label="SOL" value={walletBalances.sol.toFixed(4)} />
              <MetricRow label="SKYT · test asset" value={(Number(walletBalances.skytBaseUnits) / 10 ** walletBalances.skytDecimals).toLocaleString()} />
            </>
          ) : <Text style={styles.emptyText}>Finalized balance read unavailable. No balance is estimated.</Text>}
        </View>
      ) : null}

      {wallet ? (
        <View style={styles.portfolioCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Positions</Text>
            <Text style={styles.sectionMeta}>{portfolio?.indexed ? "Finalized index" : "Index pending"}</Text>
          </View>
          {portfolio?.indexed ? (
            <>
              <MetricRow label="Protection positions" value={String(portfolio.protections.length)} />
              <MetricRow label="Liquidity positions" value={String(portfolio.liquidity.length)} />
            </>
          ) : <Text style={styles.emptyText}>{portfolioError ?? portfolio?.message ?? "Finalized positions are not available from the indexer yet."}</Text>}
          {portfolio?.indexed ? <Text style={styles.portfolioFoot}>{portfolio.message ?? "Positions reflect finalized state."}</Text> : null}
        </View>
      ) : null}

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Finalized reads only</Text>
        <Text style={styles.noteBody}>Balances are read directly from finalized Devnet. Position counts appear only when finalized position data is indexed; SkyHedge never turns missing data into zero.</Text>
      </View>
    </>
  );
}

function TabButton({ label, icon, selected, onPress }: { label: string; icon: AppIconName; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} android_ripple={{ color: C.purpleSoft }} style={[styles.tabButton, selected && styles.tabButtonSelected]}>
      <AppIcon name={icon} color={selected ? C.green : C.quiet} size={21} />
      <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{label}</Text>
    </Pressable>
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
      <Text style={styles.errorBody}>{readableMessage}</Text>
      <View style={styles.errorActions}>
        <Text style={styles.errorFoot}>No weather or market values are estimated.</Text>
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
  header: { minHeight: 62, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, backgroundColor: C.canvas, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  brandMark: { width: 36, height: 36, borderRadius: 11, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center" },
  brandCopy: { marginLeft: 10, flex: 1 },
  brand: { color: C.ink, fontFamily: F.headingBold, fontSize: 18, letterSpacing: -0.4 },
  brandSub: { color: C.quiet, fontFamily: F.bodyMedium, fontSize: 10, marginTop: 1 },
  scrollContent: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 18, paddingTop: 18, paddingBottom: 32 },
  screenLead: { marginBottom: 18 },
  kicker: { color: C.purple, fontFamily: F.bodySemi, fontSize: 12, marginBottom: 5 },
  title: { color: C.ink, fontFamily: F.headingBold, fontSize: 27, lineHeight: 33, letterSpacing: -0.8 },
  intro: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 22 },
  journeyRail: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18 },
  journeyStep: { color: C.quiet, fontFamily: F.bodyMedium, fontSize: 12 },
  journeyStepActive: { color: C.green, fontFamily: F.bodySemi, fontSize: 12 },
  journeyRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.border },
  chosenHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  chosenCopy: { flex: 1 },
  chosenContext: { color: C.muted, fontFamily: F.body, fontSize: 13, lineHeight: 20, marginTop: 7 },
  changePlace: { minWidth: 60, minHeight: 48, alignItems: "flex-end", justifyContent: "center" },
  changePlaceText: { color: C.blue, fontFamily: F.bodySemi, fontSize: 14, textDecorationLine: "underline" },
  chosenPrompt: { color: C.muted, fontFamily: F.body, fontSize: 14, lineHeight: 21, marginTop: 16 },
  riskSegments: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border },
  riskSegment: { flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  riskSegmentSelected: { borderBottomWidth: 2, borderBottomColor: C.green },
  riskSegmentText: { color: C.muted, fontFamily: F.bodyMedium, fontSize: 13, textAlign: "center" },
  riskSegmentTextSelected: { color: C.ink, fontFamily: F.bodySemi },
  outcomeSection: { paddingTop: 24 },
  outcomeSummary: { color: C.muted, fontFamily: F.body, fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 14 },
  outcomeFacts: { marginTop: 8 },
  cityRail: { gap: 8, paddingBottom: 16 },
  cityChip: { minHeight: 48, paddingHorizontal: 15, justifyContent: "center", borderWidth: 1, borderColor: C.border, borderRadius: 16, backgroundColor: C.surface },
  cityChipSelected: { borderColor: C.purple, backgroundColor: C.purpleSoft },
  cityChipText: { color: C.ink, fontFamily: F.bodyMedium, fontSize: 13 },
  cityChipTextSelected: { color: C.white },
  heroCard: { backgroundColor: C.surface, borderRadius: 14, padding: 20, overflow: "hidden" },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroLabel: { color: C.blue, fontFamily: F.bodySemi, fontSize: 12 },
  heroPlace: { color: C.white, fontFamily: F.headingBold, fontSize: 22, marginTop: 6 },
  heroSub: { color: C.muted, fontSize: 12, marginTop: 5 },
  indexBadge: { backgroundColor: C.greenSoft, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },
  indexBadgeText: { color: C.green, fontFamily: F.bodySemi, fontSize: 11 },
  indexBadgeUnavailable: { backgroundColor: C.amberSoft },
  indexBadgeUnavailableText: { color: C.amber },
  rainValueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 18 },
  rainValue: { color: C.white, fontFamily: F.headingBold, fontSize: 52, lineHeight: 62, letterSpacing: -1.8, fontVariant: ["tabular-nums"] },
  rainUnit: { color: C.muted, fontSize: 18, marginLeft: 8 },
  rainCaption: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 2 },
  windowRow: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 18, paddingTop: 13, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
  windowLabel: { color: C.quiet, fontSize: 11 },
  windowDates: { color: C.white, fontFamily: F.bodySemi, fontSize: 11 },
  sectionHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 5, marginTop: 23, marginBottom: 11 },
  sectionTitle: { color: C.ink, fontFamily: F.heading, fontSize: 19 },
  sectionMeta: { color: C.quiet, fontSize: 11 },
  chartCard: { flexDirection: "row", minHeight: 150, alignItems: "stretch", justifyContent: "space-between", gap: 7, backgroundColor: C.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.border, paddingHorizontal: 4, paddingTop: 16, paddingBottom: 12 },
  loadingPanel: { minHeight: 110, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 17, padding: 18, marginBottom: 14 },
  barColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  barValue: { color: C.muted, fontSize: 10, marginBottom: 5, fontVariant: ["tabular-nums"] },
  barTrack: { flex: 1, width: 19, maxHeight: 85, justifyContent: "flex-end", backgroundColor: C.mutedSurface, borderRadius: 8, overflow: "hidden" },
  barFill: { width: "100%", backgroundColor: C.blue, borderRadius: 8 },
  barUnknown: { width: "100%", height: 2, backgroundColor: C.border, marginTop: "auto" },
  barDate: { color: C.quiet, fontSize: 10, marginTop: 5 },
  emptyText: { color: C.muted, fontSize: 13, lineHeight: 20 },
  noteCard: { backgroundColor: C.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingVertical: 17, marginTop: 17 },
  noteEyebrow: { color: C.blue, fontFamily: F.bodySemi, fontSize: 11, marginBottom: 5 },
  noteTitle: { color: C.ink, fontFamily: F.heading, fontSize: 16 },
  noteBody: { color: C.muted, fontSize: 12, lineHeight: 19, marginTop: 5 },
  secondaryAction: { minHeight: 72, justifyContent: "center", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 15, paddingHorizontal: 15, paddingVertical: 12, marginTop: 13 },
  secondaryActionTitle: { color: C.ink, fontFamily: F.bodySemi, fontSize: 13 },
  secondaryActionBody: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  releaseCard: { backgroundColor: C.amberSoft, borderRadius: 16, padding: 15, marginTop: 15, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  releaseIcon: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: C.amber, alignItems: "center", justifyContent: "center" },
  releaseIconText: { color: C.amber, fontSize: 13, fontWeight: "700" },
  releaseCopy: { flex: 1 },
  releaseTitle: { color: C.ink, fontFamily: F.bodySemi, fontSize: 13 },
  releaseBody: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  searchWrap: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 13, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  exampleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, marginBottom: 18 },
  exampleButton: { flexGrow: 1, minWidth: 100, minHeight: 48, justifyContent: "center", alignItems: "center", paddingHorizontal: 10, borderWidth: 1, borderColor: C.border, borderRadius: 9, backgroundColor: C.surface },
  exampleText: { color: C.ink, fontFamily: F.bodySemi, fontSize: 12, textAlign: "center" },
  selectionPrompt: { color: C.ink, fontFamily: F.bodySemi, fontSize: 15, lineHeight: 22, marginTop: 25, marginBottom: 10 },
  guideToggle: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, marginTop: 7 },
  guideToggleText: { flex: 1, color: C.blue, fontFamily: F.bodySemi, fontSize: 14 },
  catalogFootnote: { color: C.muted, fontFamily: F.body, fontSize: 12, lineHeight: 19, marginTop: 20 },
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
  marketName: { color: C.ink, fontFamily: F.heading, fontSize: 16 },
  marketPlace: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  researchPill: { paddingHorizontal: 9, paddingVertical: 6, backgroundColor: C.amberSoft, borderRadius: 20 },
  researchPillText: { color: C.amber, fontFamily: F.bodySemi, fontSize: 11 },
  marketContext: { color: C.ink, fontSize: 13, lineHeight: 19, marginTop: 14 },
  marketCrops: { color: C.muted, fontFamily: F.bodyMedium, fontSize: 11, marginTop: 8, textTransform: "capitalize" },
  marketFoot: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, marginTop: 11, color: C.muted, fontSize: 11, lineHeight: 17 },
  hazardRail: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 13 },
  hazardChip: { minHeight: 48, paddingHorizontal: 14, justifyContent: "center", borderWidth: 1, borderColor: C.border, borderRadius: 16, backgroundColor: C.surface },
  hazardChipSelected: { borderColor: C.purple, backgroundColor: C.purpleSoft },
  hazardChipText: { color: C.ink, fontFamily: F.bodyMedium, fontSize: 13 },
  hazardChipTextSelected: { color: C.white },
  hazardCard: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 7 },
  miniHistory: { marginTop: 18, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  miniHistoryTitle: { color: C.ink, fontFamily: F.bodySemi, fontSize: 13, marginBottom: 10 },
  miniChart: { flexDirection: "row", minHeight: 120, justifyContent: "space-between", gap: 6 },
  miniBarTrack: { maxHeight: 72, width: 22 },
  miniHistoryNote: { color: C.quiet, fontSize: 11, lineHeight: 17, marginTop: 8 },
  hazardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  hazardTitle: { color: C.ink, fontFamily: F.heading, fontSize: 17 },
  hazardNote: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  hazardBlocked: { color: C.amber, fontFamily: F.bodySemi, fontSize: 11, marginTop: 9 },
  walletCard: { backgroundColor: C.surface, borderRadius: 14, alignItems: "flex-start", padding: 20, marginTop: 4 },
  walletOrb: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.purpleSoft, justifyContent: "center", alignItems: "center" },
  walletTitle: { color: C.ink, fontFamily: F.heading, fontSize: 20 },
  walletAddress: { color: C.muted, fontSize: 12, marginTop: 5, fontVariant: ["tabular-nums"] },
  primaryButton: { minHeight: 52, width: "100%", alignItems: "center", justifyContent: "center", backgroundColor: C.green, borderRadius: 14, marginTop: 18 },
  primaryButtonText: { color: C.actionText, fontFamily: F.bodyBold, fontSize: 14 },
  disabledButton: { opacity: 0.65 },
  secondaryButton: { minHeight: 48, minWidth: 150, alignItems: "center", justifyContent: "center", borderColor: C.border, borderWidth: 1, borderRadius: 13, marginTop: 18 },
  secondaryButtonText: { color: C.ink, fontFamily: F.bodySemi, fontSize: 13 },
  walletHint: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 14 },
  portfolioCard: { backgroundColor: C.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingVertical: 14, marginTop: 16 },
  evidenceStep: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingVertical: 9 },
  evidenceDot: { width: 9, height: 9, borderRadius: 5 },
  evidenceDotReady: { backgroundColor: C.green },
  evidenceDotPending: { backgroundColor: C.amber },
  evidenceStepText: { color: C.ink, fontSize: 12, flex: 1 },
  evidenceStepState: { fontFamily: F.bodySemi, fontSize: 11 },
  readyText: { color: C.green },
  pendingText: { color: C.amber },
  protectCard: { backgroundColor: C.canvas, paddingTop: 4, paddingBottom: 12 },
  protectHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 14 },
  heroLabelLight: { color: C.purple, fontFamily: F.bodySemi, fontSize: 12 },
  protectPlace: { color: C.ink, fontFamily: F.headingBold, fontSize: 23, lineHeight: 28, marginTop: 4 },
  protectLocation: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  sourceLine: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sourceText: { color: C.muted, fontSize: 12, lineHeight: 17, flex: 1 },
  triggerPanel: { backgroundColor: C.surface, borderRadius: 10, padding: 15, marginBottom: 20 },
  triggerLabel: { color: C.muted, fontSize: 11, marginBottom: 3 },
  triggerValue: { color: C.white, fontFamily: F.heading, fontSize: 17, lineHeight: 22 },
  triggerWindow: { color: C.muted, fontSize: 11, marginTop: 5 },
  protectBlocked: { color: C.amber, backgroundColor: C.amberSoft, borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 18, marginBottom: 16 },
  amountHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 },
  inputLabel: { color: C.ink, fontFamily: F.bodySemi, fontSize: 13 },
  amountUnit: { color: C.quiet, fontSize: 11 },
  amountInput: { minHeight: 52, borderWidth: 1, borderColor: C.border, borderRadius: 13, backgroundColor: C.canvas, color: C.ink, paddingHorizontal: 14, fontFamily: F.heading, fontSize: 20, fontVariant: ["tabular-nums"] },
  inputHint: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 6 },
  actionWrap: { marginTop: 16 },
  testDisclosure: { color: C.quiet, fontSize: 11, textAlign: "center", marginTop: 10 },
  previewBlocker: { color: C.amber, fontFamily: F.bodyMedium, fontSize: 13, lineHeight: 19, marginTop: 12 },
  modeBack: { minHeight: 48, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 4, paddingRight: 12 },
  modeBackText: { color: C.blue, fontFamily: F.bodySemi, fontSize: 13 },
  testModeHeading: { color: C.ink, fontFamily: F.heading, fontSize: 18, marginBottom: 5 },
  testModeNote: { color: C.muted, fontSize: 12, lineHeight: 19, marginBottom: 16 },
  quoteCard: { borderWidth: 1, borderColor: C.border, borderRadius: 15, backgroundColor: C.surfaceRaised, padding: 13, marginTop: 16 },
  quoteHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  quoteTitle: { color: C.ink, fontFamily: F.heading, fontSize: 16 },
  quoteWarning: { color: C.amber, fontSize: 11, lineHeight: 17, marginTop: 11 },
  blockedNotice: { backgroundColor: C.amberSoft, borderRadius: 12, padding: 12, marginTop: 14, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  blockedCopy: { flex: 1 },
  blockedTitle: { color: C.amber, fontFamily: F.bodySemi, fontSize: 12 },
  blockedBody: { color: C.ink, fontSize: 11, lineHeight: 17, marginTop: 4 },
  inlineRetry: { minHeight: 44, alignSelf: "flex-start", justifyContent: "center", marginTop: 5, paddingRight: 8 },
  inlineRetryText: { color: C.blue, fontFamily: F.bodySemi, fontSize: 12 },
  actionError: { backgroundColor: C.redSoft, borderColor: C.red, borderWidth: 1, borderRadius: 11, padding: 12, marginTop: 12 },
  actionProgress: { color: C.blue, fontFamily: F.bodyMedium, fontSize: 12, marginTop: 13 },
  signatureCard: { backgroundColor: C.greenSoft, borderColor: C.green, borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 16 },
  proofHeading: { flexDirection: "row", alignItems: "center", gap: 9 },
  signatureTitle: { color: C.green, fontFamily: F.heading, fontSize: 15 },
  signatureText: { color: C.muted, fontSize: 10, lineHeight: 16, marginTop: 8, fontVariant: ["tabular-nums"] },
  explorerLink: { minHeight: 48, alignSelf: "flex-start", justifyContent: "center", paddingRight: 7 },
  explorerLinkText: { color: C.blue, fontFamily: F.bodySemi, fontSize: 12, textDecorationLine: "underline" },
  proofRail: { flexDirection: "row", alignItems: "center", marginTop: 22, marginBottom: 4, paddingHorizontal: 2 },
  proofStep: { color: C.quiet, fontFamily: F.bodyMedium, fontSize: 10 },
  proofStepActive: { color: C.green },
  proofConnector: { flex: 1, height: 1, backgroundColor: C.border, marginHorizontal: 5 },
  verificationCard: { backgroundColor: C.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, marginTop: 19 },
  verificationButton: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 15 },
  verificationText: { flex: 1 },
  verificationTitle: { color: C.ink, fontFamily: F.bodySemi, fontSize: 13 },
  verificationSummary: { color: C.muted, fontSize: 11, marginTop: 3 },
  verificationBody: { paddingHorizontal: 15, paddingBottom: 9 },
  claimReason: { color: C.muted, fontSize: 12, lineHeight: 18 },
  metricRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10, borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 12 },
  metricLabel: { color: C.muted, fontSize: 12, flex: 1 },
  metricValue: { color: C.ink, fontFamily: F.bodySemi, fontSize: 12, maxWidth: "58%", textAlign: "right", fontVariant: ["tabular-nums"] },
  portfolioFoot: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  errorBanner: { backgroundColor: C.redSoft, borderWidth: 1, borderColor: C.red, borderRadius: 15, padding: 14, marginBottom: 18 },
  errorTitle: { color: C.red, fontFamily: F.bodySemi, fontSize: 13 },
  errorBody: { color: C.ink, fontSize: 12, lineHeight: 18, marginTop: 4 },
  errorFoot: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 6 },
  errorActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  retryButton: { minHeight: 48, justifyContent: "center", paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.surface, borderColor: C.border, borderWidth: 1 },
  retryButtonText: { color: C.ink, fontFamily: F.bodySemi, fontSize: 12 },
  walletAlert: { width: "100%", backgroundColor: C.redSoft, borderColor: C.red, borderWidth: 1, borderRadius: 13, padding: 12, marginBottom: 16 },
  emptyState: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 18, padding: 18, marginTop: 8 },
  emptyTitle: { color: C.ink, fontFamily: F.heading, fontSize: 17, marginBottom: 6 },
  bottomBar: { minHeight: 78, flexDirection: "row", justifyContent: "space-around", alignItems: "center", backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: 10, paddingHorizontal: 8 },
  tabButton: { flex: 1, minWidth: 0, minHeight: 58, alignItems: "center", justifyContent: "center", borderRadius: 12, paddingHorizontal: 2 },
  tabButtonSelected: { backgroundColor: C.greenSoft },
  tabLabel: { color: C.quiet, fontFamily: F.bodyMedium, fontSize: 11, marginTop: 5 },
  tabLabelSelected: { color: C.green, fontFamily: F.bodySemi },
});
