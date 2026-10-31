import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
const LinePreview = lazy(async () => { await import("./index.css"); return import("./pages/line-preview"); });
const Developers = lazy(async () => { await import("./index.css"); return import("./pages/developers"); });

function Brand() {
  return <a className="brand" href="/" aria-label="SkyHedge home"><svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 16a11 11 0 0 1 22 0H5Z" stroke="currentColor" strokeWidth="2.5"/><path d="M16 5v19a3 3 0 0 0 6 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>SkyHedge</a>;
}

function Landing() {
  return <div className="landing">
    <header><Brand/><span className="network"><i/>Solana Devnet</span></header>
    <main>
      <section className="hero" aria-labelledby="headline">
        <span className="eyebrow">A little cover. A lot less worry.</span>
        <h1 id="headline">Weather on your plans?<br/><span>Get paid.</span></h1>
        <p className="lead">The forecast can change. Your plans don’t have to.<br className="desktop-break"/> Get simple weather cover, with a fixed price and a clear payout.</p>
        <nav className="actions" aria-label="Get started">
          <a className="button primary" href="/app">Open app <span aria-hidden="true">↗</span></a>
          {/* TODO: Replace #demo with the published demo video URL. Docs only contain a local video path. */}
          <a className="button secondary" href="#demo">Watch demo <span aria-hidden="true">▷</span></a>
          <a className="download" href="https://github.com/msourial/SkyHedge-Sol/releases" target="_blank" rel="noreferrer">Download APK <span aria-hidden="true">↓</span></a>
        </nav>
        <p className="devnet-note">Try it with SKYT test tokens. No real money on Devnet.</p>
      </section>
      <section className="how" aria-labelledby="how-title">
        <div className="section-heading"><h2 id="how-title">Three steps. Then get on with your day.</h2><span>How it works</span></div>
        <ol>
          <li><span className="step">01</span><h3>Pick your weather.</h3><p>Choose a city market and a weather event you want cover for.</p></li>
          <li><span className="step">02</span><h3>Know your price.</h3><p>Buy cover with a fixed premium. See what you pay and what you could get.</p></li>
          <li><span className="step">03</span><h3>If it hits, get paid.</h3><p>If the weather event hits the trigger, you get paid automatically. No claims forms.</p></li>
        </ol>
      </section>
      <section className="money" aria-labelledby="money-title"><div><span className="eyebrow">Where the money goes</span><h2 id="money-title">A city vault.<br/>A shared upside.</h2></div><div className="money-copy"><p>Liquidity providers fund each city market vault and earn the margin for backing the cover.</p><p>SkyHedge takes <strong>1–4%</strong>. The premium and potential payout are clear before you buy.</p></div></section>
      <section className="demo-note" id="demo" aria-labelledby="demo-title"><h2 id="demo-title">Demo coming soon.</h2><p>The video is being prepared. You can explore the Devnet app today.</p></section>
    </main>
    <footer><span>SkyHedge © {new Date().getFullYear()}</span><span>Weather cover, built on Solana.</span><span>Devnet · Test tokens only</span></footer>
  </div>;
}

export default function App() {
  return <QueryClientProvider client={queryClient}><BrowserRouter><Routes>
    <Route path="/" element={<Landing/>}/>
    <Route path="/developers" element={<Suspense fallback={null}><Developers/></Suspense>}/>
    <Route path="/preview" element={<Suspense fallback={null}><LinePreview/></Suspense>}/>
    <Route path="*" element={<Landing/>}/>
  </Routes></BrowserRouter></QueryClientProvider>;
}
