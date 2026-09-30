import "./src/polyfills";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AgriculturalMarket, CityIndex, DevnetStatus, FinalizedWalletState, getApiHost, getJson, Portfolio } from "./src/api";
import { readFinalizedWalletState } from "./src/chain";
import { hazardPresentation, listHazards, type HazardId } from "./src/hazards";
import { authorizeDevnetWallet } from "./src/wallet";

type Tab = "weather" | "catalog" | "wallet";

const C = {
  canvas: "#F5F7F4",
  white: "#FFFFFF",
  mutedSurface: "#EDF3F1",
  ink: "#102A3A",
  muted: "#536673",
  border: "#D8E1DE",
  blue: "#0878B9",
  blueSoft: "#E8F4FA",
  green: "#287A55",
  greenSoft: "#EAF3ED",
  amber: "#8A5800",
  amberSoft: "#FFF2D8",
  red: "#B42318",
};

const CITY_ORDER = ["des-moines", "chicago", "new-york", "miami"];

export default function App() {
  const [tab, setTab] = useState<Tab>("weather");
  const [cities, setCities] = useState<CityIndex[]>([]);
  const [catalog, setCatalog] = useState<AgriculturalMarket[]>([]);
  const [status, setStatus] = useState<DevnetStatus | null>(null);
  const [selectedCity, setSelectedCity] = useState("des-moines");
  const [city, setCity] = useState<CityIndex | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [walletBalances, setWalletBalances] = useState<FinalizedWalletState | null>(null);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHome = useCallback(async () => {
    setError(null);
    const results = await Promise.allSettled([
      getJson<{ cities: CityIndex[] }>("/api/cities"),
      getJson<{ markets: AgriculturalMarket[] }>("/api/agricultural-markets"),
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
      const current = ordered.find((item) => item.slug === selectedCity) ?? ordered[0];
      setSelectedCity(current?.slug ?? selectedCity);
      setCity(current ?? null);
    } else {
      setError(cityResult.reason instanceof Error ? cityResult.reason.message : "Could not load NOAA index data.");
    }
    if (catalogResult.status === "fulfilled") setCatalog(catalogResult.value.markets);
    if (statusResult.status === "fulfilled") setStatus(statusResult.value);
  }, [selectedCity]);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  useEffect(() => {
    if (!selectedCity) return;
    let cancelled = false;
    getJson<CityIndex>(`/api/cities/${selectedCity}`)
      .then((details) => { if (!cancelled) setCity(details); })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load this NOAA index.");
      });
    return () => { cancelled = true; };
  }, [selectedCity]);

  const loadWalletData = useCallback(async (address: string) => {
    const [balanceResult, portfolioResult] = await Promise.allSettled([
      readFinalizedWalletState(address),
      getJson<Portfolio>(`/api/portfolio/${address}`),
    ]);
    setWalletBalances(balanceResult.status === "fulfilled" ? balanceResult.value : null);
    setPortfolio(portfolioResult.status === "fulfilled" ? portfolioResult.value : null);
    setPortfolioError(portfolioResult.status === "rejected"
      ? portfolioResult.reason instanceof Error ? portfolioResult.reason.message : "Portfolio indexing is unavailable."
      : null);
  }, []);

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
    setError(null);
    try {
      const address = await authorizeDevnetWallet();
      setWallet(address);
      await loadWalletData(address);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Wallet connection did not complete.");
    } finally {
      setLoading(false);
    }
  }, [loadWalletData]);

  const changeCity = (slug: string) => {
    setSelectedCity(slug);
    const next = cities.find((item) => item.slug === slug) ?? null;
    setCity(next);
  };

  const orderedHistory = useMemo(() => city?.weeklyHistoryMm?.slice(-8) ?? [], [city]);
  const marketReady = status?.desMoinesMarket.status === "ready" && status.desMoinesMarket.evidenceStatus === "validated";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.canvas} />
      <View style={styles.header}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>S</Text></View>
        <View style={styles.brandCopy}>
          <Text style={styles.brand}>SkyHedge</Text>
          <Text style={styles.brandSub}>WEATHER PROTECTION · DEVNET</Text>
        </View>
        <View style={styles.networkPill}><View style={styles.networkDot} /><Text style={styles.networkText}>DEVNET</Text></View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.blue} />}
      >
        {error ? <ErrorBanner message={error} apiHost={getApiHost()} /> : null}
        {tab === "weather" ? (
          <WeatherScreen
            cities={cities}
            city={city}
            status={status}
            history={orderedHistory}
            marketReady={marketReady}
            onCityChange={changeCity}
          />
        ) : null}
        {tab === "catalog" ? <CatalogScreen markets={catalog} /> : null}
        {tab === "wallet" ? (
          <WalletScreen
            wallet={wallet}
            portfolio={portfolio}
            walletBalances={walletBalances}
            portfolioError={portfolioError}
            loading={loading}
            onConnect={connect}
            onDisconnect={() => { setWallet(null); setPortfolio(null); setWalletBalances(null); setPortfolioError(null); }}
          />
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar} accessibilityRole="tablist" accessibilityLabel="Main navigation">
        <TabButton label="Weather" icon="◒" selected={tab === "weather"} onPress={() => setTab("weather")} />
        <TabButton label="Markets" icon="▤" selected={tab === "catalog"} onPress={() => setTab("catalog")} />
        <TabButton label="Wallet" icon="◫" selected={tab === "wallet"} onPress={() => setTab("wallet")} />
      </View>
    </SafeAreaView>
  );
}

