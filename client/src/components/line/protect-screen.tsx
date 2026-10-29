import { useRef } from "react";
import { CITIES, PERILS, perilOpen } from "../../../../shared/peril-registry.ts";
import { DEVNET_TAG, MONTH, WEEK } from "../../../../shared/ui-copy.ts";
import { instrumentArt } from "../../../../shared/ui-instrument.ts";
import type { CoverSize, PerilId } from "../../../../shared/ui-types.ts";
import type { NotOpenLink, ProtectModel } from "../../../../shared/ui-view.ts";
import type { SignAction } from "../../../../shared/ui-sign.ts";
import { Chain } from "./chain";
import { LineArt } from "./draw";
import { Glyph } from "./glyphs";
import { InfoSheet, ModalSheet, PayBar, SignSheet, type SignSheetData } from "./pay-bar";
import { Ticket } from "./ticket";

export type SheetName = "city" | "info" | "sign" | null;

export function ProtectScreen(props: {
  model: ProtectModel;
  cityId: string;
  windowStart: string;
  sheet: SheetName;
  motion: "still" | "run";
  sign: SignSheetData | null;
  onSignAction: (action: SignAction) => void;
  onSheet: (sheet: SheetName) => void;
  onPeril: (peril: PerilId) => void;
  onTenor: (tenor: "weekly" | "monthly") => void;
  onCity: (cityId: string) => void;
  onGo: (link: NotOpenLink) => void;
  onSelect: (trigger: number) => void;
  onCover: (cover: CoverSize) => void;
  onConnect: () => void;
  onWallet: () => void;
  onRetry: () => void;
}) {
  const { model } = props;
  const root = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);
  const art = model.hero ? instrumentArt({ peril: model.peril, rungs: model.rungs, selected: model.selected,
    reading: model.reading, state: model.instrument, size: "hero", unit: model.unit }) : null;
  const shiftPeril = (index: number) => {
    const next = PERILS[(index + PERILS.length) % PERILS.length];
    props.onPeril(next.id);
    root.current?.querySelector<HTMLButtonElement>(`[role="tab"][data-peril="${next.id}"]`)?.focus();
  };
  return (
    <div ref={root} className="ln ln-protect" data-motion={props.motion} data-peril={model.peril}>
      <div className="ln-page" ref={(node) => { if (node) node.inert = props.sheet != null; }}>
        <div className="ln-scroll" data-testid="protect-scroll">
          <header className="ln-head">
            <div className="ln-city-heading">
              <button type="button" className="ln-city ln-press" onClick={() => props.onSheet("city")}>
                <h1 className="ln-title">{model.cityName}</h1><Glyph name="chevron" size={24} />
              </button>
              <span className="ln-label ln-devnet">{DEVNET_TAG}</span>
            </div>
            <div className="ln-tenor" role="group" aria-label="Window">
              {([['weekly', WEEK], ['monthly', MONTH]] as const).map(([tenor, label]) => <button key={tenor} type="button"
                aria-pressed={model.tenor === tenor} data-open={model.tenorOpen[tenor]} onClick={() => props.onTenor(tenor)}>{label}</button>)}
            </div>
          </header>
          <p className="ln-sub" title={model.subline ?? undefined}>{model.subline}</p>
          <div className="ln-switch" role="tablist" aria-label="Weather" onKeyDown={(event) => {
            const index = PERILS.findIndex((peril) => peril.id === model.peril);
            if (event.key === "ArrowRight") { event.preventDefault(); shiftPeril(index + 1); }
            if (event.key === "ArrowLeft") { event.preventDefault(); shiftPeril(index - 1); }
            if (event.key === "Home") { event.preventDefault(); shiftPeril(0); }
            if (event.key === "End") { event.preventDefault(); shiftPeril(PERILS.length - 1); }
          }}>
            {PERILS.map((peril) => {
              const open = perilOpen({ cityId: props.cityId, peril: peril.id, windowStart: props.windowStart, tenor: model.tenor });
              return <button key={peril.id} type="button" role="tab" className="ln-press" data-peril={peril.id}
                tabIndex={model.peril === peril.id ? 0 : -1} aria-selected={model.peril === peril.id} data-open={open}
                onClick={() => props.onPeril(peril.id)}><Glyph name={peril.id} size={24} filled={open} /><span>{peril.label}</span></button>;
            })}
            <i className="ln-peril-underline" aria-hidden="true" style={{ transform: `translateX(${PERILS.findIndex((peril) => peril.id === model.peril) * 100}%)` }} />
          </div>
          {model.hero && art ? <div className="ln-stage" data-reading={model.hero.soFar != null}
            onTouchStart={(event) => { touch.current = event.changedTouches[0]?.clientX ?? null; }}
            onTouchEnd={(event) => {
              if (touch.current == null) return;
              const delta = (event.changedTouches[0]?.clientX ?? touch.current) - touch.current;
              const index = PERILS.findIndex((peril) => peril.id === model.peril);
              if (Math.abs(delta) > 48) shiftPeril(index + (delta < 0 ? 1 : -1));
              touch.current = null;
            }}>
            <div className="ln-instrument"><LineArt {...art} /></div>
            <div className="ln-readout">
              <p className="ln-label">{model.hero.label}</p>
              <p className="ln-hero-number" key={model.hero.numeral}><span className="ln-numeral">{model.hero.numeral}</span><span className="ln-unit">{model.hero.unit}</span></p>
              <div className="ln-hero-stats">
                <div><p className="ln-label">Chance</p><p className="ln-fig-m">{model.hero.chance}</p></div>
                <div><p className="ln-label">Multiple</p><p className="ln-fig-m">{model.hero.multiple}</p></div>
              </div>
              {model.hero.soFar ? <div className="ln-reading"><p className="ln-label">{model.hero.soFar.label}</p><p className="ln-fig-m">{model.hero.soFar.value}</p></div> : null}
            </div>
          </div> : null}
          {model.showChain ? <Chain unit={model.unit} rows={model.rows} footnote={null} onSelect={(trigger) => { if (trigger !== model.selected) navigator.vibrate?.(10); props.onSelect(trigger); }} /> : null}
          {model.footnotes.filter((note) => model.panel.kind !== "covered" || !note.startsWith("Only the highlighted trigger")).map((note) => <p className="ln-note ln-chain-note" key={note}>{note}</p>)}
          {model.ticket ? <Ticket ticket={model.ticket} chips={model.chips} cap={model.capMessage} onCover={props.onCover} onInfo={() => props.onSheet("info")} onWallet={props.onWallet} /> : null}
        </div>
        {model.panel.kind === "covered" ? null : <PayBar disabled={model.chips.some((chip) => chip.selected && chip.disabled)} panel={model.panel} ticket={model.ticket} onConnect={props.onConnect} onProtect={() => props.onSheet("sign")}
          onWallet={props.onWallet} onRetry={props.onRetry} onGo={props.onGo} />}
      </div>
      {props.sheet === "sign" && props.sign ? <SignSheet {...props.sign} onAction={props.onSignAction} /> : null}
      {props.sheet === "info" && model.ticket?.sheet ? <InfoSheet body={model.ticket.sheet} onClose={() => props.onSheet(null)} /> : null}
      {props.sheet === "city" ? <ModalSheet title="City" canDismiss onClose={() => props.onSheet(null)}>
        <h2>{model.cityName}</h2><ul className="ln-city-list">
          {CITIES.map((city) => <li key={city.id}><button type="button" aria-current={city.name === model.cityName}
            onClick={() => { props.onCity(city.id); props.onSheet(null); }}>{city.name}</button></li>)}
        </ul>
      </ModalSheet> : null}
    </div>
  );
}
