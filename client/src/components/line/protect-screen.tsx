import { useState } from "react";
import { CITIES, PERILS, perilOpen } from "../../../../shared/peril-registry.ts";
import { CHANCE, DEVNET_TAG, MONTH, TRIGGER, WEEK } from "../../../../shared/ui-copy.ts";
import { instrumentArt } from "../../../../shared/ui-instrument.ts";
import type { CoverSize, PerilId } from "../../../../shared/ui-quote-types.ts";
import type { ProtectModel } from "../../../../shared/ui-view.ts";
import { Chain } from "./chain";
import { LineArt } from "./draw";
import { Glyph } from "./glyphs";
import { InfoSheet, PayBar, SignSheet } from "./pay-bar";
import { Ticket } from "./ticket";

export type SheetName = "city" | "info" | "sign" | null;

export function ProtectScreen(props: {
  model: ProtectModel;
  cityId: string;
  windowStart: string;
  sheet: SheetName;
  motion: "still" | "run";
  signError: string | null;
  onSheet: (sheet: SheetName) => void;
  onPeril: (peril: PerilId) => void;
  onTenor: (tenor: "weekly" | "monthly") => void;
  onCity: (cityId: string) => void;
  onSelect: (trigger: number) => void;
  onCover: (cover: CoverSize) => void;
  onConnect: () => void;
  onApprove: () => void;
  onWallet: () => void;
  onRetry: () => void;
}) {
  const { model } = props;
  const [touch, setTouch] = useState<number | null>(null);
  const art = instrumentArt({
    peril: model.peril,
    rungs: model.rungs,
    selected: model.selected,
    reading: model.reading,
    state: model.instrument,
    size: "stage",
    unit: model.unit,
  });
  const lineY = art.anchorY == null ? null : (art.anchorY / Number(art.viewBox.split(" ")[3])) * 248;
  const triggerText = model.selected == null ? null : `${formatTrigger(model.selected)}`;
  const chance = model.ticket?.chance ?? model.rows.find((row) => row.selected)?.chance ?? null;
  const shiftPeril = (step: number) => {
    const index = PERILS.findIndex((peril) => peril.id === model.peril);
    const next = PERILS[index + step];
    if (next) props.onPeril(next.id);
  };
  return (
    <div className="ln" data-motion={props.motion} data-peril={model.peril}>
      <div className="ln-status"><span>{DEVNET_TAG}</span></div>
      <header className="ln-head">
        <button type="button" className="ln-city ln-press" onClick={() => props.onSheet("city")}>
          <h1 className="ln-title">{model.cityName}</h1>
          <Glyph name="chevron" size={18} />
        </button>
        <div className="ln-tenor" role="group" aria-label="Window">
          <button type="button" aria-pressed={model.tenor === "weekly"} onClick={() => props.onTenor("weekly")}>{WEEK}</button>
          <button type="button" aria-pressed={model.tenor === "monthly"} onClick={() => props.onTenor("monthly")}>{MONTH}</button>
        </div>
      </header>
      {model.subline ? <p className="ln-sub">{model.subline}</p> : null}
      <div className="ln-switch" role="tablist" aria-label="Weather" onKeyDown={(event) => {
        if (event.key === "ArrowRight") shiftPeril(1);
        if (event.key === "ArrowLeft") shiftPeril(-1);
      }}>
        {PERILS.map((peril) => {
          const open = perilOpen({ cityId: props.cityId, peril: peril.id, windowStart: props.windowStart, tenor: model.tenor });
          return (
            <button key={peril.id} type="button" role="tab" className="ln-press" aria-selected={model.peril === peril.id} data-open={open ? "true" : "false"} onClick={() => props.onPeril(peril.id)}>
              <Glyph name={peril.id} size={16} />
              <span>{open ? <i className="ln-dot" style={{ background: peril.tint }} /> : null}{peril.label}</span>
            </button>
          );
        })}
      </div>
      <div
        className="ln-stage"
        onTouchStart={(event) => setTouch(event.changedTouches[0]?.clientX ?? null)}
        onTouchEnd={(event) => {
          if (touch == null) return;
          const delta = (event.changedTouches[0]?.clientX ?? touch) - touch;
          if (delta > 48) shiftPeril(-1);
          if (delta < -48) shiftPeril(1);
          setTouch(null);
        }}
      >
        {lineY != null ? <div className="ln-rule" data-paid={model.instrument === "paid" ? "true" : "false"} style={{ top: lineY }} /> : null}
        <div className="ln-instrument"><LineArt ops={art.ops} viewBox={art.viewBox} label={art.label} width={art.width} height={art.height} /></div>
        <div className="ln-readout" style={lineY != null ? { top: lineY } : { top: 96 }}>
          <div className="ln-readout-above">
            {chance ? <><p className="ln-label">{CHANCE}</p><p className="ln-fig-m">{chance}</p></> : null}
            {triggerText ? <p className="ln-label">{TRIGGER}</p> : null}
          </div>
          {triggerText ? <p className="ln-fig-xl">{triggerText}<span className="ln-unit"> {model.unit}</span></p> : null}
          <div className="ln-readout-below">
            {model.instrument === "loading" ? <div className="ln-skel" /> : null}
            <p className="ln-label">{model.soFarLabel}</p>
            <p className="ln-fig-m">{model.soFarValue}</p>
            {model.soFarSince ? <p className="ln-label">{model.soFarSince}</p> : null}
          </div>
        </div>
      </div>
      {model.odds ? <p className="ln-odds">{model.odds}</p> : null}
      {model.showChain ? <Chain unit={model.unit} rows={model.rows} footnote={model.footnote} onSelect={props.onSelect} /> : model.footnote ? <p className="ln-note">{model.footnote}</p> : null}
      {model.blocked ? <p className="ln-note">{model.blocked}</p> : null}
      {model.ticket ? <Ticket ticket={model.ticket} chips={model.chips} cap={model.capMessage} onCover={props.onCover} onInfo={() => props.onSheet("info")} /> : null}
      <PayBar panel={model.panel} ticket={model.ticket} onConnect={props.onConnect} onProtect={() => props.onSheet("sign")} onApprove={props.onApprove} onWallet={props.onWallet} onRetry={props.onRetry} onGo={props.onCity} />
      {props.sheet === "sign" && model.ticket ? <SignSheet ticket={model.ticket} busy={model.panel.kind === "signing"} error={props.signError} onClose={() => props.onSheet(null)} onApprove={props.onApprove} /> : null}
      {props.sheet === "info" && model.ticket?.sheet ? <InfoSheet body={model.ticket.sheet} onClose={() => props.onSheet(null)} /> : null}
      {props.sheet === "city" ? (
        <div className="ln-sheet-back" onClick={() => props.onSheet(null)}>
          <div className="ln-sheet" role="dialog" aria-label="City" onClick={(event) => event.stopPropagation()}>
            <h2>{model.cityName}</h2>
            <ul className="ln-city-list">
              {CITIES.map((city) => (
                <li key={city.id}><button type="button" aria-current={city.name === model.cityName} onClick={() => { props.onCity(city.id); props.onSheet(null); }}>{city.name}</button></li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatTrigger(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
