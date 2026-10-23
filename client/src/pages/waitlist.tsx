import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/brand-mark";
import { PhoneMockup, PhoneMockupStack } from "@/components/phone-mockup";
import { WaitlistForm } from "@/components/waitlist-form";
import { CONSUMER_CITIES } from "../../../shared/consumer-cities";
import { useSalesChips } from "@/lib/sales-chips";
import { COVER_CHIPS, HOW_IT_SETTLES, HOW_IT_SETTLES_TITLE, HOW_IT_WORKS, LANDING_FINE, LANDING_HEADER_APP, LANDING_HERO_LEAD, LANDING_HERO_TITLE, LANDING_OPEN_APP, LANDING_WAITLIST, TORONTO_WAITING, gaugeWaterLevel, productStatusLabel, type CoverChip } from "../../../shared/protect-copy";
import { payGet } from "../../../shared/pay-get";
import { QuoteAmount } from "@/components/figure";
import { RainGauge, gaugeTicks } from "@/components/rain-gauge";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DevnetStatus } from "@/lib/types";

const STEPS = [
  {
    title: HOW_IT_WORKS[0],
    body: "Open Markets and choose the city whose station settles the window.",
    screen: "markets" as const,
  },
  {
    title: HOW_IT_WORKS[1],
    body: "On Protect, pick how much SKYT you want back if the station hits the trigger.",
    screen: "protect" as const,
  },
  {
    title: HOW_IT_WORKS[2],
    body: "The premium and the payout are fixed before you approve.",
    screen: "wallet" as const,
  },
] as const;

const TRUST = [
  {
    title: "NOAA station data",
    body: "Settlement reads official observations for U.S. pilots. Values are never estimated.",
  },
  {
    title: "Premium refunded if data is missing",
    body: "When the station cannot produce a reading for the window, the premium refunds.",
  },
  {
    title: "Solana Seeker + Phantom",
    body: "Native Android for Seeker, with the same Devnet product on the web via Phantom.",
  },
  {
    title: "Devnet today",
    body: "SKYT and positions are test assets with no real-world value. Mainnet stays closed.",
  },
] as const;

const FAQ = [
  {
    q: "What is SkyHedge?",
    a: "Parametric rainfall protection on Solana. You buy coverage for a city and window; official weather data decides the payout automatically.",
  },
  {
    q: "Is this available today?",
    a: "Devnet is open for testers. Join the waitlist for Seeker and city launch notes. Nothing here has real-world value yet.",
  },
  {
    q: "Which cities?",
    a: "New York, Chicago, Miami, Dallas, Los Angeles, Seattle, Boston, Austin, and Des Moines use NOAA rainfall on the same weekly and monthly ladder. A city shows Weekly · Monthly open only while those windows are actually selling on Devnet. Toronto stays closed until Environment Canada data is in.",
  },
  {
    q: "What if NOAA data is missing?",
    a: "The premium is refunded. SkyHedge does not invent a rainfall total. If the station has no valid observation for the window, the market is marked DataUnavailable and the premium comes back.",
  },
  {
    q: "Is this real money?",
    a: "No. Devnet test SKYT only for now. It has no real-world value, and mainnet stays closed.",
  },
  {
    q: "Can I pay by card?",
    a: "Not yet. Card payments for people without a wallet are coming later, after a legal review. Today you use Devnet test SKYT in Phantom or Seeker Wallet.",
  },
  {
    q: "Do I need a Solana Seeker?",
    a: "The Seeker app is the primary mobile path. The web app at /app works with Phantom on Devnet for the same flows.",
  },
] as const;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function LandingFigure() {
  const status = useQuery({ queryKey: ["devnet-status"], queryFn: () => api<DevnetStatus>("/api/devnet/status"), retry: false });
  const [cover, setCover] = useState<CoverChip>(100);
  const now = Math.floor(Date.now() / 1000);
  const next = (status.data?.cityWindows ?? [])
    .filter((window) => window.city === "new-york" && window.salesCloseAt != null && window.salesCloseAt > now && window.thresholdMmX100 && /^\d+$/.test(window.thresholdMmX100) && window.premiumRateBps != null && window.quoteProbabilityBps != null)
    .sort((left, right) => left.observationEnd - right.observationEnd)[0];
  const mm = next?.thresholdMmX100 ? Number(next.thresholdMmX100) / 100 : null;
  const maxMm = mm != null && mm > 0 ? mm * 1.25 : 1;
  const deal = next && mm != null && next.premiumRateBps != null && next.quoteProbabilityBps != null
    ? payGet({ coverageSkyt: cover, premiumRateBps: next.premiumRateBps, probabilityBps: next.quoteProbabilityBps })
    : null;
  return <figure className="landing-figure">
    <RainGauge labelled level={gaugeWaterLevel({ observedMm: null, maxMm, triggerMm: mm })} ticks={mm != null ? gaugeTicks([{ mm, selected: true }], maxMm) : []} label={mm != null ? `New York trigger line at ${mm} mm` : "Empty rain gauge"} />
    <div className="landing-figure__quote">
      <div className="landing-figure__chips" role="radiogroup" aria-label="New York cover amount">
        {COVER_CHIPS.map((chip) => <button key={chip} type="button" role="radio" aria-checked={chip === cover} className={chip === cover ? "gauge-chip gauge-chip--on" : "gauge-chip"} onClick={() => setCover(chip)}>{chip}</button>)}
      </div>
      {deal ? <>
        <p><span className="t-label">You pay</span> <QuoteAmount amount={deal.payLabel} /></p>
        <p><span className="t-label">You get</span> <QuoteAmount amount={deal.getLabel} slicker hero /></p>
      </> : <p className="t-small">New York isn't open yet.</p>}
    </div>
  </figure>;
}

function useStickyStepScreen() {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const nodes = stepRefs.current.filter(Boolean) as HTMLLIElement[];
    if (!nodes.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (!top?.target) return;
        const idx = nodes.indexOf(top.target as HTMLLIElement);
        if (idx >= 0) setActive(idx);
      },
      { rootMargin: "-35% 0px -45% 0px", threshold: [0.2, 0.5, 0.8] },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  return { active, stepRefs };
}

/** Steps stay fully readable. Motion only adds a rise after an observer exists. */
function useStepRise(stepRefs: { current: (HTMLLIElement | null)[] }) {
  useEffect(() => {
    if (prefersReducedMotion() || typeof IntersectionObserver !== "function") return;
    const nodes = stepRefs.current.filter(Boolean) as HTMLLIElement[];
    if (!nodes.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("wl-step--in");
          entry.target.classList.remove("wl-step--wait");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -6% 0px" },
    );
    nodes.forEach((node, index) => {
      node.style.setProperty("--wl-stagger", `${index * 70}ms`);
      const rect = node.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.9 && rect.bottom > 0) node.classList.add("wl-step--in");
      else {
        node.classList.add("wl-step--wait");
        observer.observe(node);
      }
    });
    return () => observer.disconnect();
  }, [stepRefs]);
}

