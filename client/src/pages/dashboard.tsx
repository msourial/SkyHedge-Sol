import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Coins, LayoutDashboard, Search, WalletCards } from "lucide-react";
import type { ChainGrid, CityIndexState, CitySearchResult } from "@/lib/types";
import { api } from "@/lib/api";
import { Card, Skeleton } from "@/components/sky";
import { WeatherCard, MarketStatusCard } from "@/components/dashboard/weather-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { OptionsChain } from "@/components/dashboard/options-chain";
import { PortfolioTab } from "@/components/dashboard/portfolio-tab";
import { CommunityTab } from "@/components/dashboard/community-tab";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "trading", label: "Trading", icon: LayoutDashboard },
  { id: "portfolio", label: "Portfolio", icon: WalletCards },
  { id: "community", label: "Community", icon: Coins },
] as const;

type TabId = (typeof TABS)[number]["id"];

function toTab(v: string | null): TabId {
  return TABS.some((t) => t.id === v) ? (v as TabId) : "trading";
}

export default function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = toTab(params.get("tab"));
  const citySlug = params.get("city") ?? "new-york";
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!params.get("tab") && !params.get("city")) setParams({ tab: "trading" }, { replace: true });
  }, [params, setParams]);

  const setTab = (t: TabId) => setParams((prev) => { prev.set("tab", t); return prev; }, { replace: true });

  const cityQuery = useQuery({
    queryKey: ["city", citySlug],
    queryFn: () => api<CityIndexState>(`/api/cities/${citySlug}`),
    refetchInterval: 60_000,
  });

  const chainQuery = useQuery({
    queryKey: ["chain", citySlug],
    queryFn: () => api<ChainGrid>(`/api/cities/${citySlug}/chain`),
    refetchInterval: 30_000,
  });

  const search = useQuery({
    queryKey: ["cities-search", query.trim()],
    queryFn: () => api<{ results: CitySearchResult[] }>(`/api/cities/search?q=${encodeURIComponent(query.trim())}`),
    enabled: query.trim().length > 0,
  });

  const city = cityQuery.data;
  const chain = chainQuery.data;
  const [activeIdx, setActiveIdx] = useState(-1);
  const results = (search.data?.results ?? []).slice(0, 6);

  const pickCity = (slug: string) => {
    navigate(`/?tab=trading&city=${slug}`);
    setQuery("");
    setActiveIdx(-1);
    setFocused(false);
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => (i + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => (i <= 0 ? results.length - 1 : i - 1)); }
    else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); pickCity(results[activeIdx].slug); }
    else if (e.key === "Escape") { setFocused(false); setActiveIdx(-1); }
  };
  const atmCell = useMemo(() => {
    const strikes = chain?.strikes ?? [];
    if (!strikes.length || !city) return null;
    const anchor = city.cumulativeMm ?? city.windowNormalMm;
    const closest = strikes.reduce((prev, curr) => (Math.abs(curr - anchor) < Math.abs(prev - anchor) ? curr : prev));
    return chain?.cells.find((c) => c.strikeMm === closest && c.expiry === chain.windows[0]?.end && c.side === "call") ?? null;
  }, [chain, city]);

  return (
    <div>
      <section className="mb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="sky-display text-2xl font-bold tracking-tight sm:text-3xl">
              {city ? city.name : "Loading…"}
            </h1>
            {city && (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted-foreground)]">
                <span className="sky-mono">{city.stationName}</span>
                <span className="text-[var(--faint)]">·</span>
                <span>{city.metric.replaceAll("_", " ")}</span>
                <span className="text-[var(--faint)]">·</span>
                <span className="sky-mono">{city.currentWindow.start.slice(5)} → {city.currentWindow.end.slice(5)}</span>
                <span className="inline-flex items-center gap-1.5 text-[var(--success)]"><span className="sky-live-dot" /> live</span>
              </p>
            )}
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--faint)]" />
            <input
              aria-label="Search cities"
              role="combobox"
              aria-expanded={focused && results.length > 0}
              aria-controls="city-search-listbox"
              aria-activedescendant={activeIdx >= 0 ? `city-option-${activeIdx}` : undefined}
              aria-autocomplete="list"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIdx(-1); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => { setFocused(false); setActiveIdx(-1); }, 150)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search cities…"
              className="sky-input py-2.5 pl-10 text-sm"
            />
            {focused && query.trim().length > 0 && results.length > 0 && (
              <ul id="city-search-listbox" role="listbox" aria-label="Cities" className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)] shadow-2xl">
                {results.map((r, i) => (
                  <li key={r.slug} id={`city-option-${i}`} role="option" aria-selected={i === activeIdx}>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); pickCity(r.slug); }}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm transition-colors",
                        i === activeIdx ? "bg-[var(--identity-dim)] text-[var(--identity)]" : "hover:bg-[var(--identity-dim)]",
                      )}
                    >
                      <span>{r.name}</span>
                      <span className="sky-mono text-[10px] text-[var(--faint)]">{r.country}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <div className="sticky top-16 z-20 -mx-4 mb-6 border-b border-[var(--border)] bg-[var(--background)]/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="sky-scroll-x flex min-w-0 gap-1 py-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-colors",
                tab === id ? "bg-[var(--identity-dim)] text-[var(--identity)]" : "text-[var(--muted-foreground)] hover:bg-[var(--surface-1)] hover:text-[var(--foreground)]",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "trading" && (
        <div className="space-y-6">
          {cityQuery.isLoading ? (
            <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-72" /><Skeleton className="h-96" /></div>
          ) : !city ? (
            <Card className="py-12 text-center text-sm text-[var(--muted-foreground)]">No index for “{citySlug}” — search a city above.</Card>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                <WeatherCard city={city} probBps={atmCell?.quoteProbabilityBps ?? null} strikeMm={atmCell?.strikeMm ?? null} />
                <MarketStatusCard city={city} chain={chain} />
              </div>
              <Card>
                <TrendChart history={city.weeklyHistoryMm ?? []} normalMm={city.windowNormalMm} strikeMm={atmCell?.strikeMm ?? null} side={atmCell?.side ?? null} />
              </Card>
              <OptionsChain city={city} chain={chain} />
            </>
          )}
        </div>
      )}

      {tab === "portfolio" && <PortfolioTab />}
      {tab === "community" && <CommunityTab />}
    </div>
  );
}