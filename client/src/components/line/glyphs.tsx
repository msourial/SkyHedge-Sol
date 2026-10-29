import React from "react";
import { lineGlyphs } from "../../../../shared/ui-glyphs.ts";
import type { PerilId } from "../../../../shared/ui-types.ts";

export function Glyph({ name, size = 22, filled = false }: { name: keyof typeof lineGlyphs | PerilId; size?: number; filled?: boolean }) {
  const paths = lineGlyphs[name];
  const filledPath = filled ? ({
    markets: "M4 10h4v9H4z M10 5h4v14h-4z M16 8h4v11h-4z",
    protect: "M3 10h7V5h4v5h7v4h-7v5h-4v-5H3z",
    wallet: "M4 7h16v12H4z M13 11v4h5v-4z",
  } as Record<string, string>)[name] : null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {filledPath ? <path d={filledPath} fill="currentColor" fillRule="evenodd" /> : paths.map((d) => <path key={d} d={d} fill={filled ? "currentColor" : "none"} fillOpacity={filled ? .16 : undefined} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  );
}
