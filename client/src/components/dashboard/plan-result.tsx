import { useNavigate } from "react-router-dom";
import { CloudRain } from "lucide-react";
import type { ParseTradeResult } from "@/lib/types";
import { api, skytDisplay } from "@/lib/api";
import { Card, Pill, Stat } from "@/components/sky";

export function PlanResult({ result }: { result: ParseTradeResult }) {
  const navigate = useNavigate();
  return (
    <Card className="border-[var(--identity)]/40">
      <div className="flex flex-wrap items-center gap-2">
        <CloudRain className="h-4 w-4 text-[var(--identity)]" />
        <h2 className="sky-display text-sm font-semibold">Protection plan</h2>
        <Pill tone="cyan">confidence {Math.round(result.confidence * 100)}%</Pill>
        <Pill tone={result.source === "llm" ? "green" : "slate"}>{result.source}</Pill>
      </div>
      <p className="mt-3 text-sm leading-relaxed">{result.response}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="City" value={result.parameters.city.replace(/-/g, " ")} accent="cyan" />
        <Stat label="Strike" value={`${result.parameters.thresholdMm} mm`} />
        <Stat label="Protected" value={skytDisplay(result.parameters.protectedAmount)} />
        <Stat label="Risk" value={result.parameters.risk === "excess-rain" ? "rain ≥" : "rain ≤"} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3.5 py-3">
        <p className="max-w-md text-[11px] leading-relaxed text-[var(--faint)]">{result.parameters.reasoning}</p>
        {result.recommendation && (
          <button
            onClick={() => navigate(`/?tab=trading&city=${result.recommendation!.slug}`)}
            className="sky-btn-primary px-3 py-1.5 text-xs"
          >
            Open chain at {result.recommendation.strikeMm} mm →
          </button>
        )}
      </div>
    </Card>
  );
}
