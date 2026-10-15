import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/brand-mark";
import { PhoneMockup } from "@/components/phone-mockup";
import { WaitlistForm } from "@/components/waitlist-form";

const MARKETS = [
  { city: "Des Moines", detail: "IA · Rainfall · NOAA", status: "Live" as const },
  { city: "New York City", detail: "NY · Rainfall · NOAA", status: "Live" as const },
  { city: "Miami", detail: "FL · Rainfall · NOAA", status: "Live" as const },
  { city: "Chicago", detail: "IL · Rainfall · NOAA", status: "Live" as const },
  { city: "Toronto", detail: "ON · Rainfall · Environment Canada", status: "Soon" as const },
] as const;

const STEPS = [
  {
    title: "Pick a city and window",
    body: "Choose a researched rainfall market and the observation period you want protected.",
  },
  {
    title: "Buy protection from your wallet",
    body: "Approve a Devnet transaction in Phantom or Solflare. Premium and payout rules are fixed before you buy.",
  },
  {
    title: "Weather settles the claim",
    body: "If official station data hits the trigger, payout settles on Solana. Missing observations mean a premium refund — never a guessed number.",
  },
] as const;

const TRUST = [
  {
    title: "Official weather only",
    body: "Settlement reads NOAA observations for U.S. pilots. Values are never estimated or filled in.",
  },
  {
    title: "Refund if data is missing",
    body: "When the station cannot produce a reading for the window, premium refunds instead of forcing a fake outcome.",
  },
  {
    title: "Built for Solana Seeker",
    body: "Native Android experience for Seeker, with the same Storm Glass product on the web for Devnet testing.",
  },
  {
    title: "Devnet now",
    body: "SKYT and positions are test assets with no real-world value. Mainnet stays closed until evidence gates pass.",
  },
] as const;

