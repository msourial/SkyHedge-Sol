import { brandMark } from "../../../shared/storm-glass";

/** Web isometric umbrella — geometry matches mobile/src/BrandMark.tsx. */
export function BrandMark({ size = 34, tile = true, className }: { size?: number; tile?: boolean; className?: string }) {
  const glyphSize = tile ? size * 0.8 : size;
  const glyph = (
    <svg width={glyphSize} height={glyphSize} viewBox={brandMark.viewBox} aria-hidden="true" focusable="false">
      <path d="M512 230 L262 520 L387 490Z" fill={brandMark.panel1} />
      <path d="M512 230 L387 490 L512 520Z" fill={brandMark.panel2} />
      <path d="M512 230 L512 520 L637 490Z" fill={brandMark.panel3} />
      <path d="M512 230 L637 490 L762 520Z" fill={brandMark.panel4} />
      <path d="M512 520 L512 720 Q512 760 472 760" fill="none" stroke={brandMark.handle} strokeWidth={40} strokeLinecap="round" />
      <circle cx={512} cy={225} r={24} fill={brandMark.tip} />
    </svg>
  );
  if (!tile) return <span className={className} style={{ display: "inline-flex", lineHeight: 0 }}>{glyph}</span>;
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: brandMark.tile,
        border: `1px solid ${brandMark.tileBorder}`,
        alignItems: "center",
        justifyContent: "center",
        boxShadow: brandMark.tileGlow,
        lineHeight: 0,
        flexShrink: 0,
      }}
    >
      {glyph}
    </span>
  );
}
