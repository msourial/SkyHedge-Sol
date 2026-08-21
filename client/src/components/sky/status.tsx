import { Pill } from "./primitives";

/** Decode the anchor JSON status string ("{...}" or plain) into a tone + label. */
export function marketStatus(status: string | null | undefined): { label: string; tone: "cyan" | "green" | "amber" | "red" | "slate" } {
  const raw = status ?? "UNKNOWN";
  let key = raw;
  if (raw.startsWith("{")) {
    try {
      key = Object.keys(JSON.parse(raw) as Record<string, unknown>)[0] ?? "unknown";
    } catch {
      key = "unknown";
    }
  }
  key = key.toLowerCase();
  switch (key) {
    case "fundraising": return { label: "Fundraising", tone: "amber" };
    case "open": return { label: "Open", tone: "green" };
    case "live": return { label: "Live", tone: "cyan" };
    case "locked": return { label: "Locked", tone: "slate" };
    case "awaitingsettlement": return { label: "Settling", tone: "amber" };
    case "settled": return { label: "Settled", tone: "slate" };
    case "expired": return { label: "Expired", tone: "red" };
    default: return { label: key.toUpperCase(), tone: "slate" };
  }
}

export function MarketStatusBadge({ status }: { status: string | null | undefined }) {
  const s = marketStatus(status);
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function CoverageBadge({ tier }: { tier: "A" | "B" | "C" }) {
  return <Pill tone={tier === "A" ? "green" : tier === "B" ? "cyan" : "amber"}>Coverage {tier}</Pill>;
}

export function SourceBadge({ source }: { source: "noaa-10yr" | "climatology-prior" | "none" | string }) {
  if (source === "noaa-10yr") return <Pill tone="green">10yr NOAA history</Pill>;
  if (source === "climatology-prior") return <Pill tone="cyan">Climatology prior</Pill>;
  return <Pill tone="slate">No observations</Pill>;
}