import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Bot, Sparkles } from "lucide-react";
import type { AiInsights, ParseTradeResult } from "@/lib/types";
import { api } from "@/lib/api";
import { Card, Pill, Skeleton } from "@/components/sky";
import { PersonaPanel } from "@/components/dashboard/persona-panel";
import { PlanResult } from "@/components/dashboard/plan-result";

export function AiTab({ initialMessage }: { initialMessage?: string }) {
  const navigate = useNavigate();
  const [message, setMessage] = useState(initialMessage ?? "");
  const [result, setResult] = useState<ParseTradeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const insights = useQuery({ queryKey: ["ai-insights"], queryFn: () => api<AiInsights>("/api/ai/insights"), refetchInterval: 60_000 });
  const accuracy = useQuery({ queryKey: ["ai-accuracy"], queryFn: () => api<{ metrics: Array<{ label: string; value: string }> }>("/api/ai/accuracy") });

  const ask = async (text?: string) => {
    const prompt = text ?? message;
    if (!prompt.trim()) return;
    setMessage(prompt);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<ParseTradeResult>("/api/ai/parse-trade", { method: "POST", body: JSON.stringify({ message: prompt }) });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Planning failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--identity-dim)] text-[var(--identity)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="sky-display text-sm font-semibold">Describe an exposure, get a plan</div>
              <div className="sky-eyebrow">maps to one city index contract · never executes</div>
            </div>
          </div>

          <label className="sky-label mt-4" htmlFor="ai-exposure">Your exposure</label>
          <textarea
            ref={inputRef}
            id="ai-exposure"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }}
            placeholder={"My crop rotation needs a dry week in Houston — protect 20k SKYT against low rain."}
            className="sky-input min-h-[96px] resize-y"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {["Farmer flood hedge", "Event washout", "Monsoon excess"].map((preset) => (
                <button key={preset} onClick={() => { setMessage(preset); void ask(preset); }} className="sky-mono rounded-md border border-[var(--border)] px-2.5 py-1 text-[10px] text-[var(--muted-foreground)] transition-colors hover:border-[var(--identity)]/50 hover:text-[var(--identity)]">
                  {preset}
                </button>
              ))}
            </div>
            <button className="sky-btn-primary flex items-center gap-1.5 px-4 py-2 text-sm" onClick={() => void ask()} disabled={loading || !message.trim()}>
              {loading ? "Planning…" : "Build plan"} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {error && <p className="mt-3 text-xs text-[var(--destructive)]">{(error)}</p>}
        </Card>

        {result && <PlanResult result={result} />}
      </div>

      <div className="space-y-6">
        <PersonaPanel onExample={(text) => { setMessage(text); void ask(text); }} />

        <Card>
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-[var(--identity)]" />
            <div className="sky-eyebrow">Model accuracy</div>
          </div>
          {accuracy.data ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {accuracy.data.metrics.map((m) => (
                <div key={m.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2">
                  <div className="sky-eyebrow">{m.label}</div>
                  <div className="sky-mono mt-0.5 text-sm font-medium">{m.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <Skeleton className="mt-3 h-16" />
          )}
        </Card>

        <Card>
          <div className="sky-eyebrow">Signal watch</div>
          {insights.data && (
            <div className="mt-3 space-y-2">
              {insights.data.top.map((f) => (
                <button
                  key={f.city}
                  onClick={() => navigate(`/?tab=trading&city=${f.city}`)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-left transition-colors hover:border-[var(--identity)]/50"
                >
                  <div>
                    <div className="text-xs font-medium">{f.cityName}</div>
                    <div className="sky-mono text-[10px] text-[var(--faint)]">
                      {f.observedMm !== null ? `${f.observedMm}mm obs` : "climatology"} · normal {f.normalMm}mm
                    </div>
                  </div>
                  <Pill tone={f.factor === "wet" ? "amber" : f.factor === "dry" ? "cyan" : "slate"}>
                    {f.factor === "wet" ? `+${f.deviationPct}% wet` : f.factor === "dry" ? `${f.deviationPct}% dry` : "neutral"}
                  </Pill>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}