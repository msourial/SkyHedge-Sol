/**
 * Derive at-a-glance /app overview metrics from finalized Devnet status.
 * Never invents cover-sold, premiums, or settlements when those fields are absent.
 */

export type OverviewLadderMarket = {
  city: string;
  state: string;
  vaultBalance?: string | null;
};

export type OverviewCityWindow = {
  city: string;
  salesCloseAt: number | null;
};

export type OverviewStatusSlice = {
  ladderMarkets?: readonly OverviewLadderMarket[] | null;
  cityWindows?: readonly OverviewCityWindow[] | null;
  desMoinesMarket?: { vaultBalance?: string | null; status?: string } | null;
  feeVault?: { balance?: string | null } | null;
};

export type OverviewMetric =
  | { id: "openMarkets"; label: string; value: string }
  | { id: "cities"; label: string; value: string }
  | { id: "vaultCollateral"; label: string; value: string; unit: "SKYT" };

export type OverviewMetrics = {
  metrics: OverviewMetric[];
  omitted: Array<"openMarkets" | "cities" | "vaultCollateral" | "coverSold" | "premiums" | "recentSettlements">;
};

function isDigits(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

/** Format SKYT base units as a compact grouped figure (whole + up to 2 decimals). */
export function formatSkytBase(base: bigint): string {
  const whole = base / 1_000_000n;
  const frac = (base % 1_000_000n) / 10_000n;
  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (frac === 0n) return wholeText;
  return `${wholeText}.${frac.toString().padStart(2, "0")}`;
}

export function overviewMetricsFromStatus(
  status: OverviewStatusSlice | null | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): OverviewMetrics {
  const omitted: OverviewMetrics["omitted"] = ["coverSold", "premiums", "recentSettlements"];
  const metrics: OverviewMetric[] = [];

  const ladder = status?.ladderMarkets ?? null;
  const windows = status?.cityWindows ?? null;

  let openMarkets: number | null = null;
  let citySlugs: string[] = [];
  let vaultSum: bigint | null = null;

  if (ladder && ladder.length > 0) {
    const open = ladder.filter((row) => row.state === "open");
    openMarkets = open.length;
    citySlugs = [...new Set(open.map((row) => row.city).filter(Boolean))].sort();
    vaultSum = open.reduce((sum, row) => {
      if (!isDigits(row.vaultBalance)) return sum;
      return sum + BigInt(row.vaultBalance);
    }, 0n);
  } else if (windows && windows.length > 0) {
    const selling = windows.filter((row) => row.salesCloseAt != null && row.salesCloseAt > nowSeconds);
    openMarkets = selling.length;
    citySlugs = [...new Set(selling.map((row) => row.city).filter(Boolean))].sort();
    // cityWindows do not always carry vault balances — leave vault omitted.
    vaultSum = null;
    omitted.push("vaultCollateral");
  } else {
    omitted.push("openMarkets", "cities", "vaultCollateral");
    return { metrics, omitted };
  }

  if (openMarkets != null) {
    metrics.push({ id: "openMarkets", label: "Open markets", value: String(openMarkets) });
  } else {
    omitted.push("openMarkets");
  }

  if (citySlugs.length > 0) {
    metrics.push({ id: "cities", label: "Cities", value: String(citySlugs.length) });
  } else {
    omitted.push("cities");
  }

  if (vaultSum != null && !omitted.includes("vaultCollateral")) {
    metrics.push({
      id: "vaultCollateral",
      label: "LP vault collateral",
      value: formatSkytBase(vaultSum),
      unit: "SKYT",
    });
  } else if (!omitted.includes("vaultCollateral")) {
    omitted.push("vaultCollateral");
  }

  return { metrics, omitted };
}
