import { COVER, gainCaption, infoSheetTitle, lossCaption, MAX_GAIN, MAX_LOSS } from "../../../../shared/ui-copy.ts";
import { lineTokens } from "../../../../shared/ui-tokens.ts";
import type { MoneyFigure, TicketModel } from "../../../../shared/ui-view.ts";
import type { CoverSize } from "../../../../shared/ui-types.ts";

export function MoneyCell({ figure, caption, label }: { figure: MoneyFigure; caption: string; label: string }) {
  return (
    <div className="ln-money-cell">
      <p className="ln-label">{label}</p>
      <p className="ln-money-figure">
        <span className="ln-fig-l">{figure.sign}{figure.whole}.{figure.fraction}</span>{" "}<span className="ln-fig-minor">SKYT</span>
      </p>
    </div>
  );
}

export function Ticket({ ticket, chips, cap, onCover, onInfo }: {
  ticket: TicketModel;
  chips: Array<{ cover: CoverSize; selected: boolean; disabled: boolean }>;
  cap: string | null;
  onCover: (cover: CoverSize) => void;
  onInfo: () => void;
}) {
  const diagram = ticket.diagram;
  const stepX = 28 + diagram.step * 300;
  const lossY = 56 + diagram.lossPx * .8;
  const gainY = 56 - diagram.gainPx * .8;
  return (
    <section aria-label="Ticket">
      <div className="ln-cover">
        {!ticket.readOnly ? <div className="ln-chips" role="group" aria-label={COVER}>
          {chips.map((chip) => (
            <button key={chip.cover} type="button" className="ln-chip ln-press" aria-pressed={chip.selected} disabled={chip.disabled} onClick={() => onCover(chip.cover)}>{chip.cover}</button>
          ))}
        </div> : <span className="ln-label">Your cover</span>}
        <button type="button" className="ln-info ln-press" aria-label={infoSheetTitle()} onClick={onInfo}>i</button>
      </div>
      {cap ? <p className="ln-note">{cap}</p> : null}
      <div className="ln-cells">
        <MoneyCell figure={ticket.loss} caption={lossCaption()} label={MAX_LOSS} />
        <MoneyCell figure={ticket.gain} caption={gainCaption()} label={MAX_GAIN} />
      </div>
      <svg className="ln-payoff" viewBox="0 0 361 112" role="img" aria-label={diagram.description}>
        <line x1="16" y1="56" x2="345" y2="56" stroke={lineTokens.tick} strokeWidth="1" />
        <line className="ln-diagram-segment" x1="16" y1={lossY} x2={stepX} y2={lossY} stroke={lineTokens.fg2} strokeWidth="3" strokeLinecap="butt" />
        <line x1={stepX} y1={lossY} x2={stepX} y2={gainY} stroke={lineTokens.slicker} strokeWidth="2" />
        <line className="ln-diagram-segment" x1={stepX} y1={gainY} x2="345" y2={gainY} stroke={lineTokens.fg} strokeWidth="3" strokeLinecap="butt" />
        <text x="20" y={Math.min(104, lossY + 16)} fill={lineTokens.fg2} fontSize="13" fontFamily="IBM Plex Mono, monospace">{diagram.lossLabel}</text>
        <text x="345" y={Math.max(16, gainY - 8)} fill={lineTokens.fg} fontSize="13" textAnchor="end" fontFamily="IBM Plex Mono, monospace">{diagram.gainLabel}</text>
        <text x={stepX} y="108" fill={lineTokens.fg2} fontSize="13" textAnchor="middle">{diagram.triggerLabel}</text>
      </svg>
      <dl>
        {ticket.signRows.filter((row) => row.label === "Payout" || row.label === "Chance" || row.label === "Break-even chance" || row.label === "Fee included").map((row) => (
          <div key={row.label} className="ln-sign-row">
            <dt>{row.label}</dt>
            <dd data-payout={row.payout ? "true" : "false"}>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="ln-sentence">{ticket.sentence}</p>
      <p className="ln-note">{ticket.salesClose}</p>
      {ticket.note ? <p className="ln-note">{ticket.note}</p> : null}
      {ticket.honesty ? <p className="ln-note">{ticket.honesty}</p> : null}
    </section>
  );
}
