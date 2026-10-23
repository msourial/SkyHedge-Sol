import { useQuery } from "@tanstack/react-query";
import { CONSUMER_CITIES, type ConsumerCity } from "../../../shared/consumer-cities";
import { OPENING_SHORTLY, windowsOpenChip, type SalesChipTone, type Tenor } from "../../../shared/window-ladder";
import { api } from "@/lib/api";

export type SalesChip = { label: string; tone: SalesChipTone };

type LadderStatus = {
  cityWindows?: Array<{ city: string; tenor: Tenor; salesCloseAt: number | null }>;
  ladderMarkets?: Array<{ city: string; state: string; salesCloseAt: number | null }>;
};

/** Chips follow on-chain windows. Missing status never paints a city green. */
export function chipsFromStatus(status: LadderStatus | null | undefined, nowSeconds = Math.floor(Date.now() / 1000)): Record<string, SalesChip> {
  const chips: Record<string, SalesChip> = {};
  for (const city of CONSUMER_CITIES) {
    chips[city.code] = chipForCity(city, status, nowSeconds);
  }
  return chips;
}

function chipForCity(city: ConsumerCity, status: LadderStatus | null | undefined, nowSeconds: number): SalesChip {
  if (city.status === "soon") return { label: "Opens soon", tone: "soon" };
  const open = (status?.cityWindows ?? []).filter((window) => window.city === city.slug && window.salesCloseAt != null && window.salesCloseAt > nowSeconds);
  return windowsOpenChip(open.map((window) => window.tenor));
}

export function chipClass(chip: SalesChip, pulse = false): string {
  const tone = chip.tone === "live" ? "wl-markets__status--open" : chip.tone === "closed" ? "wl-markets__status--closed" : "wl-markets__status--opens";
  return `wl-markets__status ${tone}${pulse ? " wl-markets__status--pulse" : ""}`;
}

export function useSalesChips(): Record<string, SalesChip> {
  const query = useQuery({
    queryKey: ["devnet-status"],
    queryFn: () => api<LadderStatus>("/api/devnet/status"),
    retry: false,
    refetchInterval: 30_000,
  });
  return chipsFromStatus(query.data);
}

export const CLOSED_CHIP_LABEL = "Sales closed";
export const SOON_CHIP_LABEL = OPENING_SHORTLY;
