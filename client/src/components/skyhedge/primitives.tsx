import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Clock3, CircleDotDashed, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatusChip({ children, tone = "neutral" }: { children: ReactNode; tone?: "success" | "warning" | "error" | "neutral" }) {
  const icon = tone === "success" ? <CheckCircle2 /> : tone === "error" ? <AlertTriangle /> : tone === "warning" ? <Clock3 /> : <CircleDotDashed />;
  return <span className={cn("status-chip", `status-chip--${tone}`)}>{icon}{children}</span>;
}

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

export function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

export function UnavailableState({ title, children, error = false }: { title: string; children: ReactNode; error?: boolean }) {
  return <div className={cn("unavailable-state", error && "unavailable-state--error")} role={error ? "alert" : undefined}><AlertTriangle aria-hidden="true" /><div><strong>{title}</strong><p>{children}</p></div></div>;
}

export function ExplorerLink({ signature }: { signature?: string }) {
  if (!signature) return <span className="muted-inline">Explorer links appear after a real on-chain signature.</span>;
  return <a href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} target="_blank" rel="noreferrer" className="explorer-link">View in Explorer <ExternalLink aria-hidden="true" /></a>;
}