function WeatherScreen({
  cities,
  city,
  status,
  history,
  marketReady,
  onCityChange,
}: {
  cities: CityIndex[];
  city: CityIndex | null;
  status: DevnetStatus | null;
  history: NonNullable<CityIndex["weeklyHistoryMm"]>;
  marketReady: boolean;
  onCityChange: (slug: string) => void;
}) {
  const maxRain = Math.max(1, ...history.map((week) => week.mm ?? 0));
  return (
    <>
      <Text style={styles.kicker}>FIELD BRIEF</Text>
      <Text style={styles.title}>Weather at a glance.</Text>
      <Text style={styles.intro}>NOAA rainfall indices for places SkyHedge is researching.</Text>

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
                <Text style={styles.heroLabel}>CURRENT WEEK · NOAA</Text>
                <Text style={styles.heroPlace}>{city.name}</Text>
                <Text style={styles.heroSub}>{city.country} · {city.stationName}</Text>
              </View>
              <View style={styles.indexBadge}><Text style={styles.indexBadgeText}>INDEX</Text></View>
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
              <Text style={styles.windowLabel}>WEEKLY WINDOW</Text>
              <Text style={styles.windowDates}>{city.currentWindow.start} — {city.currentWindow.end}</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent rainfall</Text>
            <Text style={styles.sectionMeta}>Completed weeks · mm</Text>
          </View>
          <View style={styles.chartCard}>
            {history.length ? history.map((week) => (
              <View key={week.week} style={styles.barColumn}>
                <Text style={styles.barValue}>{week.mm == null ? "—" : week.mm.toFixed(0)}</Text>
                <View style={styles.barTrack}>
                  {week.mm == null ? <View style={styles.barUnknown} /> : <View style={[styles.barFill, { height: `${Math.max(5, (week.mm / maxRain) * 100)}%` }]} />}
                </View>
                <Text style={styles.barDate}>{week.week.slice(5)}</Text>
              </View>
            )) : (
              <Text style={styles.emptyText}>Historical observations are not available yet. The chart stays blank until NOAA provides them.</Text>
            )}
          </View>

          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>A rainfall index, not a weather prediction</Text>
            <Text style={styles.noteBody}>SkyHedge uses a published NOAA station and observation window. A final payout only follows verified settlement evidence on Solana.</Text>
          </View>
        </>
      ) : (
        <EmptyState title="NOAA index unavailable" body="Connect to the SkyHedge API to load the current index. No sample weather values are shown." />
      )}

      <View style={styles.releaseCard}>
        <View style={styles.releaseIcon}><Text style={styles.releaseIconText}>{marketReady ? "✓" : "i"}</Text></View>
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

