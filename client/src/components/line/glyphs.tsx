import { lineGlyphs } from "../../../../shared/ui-glyphs.ts";
import type { PerilId } from "../../../../shared/ui-types.ts";

export function Glyph({ name, size = 22 }: { name: keyof typeof lineGlyphs | PerilId; size?: number }) {
  const paths = lineGlyphs[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  );
}
