import { CHANCE, MAX_LOSS, MULTIPLE, NOT_OPEN_WORD, YOUR_COVER, triggerHeader } from "../../../../shared/ui-copy.ts";
import type { ChainRowModel } from "../../../../shared/ui-view.ts";

export function Chain({ unit, rows, footnote, onSelect }: { unit: string; rows: ChainRowModel[]; footnote: string | null; onSelect: (trigger: number) => void }) {
  return (
    <section className="ln-chain" aria-label="Trigger chain">
      <div className="ln-chain-head">
        <span>{triggerHeader(unit)}</span>
        <span>{CHANCE}</span>
        <span>{MULTIPLE}</span>
        <span>{MAX_LOSS} (SKYT)</span>
      </div>
      <div className="ln-rows" role="radiogroup" aria-label="Triggers">
        {rows.map((row) => (
          <button
            key={row.trigger}
            type="button"
            className="ln-row ln-press"
            role={row.inert ? undefined : "radio"}
            aria-checked={row.inert ? undefined : row.selected}
            aria-disabled={row.inert || undefined}
            disabled={row.inert}
            data-open={row.open ? "true" : "false"}
            data-selected={row.selected ? "true" : "false"}
            aria-label={row.name}
            onClick={() => { if (!row.inert) onSelect(row.trigger); }}
          >
            {row.selected ? <i className="ln-row-tick" /> : null}
            <span>
              {row.selected ? <i className="ln-row-mark" /> : null}
              {row.triggerLabel.replace(` ${unit}`, "")}
              {row.topTag ? <small>{row.topTag}</small> : null}
              {row.yourCover ? <small>{YOUR_COVER}</small> : null}
            </span>
            <span className="ln-fig-m">{row.chance.replace("%", "")}<span className="ln-fig-minor">%</span></span>
            <span className="ln-fig-m">{row.multiple}</span>
            <span className="ln-fig-m">{row.maxLoss ?? NOT_OPEN_WORD}</span>
          </button>
        ))}
      </div>
      {footnote ? <p className="ln-note">{footnote}</p> : null}
    </section>
  );
}
