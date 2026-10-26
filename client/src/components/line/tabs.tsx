import { MARKETS_TITLE, WALLET_TITLE, PROTECT_TITLE } from "../../../../shared/ui-copy.ts";
import { Glyph } from "./glyphs";

const TABS = [
  { id: "markets", label: MARKETS_TITLE, glyph: "markets" },
  { id: "protect", label: PROTECT_TITLE, glyph: "protect" },
  { id: "wallet", label: WALLET_TITLE, glyph: "wallet" },
] as const;

export function LineTabs({ tab, onTab }: { tab: string; onTab: (id: "markets" | "protect" | "wallet") => void }) {
  return (
    <nav className="ln-tabs" aria-label="Mobile navigation">
      {TABS.map((item) => (
        <button key={item.id} type="button" className="ln-tab ln-press" aria-current={tab === item.id ? "page" : undefined} data-active={tab === item.id} onClick={() => onTab(item.id)}>
          <Glyph name={item.glyph} size={24} filled={tab === item.id} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