function usePauseWhenHidden(ref: { current: HTMLElement | null }) {
  useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion() || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(
      ([entry]) => node.classList.toggle("is-quiet", !entry?.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
}

export default function WaitlistPage() {
  const heroRef = useRef<HTMLElement>(null);
  const { active, stepRefs } = useStickyStepScreen();
  useStepRise(stepRefs);
  usePauseWhenHidden(heroRef);
  const activeScreen = STEPS[active]?.screen ?? "markets";
  const chips = useSalesChips();

  useEffect(() => {
    document.title = "SkyHedge — weather risk, settled on-chain";
    document.documentElement.dataset.uiMode = "customer";
  }, []);

  return (
    <div className="wl">
      <a
        href="#waitlist"
        className="sr-only z-[100] rounded-lg bg-[var(--identity)] px-4 py-3 text-[var(--action-text)] focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to waitlist form
      </a>

      <header className="wl-nav">
        <div className="wl-nav__inner">
          <Link to="/" className="wl-nav__brand" aria-label="SkyHedge home">
            <BrandMark size={34} settle />
            <span>SkyHedge</span>
          </Link>
          <div className="wl-nav__actions">
            <Link to="/app" className="wl-nav__cta">
              {LANDING_HEADER_APP}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section ref={heroRef} className="wl-hero" aria-labelledby="wl-hero-title">
          <div className="wl-hero__copy">
            <h1 id="wl-hero-title" className="wl-hero__title">
              {LANDING_HERO_TITLE}
            </h1>
            <p className="wl-hero__lead">{LANDING_HERO_LEAD}</p>
            <LandingFigure />
            <div id="waitlist" className="wl-hero__form">
              <div className="wl-hero__cta">
                <Link to="/app" className="wl-nav__cta">
                  {LANDING_OPEN_APP}
                </Link>
                <a href="#join" className="wl-cta-secondary">
                  {LANDING_WAITLIST}
                </a>
              </div>
              <p className="wl-hero__fine">{LANDING_FINE}</p>
            </div>
          </div>
        </section>

        <section id="how" className="wl-section wl-section--how" aria-labelledby="wl-how-title">
            <div className="wl-section__head">
              <h2 id="wl-how-title" className="wl-section__title">
                How it works
              </h2>
              <p className="wl-section__lead">Three screens. One Devnet path from city to settlement.</p>
            </div>

            <div className="wl-how">
              <ol className="wl-how__steps">
                {STEPS.map((step, index) => (
                  <li
                    key={step.title}
                    ref={(el) => {
                      stepRefs.current[index] = el;
                    }}
                    className={`wl-how__step ${index === active ? "wl-how__step--active" : ""}`}
                    aria-current={index === active ? "step" : undefined}
                  >
                    <div className="wl-how__copy">
                      <h3>{step.title}</h3>
                      <p>{step.body}</p>
                    </div>
                    <div className="wl-how__mobile-phone">
                      <PhoneMockup screen={step.screen} />
                    </div>
                  </li>
                ))}
              </ol>
              <div className="wl-how__phone" aria-hidden="true">
                <div className="wl-how__phone-sticky">
                  <PhoneMockupStack active={activeScreen} glow={false} />
                </div>
              </div>
            </div>
          </section>

        <section id="markets" className="wl-section" aria-labelledby="wl-markets-title">
            <div className="wl-section__head">
              <h2 id="wl-markets-title" className="wl-section__title">
                Where are your plans?
              </h2>
              <p className="wl-section__lead">
                New York through Des Moines sit on the same NOAA weekly and monthly ladder. Toronto opens when Environment Canada data is in. Glacier blue means both windows are selling on Devnet.
              </p>
            </div>
            <ul className="wl-markets" aria-label="Rainfall cities">
              {CONSUMER_CITIES.map((market) => {
                const chip = chips[market.code];
                const status = market.slug === "toronto"
                  ? { text: TORONTO_WAITING, ink: "dry" as const }
                  : productStatusLabel(chip?.tone === "live" ? "live" : chip?.tone === "closed" ? "closed" : "soon");
                return (
                <li key={market.code} className="wl-markets__card">
                  <div className="wl-markets__top">
                    <p className="wl-markets__city">{market.city}</p>
                    <span className={`status-word status-word--${status.ink}`}>{status.text}</span>
                  </div>
                  <p className="wl-markets__peril">{market.moment}</p>
                  <p className="wl-markets__source">{market.source}</p>
                </li>
                );
              })}
            </ul>
          </section>

        <section id="trust" className="wl-section" aria-labelledby="wl-trust-title">
            <div className="wl-section__head">
              <h2 id="wl-trust-title" className="wl-section__title">
                Built on evidence
              </h2>
              <p className="wl-section__lead">No guessed rainfall. No custodian. Devnet until the gates pass.</p>
            </div>
            <ul className="wl-trust">
              {TRUST.map((item) => (
                <li key={item.title} className="wl-trust__row">
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </li>
              ))}
            </ul>
          </section>

        <section id="faq" className="wl-section" aria-labelledby="wl-faq-title">
            <div className="wl-section__head">
              <h2 id="wl-faq-title" className="wl-section__title">
                FAQ
              </h2>
            </div>
            <div className="wl-faq">
              {FAQ.map((item) => (
                <details key={item.q} className="wl-faq__item">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </section>

        <section id="settle" className="wl-section" aria-labelledby="wl-settle-title">
          <h2 id="wl-settle-title" className="wl-section__title">{HOW_IT_SETTLES_TITLE}</h2>
          <p className="wl-section__lead">{HOW_IT_SETTLES}</p>
        </section>

        <section id="join" className="wl-section wl-section--cta" aria-labelledby="wl-cta-title">
            <h2 id="wl-cta-title" className="wl-section__title">
              Join the waitlist
            </h2>
            <p className="wl-section__lead">Get Seeker and city launch notes. Or open the Devnet app now.</p>
            <div className="wl-cta-row">
              <WaitlistForm variant="compact" />
              <Link to="/app" className="wl-cta-secondary">
                {LANDING_OPEN_APP}
              </Link>
            </div>
          </section>
      </main>

      <footer className="wl-footer">
        <div className="wl-footer__inner">
          <div className="wl-footer__brand">
            <BrandMark size={28} />
            <div>
              <p className="wl-footer__name">SkyHedge</p>
              <p className="wl-footer__tag">Weather risk, settled on Solana</p>
            </div>
          </div>
          <nav className="wl-footer__links" aria-label="Footer">
            <a href="#how">How it works</a>
            <a href="#markets">Markets</a>
            <a href="#faq">FAQ</a>
            <Link to="/app">Open web app</Link>
          </nav>
          <p className="wl-footer__legal">Devnet test assets have no real-world value. Not financial advice.</p>
        </div>
      </footer>
    </div>
  );
}
