import { useState } from "react";
import { Link } from "react-router-dom";
import * as copy from "../../../../shared/ui-copy.ts";
import { perilById } from "../../../../shared/peril-registry.ts";
import { marketModels, type MarketModel } from "../../../../shared/ui-discovery.ts";
import type { CoverSize, PerilId, WindowQuote } from "../../../../shared/ui-types.ts";
import { FigurePair, Instrument, PerilFilter } from "./discovery";

export function LandingScreen({ quotes, loading, failed, initialPeril = "rain", onConnect, nowSeconds = Math.floor(Date.now() / 1000) }: { quotes: WindowQuote[]; loading: boolean; failed: boolean; initialPeril?: PerilId; onConnect?: () => void; nowSeconds?: number }) {
  const [peril, setPeril] = useState<PerilId>(initialPeril);
  const [cover, setCover] = useState<CoverSize>(100);
  const markets: MarketModel[] = marketModels(quotes, nowSeconds, cover);
  const market = markets.find((m) => m.peril === peril);
  return <div className="ln ln-landing" data-motion="run"><nav className="ln-landing-nav"><Link to="/" className="ln-wordmark">SkyHedge</Link><Link className="ln-landing-open" to="/app">{copy.OPEN_APP}</Link></nav>
    <h1>{copy.LANDING_TITLE}</h1><p className="ln-landing-sub">{copy.LANDING_SUB}</p>
    <PerilFilter all={false} value={peril} onChange={(id) => { if (id !== "all") setPeril(id); }} markets={markets}/>
    {market ? <>
      <p className="ln-sub">{market.city} · {market.station}</p><div className="ln-demo-stage"><Instrument peril={peril} rungs={market.rungs} trigger={market.trigger} unit={market.unit}/><div><p className="ln-label">{copy.TRIGGER}</p><p className="ln-fig-l">{market.trigger} <span className="ln-label">{market.unit}</span></p><p className="ln-label">{copy.CHANCE}</p><p className="ln-fig-m">{market.chance}</p></div></div>
      <div className="ln-chips" role="group" aria-label={copy.COVER}>{([50, 100, 250] as const).map((size) => <button className="ln-chip ln-press" key={size} aria-pressed={cover === size} onClick={() => setCover(size)}>{size}</button>)}</div>
      <FigurePair loss={market.loss} gain={market.gain}/><p className="ln-note">{market.note}</p>
    </> : <div className="ln-empty"><Instrument peril={peril} state={loading && peril !== "cold" ? "loading" : "ghost"} size="tile"/><p role={failed && peril !== "cold" ? "alert" : "status"}>{peril === "cold" ? copy.notOpenLine(peril, "") : loading ? copy.GETTING_QUOTE : failed ? copy.CHAIN_ERROR : `${perilById(peril)?.label} · ${copy.NOT_OPEN_YET}`}</p></div>}
    {onConnect ? <button className="ln-cta" onClick={onConnect}>{copy.CONNECT_WALLET}</button> : null}
    <ol className="ln-how">{copy.HOW_IT_WORKS.map((step) => <li key={step}>{step}</li>)}</ol><h2 className="ln-title">{copy.HOW_SETTLES_TITLE}</h2><p className="ln-note">{copy.HOW_IT_SETTLES}</p><footer className="ln-label">SkyHedge · {copy.DEVNET_TAG}</footer>
  </div>;
}
