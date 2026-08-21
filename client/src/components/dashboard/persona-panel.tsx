import { useQuery } from "@tanstack/react-query";
import { Bot, TrendingUp } from "lucide-react";
import type { AiAccuracy } from "@/lib/types";
import { api } from "@/lib/api";
import { Card, Skeleton } from "@/components/sky";

const QUICK_EXAMPLES = [
  "Farmer flood hedge — protect against heavy rain in Mumbai",
  "Event washout — dry weekend needed in New York",
  "Monsoon excess — 400mm call on Mumbai",
];

export function PersonaPanel({ onExample }: { onExample: (text: string) => void }) {
  const accuracy = useQuery({ queryKey: ["ai-accuracy"], queryFn: () => api<AiAccuracy>("/api/ai/accuracy") });

  return (
    <Card>
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--identity-dim)] text-[var(--identity)]">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <div className="sky-display text-sm font-semibold">Rain Index Analyst</div>
          <div className="sky-eyebrow">deterministic planner</div>
        </div>
      </div>

        {accuracy.data ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-2.5 py-2 text-center">
              <div className="sky-mono text-lg font-semibold text-[var(--identity)]">{Math.round(accuracy.data.winRate * 100)}%</div>
              <div className="sky-eyebrow">win rate</div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-2.5 py-2 text-center">
              <div className="sky-mono text-lg font-semibold text-[var(--success)]">{accuracy.data.riskReward} : 1</div>
              <div className="sky-eyebrow">risk/reward</div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-2.5 py-2 text-center">
              <div className="sky-mono text-lg font-semibold">{accuracy.data.sampleSize.toLocaleString("en-US")}</div>
              <div className="sky-eyebrow">plans</div>
            </div>
          </div>
        ) : (
          <Skeleton className="mt-4 h-16" />
        )}

        <div className="mt-4 space-y-2">
        {QUICK_EXAMPLES.map((q) => (
          <button
            key={q}
            onClick={() => onExample(q)}
            className="flex w-full items-start gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-left text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--identity)]/50 hover:text-[var(--foreground)]"
          >
            <TrendingUp className="mt-0.5 h-3 w-3 shrink-0 text-[var(--identity)]" />
            {q}
          </button>
        ))}
      </div>
    </Card>
  );
}