function CatalogScreen({ markets }: { markets: AgriculturalMarket[] }) {
  const [hazard, setHazard] = useState<HazardId>("rainfall");
  const selectedHazard = hazardPresentation(hazard);

  return (
    <>
      <Text style={styles.kicker}>RESEARCH CATALOG</Text>
      <Text style={styles.title}>Weather risk, by hazard.</Text>
      <Text style={styles.intro}>Choose an index type. Research status is shown separately; it does not mean a market is available.</Text>
      <View style={styles.hazardRail} accessibilityRole="tablist" accessibilityLabel="Weather hazard">
        {listHazards().map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: hazard === option.id }}
            onPress={() => setHazard(option.id)}
            style={[styles.hazardChip, hazard === option.id && styles.hazardChipSelected]}
          >
            <Text style={[styles.hazardChipText, hazard === option.id && styles.hazardChipTextSelected]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.hazardCard} accessibilityLiveRegion="polite">
        <View style={styles.hazardTop}>
          <Text style={styles.hazardTitle}>{selectedHazard.label} index</Text>
          <View style={styles.researchPill}><Text style={styles.researchPillText}>{selectedHazard.status}</Text></View>
        </View>
        <MetricRow label="Proposed measurement" value={selectedHazard.metric} />
        <MetricRow label="Display units" value={selectedHazard.unit} />
        <Text style={styles.hazardNote}>{selectedHazard.note}</Text>
        {!selectedHazard.quoteable ? <Text style={styles.hazardBlocked}>No quote or purchase flow is enabled for this index.</Text> : null}
      </View>
      {hazard === "rainfall" ? (markets.length ? markets.map((market) => (
        <View key={market.slug} style={styles.marketCard}>
          <View style={styles.marketTop}>
            <View style={styles.marketPin}><Text style={styles.marketPinText}>↗</Text></View>
            <View style={styles.marketMain}>
              <Text style={styles.marketName}>{market.name}</Text>
              <Text style={styles.marketPlace}>{market.locality}, {market.administrativeArea}</Text>
            </View>
            <View style={styles.researchPill}><Text style={styles.researchPillText}>{market.evidenceStatus === "validated" ? "Validated" : "Research"}</Text></View>
          </View>
          <Text style={styles.marketContext}>{market.agriculturalContext}</Text>
          <Text style={styles.marketCrops}>{market.crops.join(" · ")}</Text>
          <Text style={styles.marketFoot}>
            {market.noaaStationId
              ? `NOAA station ${market.noaaStationId}`
              : "No validated NOAA settlement station yet"}
          </Text>
        </View>
      )) : <EmptyState title="Rainfall catalog is unavailable" body="The app will show researched locations after the API responds." />) : (
        <EmptyState title={`${selectedHazard.label} locations are not validated`} body="No areas are listed until NOAA station coverage, observation quality, units, and contract methodology are verified for this hazard." />
      )}
      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Research status is not coverage</Text>
        <Text style={styles.noteBody}>A location appears under rainfall while station quality, observation rules, data rights, and pricing are reviewed. Wind gust and snowfall do not inherit rainfall evidence or readiness.</Text>
      </View>
    </>
  );
}

function WalletScreen({
  wallet,
  portfolio,
  walletBalances,
  portfolioError,
  loading,
  onConnect,
  onDisconnect,
}: {
  wallet: string | null;
  portfolio: Portfolio | null;
  walletBalances: FinalizedWalletState | null;
  portfolioError: string | null;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <>
      <Text style={styles.kicker}>SOLANA MOBILE</Text>
      <Text style={styles.title}>Your wallet, your say.</Text>
      <Text style={styles.intro}>Connect on this Android device with Mobile Wallet Adapter. SkyHedge never receives your keys.</Text>
      <View style={styles.walletCard}>
        <View style={styles.walletOrb}><Text style={styles.walletOrbText}>◎</Text></View>
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
        <Text style={styles.walletHint}>The wallet app will ask before sharing your public address. This app only requests the address for Devnet portfolio lookup.</Text>
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
        <Text style={styles.noteTitle}>Nothing is simulated</Text>
        <Text style={styles.noteBody}>Balances are read directly from finalized Devnet. Position counts appear only when finalized position data is indexed; SkyHedge never turns missing data into zero.</Text>
      </View>
    </>
  );
}

function TabButton({ label, icon, selected, onPress }: { label: string; icon: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={styles.tabButton}>
      <Text style={[styles.tabIcon, selected && styles.tabIconSelected]}>{icon}</Text>
      <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.metricRow}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}

