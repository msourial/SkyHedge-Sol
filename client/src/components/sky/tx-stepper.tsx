import { CheckCircle2, Clock3, Loader2, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TxStep = "idle" | "building" | "ready" | "sending" | "confirmed" | "error";

/**
 * Inline transaction lifecycle stepper: build unsigned tx → sign & send →
 * confirmed (green) or error (red). No bare spinners, no simulated states.
 */
export function TxStepper({
  step,
  description,
  error,
  signature,
  children,
  className,
}: {
  step: TxStep;
  description?: string;
  error?: string | null;
  signature?: string | null;
  children?: ReactNode;
  className?: string;
}) {
  if (step === "confirmed" && signature) {
    return (
      <div className={cn("flex items-start gap-2.5 rounded-lg border border-[var(--success)]/30 bg-[var(--success-dim)] p-3.5 text-xs", className)}>
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
        <div className="min-w-0 leading-relaxed">
          <div className="font-semibold text-[var(--success)]">Confirmed</div>
          <div className="sky-mono mt-0.5 break-all text-[var(--muted-foreground)]">{signature.slice(0, 20)}…{signature.slice(-8)}</div>
        </div>
      </div>
    );
  }

  if (step === "error" && error) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive-dim)] p-3.5 text-xs">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--destructive)]" />
        <div className="leading-relaxed text-[var(--destructive-foreground)]">{error}</div>
      </div>
    );
  }

  if (step === "ready" && description) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-[var(--identity)]/30 bg-[var(--identity-dim)] p-3.5 text-xs">
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--identity)]" />
        <div className="leading-relaxed text-[var(--muted-foreground)]">
          <span className="font-semibold text-[var(--identity)]">Unsigned transaction ready.</span> {description}
        </div>
      </div>
    );
  }

  if (step === "building" || step === "sending") {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-3.5 text-xs text-[var(--muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--identity)]" />
        {step === "building" ? "Building unsigned transaction…" : "Signing and broadcasting…"}
      </div>
    );
  }

  return children ? <>{children}</> : null;
}