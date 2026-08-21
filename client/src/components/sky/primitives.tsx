import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ children, className, hover }: { children: ReactNode; className?: string; hover?: boolean }) {
  return <div className={cn("sky-card", hover && "sky-card-hover", className)}>{children}</div>;
}

export function Pill({ children, tone = "slate", className }: { children: ReactNode; tone?: "cyan" | "green" | "amber" | "red" | "slate"; className?: string }) {
  return <span className={cn("sky-badge", `sky-badge-${tone}`, className)}>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("sky-shimmer", className)} />;
}

export function Stat({ label, value, accent, className }: { label: string; value: ReactNode; accent?: "cyan" | "green" | "red" | "amber"; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2", className)}>
      <div className="sky-eyebrow">{label}</div>
      <div
        className={cn(
          "sky-mono mt-0.5 text-sm font-medium text-[var(--foreground)]",
          accent === "cyan" && "text-[var(--identity)]",
          accent === "green" && "text-[var(--success)]",
          accent === "red" && "text-[#F87171]",
          accent === "amber" && "text-[var(--warning)]",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, hint, cta }: { icon?: ReactNode; title: string; hint?: string; cta?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] px-8 py-14 text-center">
      {icon && <div className="text-[var(--identity)]">{icon}</div>}
      <div className="text-sm font-medium text-[var(--muted-foreground)]">{title}</div>
      {hint && <p className="max-w-sm text-xs leading-relaxed text-[var(--faint)]">{hint}</p>}
      {cta}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("sky-section-label mb-3", className)}>{children}</h2>;
}

export function AddressChip({ address, className }: { address: string; className?: string }) {
  return (
    <span className={cn("sky-mono text-xs text-[var(--faint)]", className)}>
      {address.slice(0, 4)}…{address.slice(-4)}
    </span>
  );
}

/** 12-week mini bar sparkline — for city cards and chain headers. */
export function Sparkline({ values, className, barClassName }: { values: Array<number | null>; className?: string; barClassName?: string }) {
  const data = values.length ? values : Array.from({ length: 12 }, () => null);
  const max = Math.max(...data.filter((v): v is number => v !== null), 1);
  return (
    <div className={cn("flex h-8 items-end gap-[3px]", className)} aria-hidden>
      {data.map((v, i) => {
        const h = v === null ? 6 : Math.max(8, Math.round((v / max) * 100));
        return <div key={i} className={cn("w-full rounded-[2px] bg-[var(--identity-dim)]", v !== null && "bg-[var(--identity)]/70", barClassName)} style={{ height: `${v === null ? 6 : Math.max(12, h * 0.32)}px` }} />;
      })}
    </div>
  );
}