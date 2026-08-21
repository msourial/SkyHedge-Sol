import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import type { ParseTradeResult } from "@/lib/types";
import { api } from "@/lib/api";
import { Card } from "@/components/sky";
import { PlanResult } from "@/components/dashboard/plan-result";

const EXAMPLES = [
  "My rooftop solar install needs a dry week in Cairo — protect 15k SKYT against low rain",
  "Rice paddies outside Tokyo — hedge a 120mm monsoon week with 50k SKYT",
  "Outdoor festival in London — no rain or refund: 30k SKYT on a 15mm floor",
];

export default function FlowAiPage() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ParseTradeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--identity-dim)] text-[var(--identity)]">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="sky-display mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Flow AI</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
          Describe a real-world weather exposure in plain language. The planner maps it to one city index contract — threshold, strike, and size — then you open the chain to buy. Nothing is executed without your wallet.
        </p>
      </div>

      <Card>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }}
          placeholder="e.g. My warehouse in Houston needs protection from a flood week — 20k SKYT…"
          className="sky-input min-h-[120px] resize-y text-base"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button key={ex.slice(0, 20)} onClick={() => { setMessage(ex); void ask(ex); }} className="max-w-[220px] truncate rounded-md border border-[var(--border)] px-2.5 py-1 text-[10px] text-[var(--muted-foreground)] transition-colors hover:border-[var(--identity)]/50 hover:text-[var(--identity)]">
                {ex.slice(0, 44)}…
              </button>
            ))}
          </div>
          <button className="sky-btn-primary flex items-center gap-1.5 px-5 py-2.5 text-sm" onClick={() => void ask()} disabled={loading || !message.trim()}>
            {loading ? "Planning…" : "Build plan"} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="mt-3 text-xs text-[var(--destructive)]">{error}</p>}
      </Card>

      {result && <PlanResult result={result} />}
    </div>
  );
}