const FAQ = [
  {
    q: "What is SkyHedge?",
    a: "Parametric rainfall protection on Solana. You buy coverage for a city and window; official weather data decides the payout automatically.",
  },
  {
    q: "Is this available today?",
    a: "Devnet is open for testers. Join the waitlist for updates as more cities and Seeker builds ship. Nothing here has real-world value yet.",
  },
  {
    q: "Which cities are live?",
    a: "Des Moines is the Devnet pilot with NOAA settlement. New York City, Miami, and Chicago are listed as live rainfall markets in research; Toronto opens when Environment Canada evidence is finalized.",
  },
  {
    q: "What happens if weather data is missing?",
    a: "SkyHedge never invents a rainfall total. If the observation is unavailable for the window, the premium is refunded.",
  },
  {
    q: "Do I need a Solana Seeker?",
    a: "The Seeker app is the primary mobile path. The web app at /app works with Phantom or Solflare on Devnet for the same flows.",
  },
] as const;

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} className={`wl-reveal ${visible ? "wl-reveal--in" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}

export default function WaitlistPage() {
  useEffect(() => {
    document.title = "SkyHedge — weather risk, settled on-chain";
    document.documentElement.dataset.uiMode = "customer";
  }, []);

  return (
    <div className="wl">
      <a href="#waitlist" className="sr-only z-[100] rounded-lg bg-[var(--identity)] px-4 py-3 text-[var(--action-text)] focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to waitlist form
      </a>

      <header className="wl-nav">
        <div className="wl-nav__inner">
          <Link to="/" className="wl-nav__brand" aria-label="SkyHedge home">
            <BrandMark size={36} />
            <span>SkyHedge</span>
          </Link>
          <div className="wl-nav__actions">
            <a href="#how" className="wl-nav__link">How it works</a>
            <a href="#markets" className="wl-nav__link">Markets</a>
            <Link to="/app" className="sky-btn-ghost wl-nav__app">Open app</Link>
            <a href="#waitlist" className="sky-btn-primary wl-nav__cta">Join waitlist</a>
          </div>
        </div>
      </header>

      <main>
        <section className="wl-hero" aria-labelledby="wl-hero-title">
          <div className="wl-hero__copy wl-hero__copy--enter">
            <p className="wl-hero__eyebrow">Parametric rainfall · Solana Devnet</p>
            <h1 id="wl-hero-title" className="wl-hero__title">Weather risk, settled on-chain.</h1>
            <p className="wl-hero__lead">
              Buy rainfall protection from a wallet. Official station data hits the trigger — payout settles automatically. No claims forms.
            </p>
            <div id="waitlist" className="wl-hero__form">
              <WaitlistForm variant="hero" />
              <p className="wl-hero__fine">Devnet only. No spam. Unsubscribe anytime.</p>
            </div>
          </div>
          <div className="wl-hero__phone wl-hero__phone--enter">
            <PhoneMockup />
          </div>
        </section>

        <Reveal>
          <section id="how" className="wl-section" aria-labelledby="wl-how-title">
            <p className="wl-section__eyebrow">How it works</p>
            <h2 id="wl-how-title" className="wl-section__title">Three steps from forecast to settlement</h2>
            <ol className="wl-steps">
              {STEPS.map((step, index) => (
                <li key={step.title} className="wl-steps__item">
                  <span className="wl-steps__num" aria-hidden="true">{index + 1}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </Reveal>

        <Reveal>
          <section id="markets" className="wl-section" aria-labelledby="wl-markets-title">
            <p className="wl-section__eyebrow">Markets</p>
            <h2 id="wl-markets-title" className="wl-section__title">Live rainfall cities</h2>
            <p className="wl-section__lead">Des Moines is the Devnet pilot. Other live cities are researched rainfall markets; Toronto stays soon until Environment Canada evidence lands.</p>
            <ul className="wl-markets">
              {MARKETS.map((market) => (
                <li key={market.city} className="wl-markets__row">
                  <div>
                    <p className="wl-markets__city">{market.city}</p>
                    <p className="wl-markets__detail">{market.detail}</p>
                  </div>
                  <span className={market.status === "Live" ? "wl-markets__status wl-markets__status--live" : "wl-markets__status wl-markets__status--soon"}>
                    {market.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>

        <Reveal>
          <section id="trust" className="wl-section" aria-labelledby="wl-trust-title">
            <p className="wl-section__eyebrow">Trust</p>
            <h2 id="wl-trust-title" className="wl-section__title">Evidence first, always</h2>
            <div className="wl-trust">
              {TRUST.map((item) => (
                <article key={item.title} className="wl-trust__card">
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section id="faq" className="wl-section" aria-labelledby="wl-faq-title">
            <p className="wl-section__eyebrow">FAQ</p>
            <h2 id="wl-faq-title" className="wl-section__title">Questions, answered plainly</h2>
            <div className="wl-faq">
              {FAQ.map((item) => (
                <details key={item.q} className="wl-faq__item">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="wl-section wl-section--cta" aria-labelledby="wl-cta-title">
            <h2 id="wl-cta-title" className="wl-section__title">Get early access</h2>
            <p className="wl-section__lead">Join the waitlist for Seeker and city launch notes. Or open the Devnet app now.</p>
            <div className="wl-cta-row">
              <WaitlistForm variant="compact" />
              <Link to="/app" className="sky-btn-ghost">Open Devnet app</Link>
            </div>
          </section>
        </Reveal>
      </main>

      <footer className="wl-footer">
        <div className="wl-footer__inner">
          <div className="wl-footer__brand">
            <BrandMark size={28} />
            <div>
              <p className="wl-footer__name">SkyHedge</p>
              <p className="wl-footer__tag">Parametric weather protection on Solana</p>
            </div>
          </div>
          <nav className="wl-footer__links" aria-label="Footer">
            <a href="#how">How it works</a>
            <a href="#markets">Markets</a>
            <a href="#faq">FAQ</a>
            <Link to="/app">App</Link>
          </nav>
          <p className="wl-footer__legal">Devnet test assets have no real-world value. Not financial advice.</p>
        </div>
      </footer>
    </div>
  );
}
