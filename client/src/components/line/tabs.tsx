import { Glyph } from "./glyphs";

const TABS = [
  { id: "markets", label: "Markets", glyph: "markets" },
  { id: "protect", label: "Protect", glyph: "protect" },
  { id: "wallet", label: "Wallet", glyph: "wallet" },
] as const;

export function LineTabs({ tab, onTab }: { tab: string; onTab: (id: "markets" | "protect" | "wallet") => void }) {
  return (
    <nav className="ln-tabs" aria-label="Mobile navigation">
      {TABS.map((item) => (
        <button key={item.id} type="button" className="ln-tab ln-press" aria-selected={tab === item.id} onClick={() => onTab(item.id)}>
          <Glyph name={item.glyph} />
          {item.label}
        </button>
      ))}
    </nav>
  );
}