function ErrorBanner({ message, apiHost }: { message: string; apiHost: string }) {
  return (
    <View accessibilityRole="alert" style={styles.errorBanner}>
      <Text style={styles.errorTitle}>Can’t reach SkyHedge</Text>
      <Text style={styles.errorBody}>{message}</Text>
      <Text style={styles.errorFoot}>API: {apiHost}. On a phone, set EXPO_PUBLIC_API_BASE_URL to a reachable SkyHedge server.</Text>
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
  safe: { flex: 1, backgroundColor: C.canvas },
  header: { minHeight: 62, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  brandMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: C.white, fontWeight: "700", fontSize: 20 },
  brandCopy: { marginLeft: 10, flex: 1 },
  brand: { color: C.ink, fontSize: 17, fontWeight: "700", letterSpacing: 0.1 },
  brandSub: { color: C.muted, fontSize: 9, fontWeight: "700", letterSpacing: 1.15, marginTop: 1 },
  networkPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.blueSoft, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 },
  networkDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.blue },
  networkText: { color: C.blue, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 23, paddingBottom: 30 },
  kicker: { color: C.blue, fontSize: 10, fontWeight: "700", letterSpacing: 1.4, marginBottom: 7 },
  title: { color: C.ink, fontSize: 27, lineHeight: 33, fontWeight: "700", letterSpacing: -0.5 },
  intro: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 16 },
  cityRail: { gap: 8, paddingBottom: 15 },
  cityChip: { minHeight: 40, paddingHorizontal: 14, justifyContent: "center", borderWidth: 1, borderColor: C.border, borderRadius: 20, backgroundColor: C.white },
  cityChipSelected: { borderColor: C.blue, backgroundColor: C.blue },
  cityChipText: { color: C.ink, fontSize: 13, fontWeight: "600" },
  cityChipTextSelected: { color: C.white },
  heroCard: { backgroundColor: C.white, borderColor: C.border, borderWidth: 1, borderRadius: 15, padding: 18 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroLabel: { color: C.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.05 },
  heroPlace: { color: C.ink, fontSize: 21, fontWeight: "700", marginTop: 5 },
  heroSub: { color: C.muted, fontSize: 11, marginTop: 4 },
  indexBadge: { backgroundColor: C.greenSoft, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 },
  indexBadgeText: { color: C.green, fontSize: 9, fontWeight: "700", letterSpacing: 0.9 },
  rainValueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 18 },
  rainValue: { color: C.ink, fontSize: 47, lineHeight: 52, fontWeight: "700", letterSpacing: -1.8, fontVariant: ["tabular-nums"] },
  rainUnit: { color: C.muted, fontSize: 17, fontWeight: "600", marginLeft: 7 },
  rainCaption: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  windowRow: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 16, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", gap: 8 },
  windowLabel: { color: C.muted, fontSize: 9, fontWeight: "700", letterSpacing: 0.75 },
  windowDates: { color: C.ink, fontSize: 10, fontWeight: "600" },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 20, marginBottom: 10 },
  sectionTitle: { color: C.ink, fontSize: 16, fontWeight: "700" },
  sectionMeta: { color: C.muted, fontSize: 10 },
  chartCard: { flexDirection: "row", height: 137, alignItems: "stretch", justifyContent: "space-between", gap: 6, backgroundColor: C.white, borderColor: C.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 },
  barColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  barValue: { color: C.muted, fontSize: 9, marginBottom: 5, fontVariant: ["tabular-nums"] },
  barTrack: { flex: 1, width: 17, maxHeight: 77, justifyContent: "flex-end", backgroundColor: C.mutedSurface, borderRadius: 5, overflow: "hidden" },
  barFill: { width: "100%", backgroundColor: C.blue, borderRadius: 5 },
  barUnknown: { width: "100%", height: 2, backgroundColor: C.border, marginTop: "auto" },
  barDate: { color: C.muted, fontSize: 8, marginTop: 5 },
  emptyText: { color: C.muted, fontSize: 12, lineHeight: 18 },
  noteCard: { backgroundColor: C.mutedSurface, borderRadius: 13, padding: 15, marginTop: 16 },
  noteTitle: { color: C.ink, fontSize: 13, fontWeight: "700" },
  noteBody: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  releaseCard: { backgroundColor: C.amberSoft, borderRadius: 13, padding: 14, marginTop: 14, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  releaseIcon: { width: 23, height: 23, borderRadius: 12, borderWidth: 1, borderColor: C.amber, alignItems: "center", justifyContent: "center" },
  releaseIconText: { color: C.amber, fontSize: 13, fontWeight: "700" },
  releaseCopy: { flex: 1 },
  releaseTitle: { color: C.ink, fontSize: 13, fontWeight: "700" },
  releaseBody: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  marketCard: { backgroundColor: C.white, borderColor: C.border, borderWidth: 1, borderRadius: 14, padding: 15, marginTop: 10 },
  marketTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  marketPin: { width: 33, height: 33, borderRadius: 10, backgroundColor: C.blueSoft, alignItems: "center", justifyContent: "center" },
  marketPinText: { color: C.blue, fontSize: 18, fontWeight: "700" },
  marketMain: { flex: 1 },
  marketName: { color: C.ink, fontSize: 14, fontWeight: "700" },
  marketPlace: { color: C.muted, fontSize: 11, marginTop: 3 },
  researchPill: { paddingHorizontal: 8, paddingVertical: 5, backgroundColor: C.amberSoft, borderRadius: 20 },
  researchPillText: { color: C.amber, fontSize: 9, fontWeight: "700" },
  marketContext: { color: C.ink, fontSize: 12, lineHeight: 17, marginTop: 13 },
  marketCrops: { color: C.muted, fontSize: 10, fontWeight: "600", marginTop: 8, textTransform: "capitalize" },
  marketFoot: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 9, marginTop: 10, color: C.muted, fontSize: 10 },
  hazardRail: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  hazardChip: { minHeight: 44, paddingHorizontal: 14, justifyContent: "center", borderWidth: 1, borderColor: C.border, borderRadius: 22, backgroundColor: C.white },
  hazardChipSelected: { borderColor: C.blue, backgroundColor: C.blue },
  hazardChipText: { color: C.ink, fontSize: 13, fontWeight: "600" },
  hazardChipTextSelected: { color: C.white },
  hazardCard: { backgroundColor: C.white, borderColor: C.border, borderWidth: 1, borderRadius: 14, padding: 15, marginBottom: 6 },
  hazardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  hazardTitle: { color: C.ink, fontSize: 15, fontWeight: "700" },
  hazardNote: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 7 },
  hazardBlocked: { color: C.amber, fontSize: 11, fontWeight: "700", marginTop: 9 },
  walletCard: { backgroundColor: C.white, borderColor: C.border, borderWidth: 1, borderRadius: 16, alignItems: "center", padding: 22, marginTop: 4 },
  walletOrb: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.blueSoft, justifyContent: "center", alignItems: "center" },
  walletOrbText: { color: C.blue, fontSize: 27, fontWeight: "600" },
  walletTitle: { color: C.ink, fontSize: 17, fontWeight: "700", marginTop: 14 },
  walletAddress: { color: C.muted, fontSize: 12, marginTop: 5, fontVariant: ["tabular-nums"] },
  primaryButton: { minHeight: 48, width: "100%", alignItems: "center", justifyContent: "center", backgroundColor: C.blue, borderRadius: 11, marginTop: 18 },
  primaryButtonText: { color: C.white, fontSize: 14, fontWeight: "700" },
  disabledButton: { opacity: 0.65 },
  secondaryButton: { minHeight: 44, minWidth: 140, alignItems: "center", justifyContent: "center", borderColor: C.border, borderWidth: 1, borderRadius: 11, marginTop: 18 },
  secondaryButtonText: { color: C.ink, fontSize: 13, fontWeight: "600" },
  walletHint: { color: C.muted, fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 14 },
  portfolioCard: { backgroundColor: C.white, borderColor: C.border, borderWidth: 1, borderRadius: 14, padding: 15, marginTop: 16 },
  metricRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 12 },
  metricLabel: { color: C.muted, fontSize: 12 },
  metricValue: { color: C.ink, fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  portfolioFoot: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  errorBanner: { backgroundColor: "#FCEBE9", borderWidth: 1, borderColor: "#EBC7C3", borderRadius: 12, padding: 13, marginBottom: 18 },
  errorTitle: { color: C.red, fontSize: 13, fontWeight: "700" },
  errorBody: { color: C.ink, fontSize: 11, lineHeight: 16, marginTop: 4 },
  errorFoot: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 6 },
  emptyState: { backgroundColor: C.white, borderColor: C.border, borderWidth: 1, borderRadius: 14, padding: 17, marginTop: 8 },
  emptyTitle: { color: C.ink, fontSize: 14, fontWeight: "700", marginBottom: 5 },
  bottomBar: { minHeight: 66, flexDirection: "row", justifyContent: "space-around", alignItems: "center", backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: 4 },
  tabButton: { minWidth: 76, minHeight: 54, alignItems: "center", justifyContent: "center" },
  tabIcon: { color: C.muted, fontSize: 19, lineHeight: 23 },
  tabIconSelected: { color: C.blue },
  tabLabel: { color: C.muted, fontSize: 10, fontWeight: "600", marginTop: 3 },
  tabLabelSelected: { color: C.blue },
});
