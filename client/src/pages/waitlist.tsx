import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/brand-mark";
import { PhoneMockup } from "@/components/phone-mockup";
import { WaitlistForm } from "@/components/waitlist-form";

const MARKETS = [
  { city: "Des Moines", detail: "IA · Rain · NOAA", status: "Live" as const },
  { city: "New York", detail: "NY · Rain · NOAA", status: "Live" as const },
  { city: "Miami", detail: "FL · Rain · NOAA", status: "Live" as const },
  { city: "Chicago", detail: "IL · Rain · NOAA", status: "Live" as const },
  { city: "Toronto", detail: "ON · Rain · Environment Canada", status: "Soon" as const },
] as const;

const STEPS = [
  {
    title: "Pick a city",
    body: "Open Markets, choose a rainfall window, and see the trigger before you pay.",
    screen: "markets" as const,
  },
  {
    title: "Set your coverage",
    body: "On Protect, pick how much SKYT you want back if the station hits the trigger.",
    screen: "protect" as const,
  },
  {
    title: "Approve in your wallet",
    body: "Connect Phantom or Seeker Wallet. Premium and payout rules are fixed on-chain.",
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
    q: "Which cities are live?",
    a: "Des Moines, New York, Miami, and Chicago are listed as live rainfall markets. Toronto opens when Environment Canada evidence is finalized.",
  },
  {
    q: "What happens if weather data is missing?",
    a: "SkyHedge never invents a rainfall total. If the observation is unavailable for the window, the premium is refunded.",
  },
  {
    q: "Do I need a Solana Seeker?",
    a: "The Seeker app is the primary mobile path. The web app at /app works with Phantom on Devnet for the same flows.",
  },
] as const;

function useReveal(threshold = 0.14) {
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
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);
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

function usePhoneParallax(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        const view = window.innerHeight || 1;
        const progress = (rect.top + rect.height * 0.35) / view;
        const offset = Math.max(-18, Math.min(18, (0.45 - progress) * 36));
        node.style.setProperty("--wl-parallax", `${offset.toFixed(2)}px`);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [enabled]);
  return ref;
}

export default function WaitlistPage() {
  const heroPhoneRef = usePhoneParallax(true);

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
            <BrandMark size={34} />
            <span>SkyHedge</span>
          </Link>
          <nav className="wl-nav__links" aria-label="Primary">
            <a href="#how">How it works</a>
            <a href="#markets">Markets</a>
            <a href="#faq">FAQ</a>
          </nav>
          <a href="#waitlist" className="wl-nav__cta">
            Join waitlist
          </a>
        </div>
      </header>

      <main>
        <section className="wl-hero" aria-labelledby="wl-hero-title">
          <div className="wl-hero__copy wl-hero__copy--enter">
            <h1 id="wl-hero-title" className="wl-hero__title">
              Weather risk, settled on-chain.
            </h1>
            <p className="wl-hero__lead">
              Buy rainfall protection from your wallet. Official station data hits the trigger — payout settles on Solana.
            </p>
            <div id="waitlist" className="wl-hero__form">
              <WaitlistForm variant="hero" />
              <p className="wl-hero__fine">Devnet only. No spam.</p>
            </div>
          </div>
          <div ref={heroPhoneRef} className="wl-hero__phone wl-hero__phone--enter">
            <PhoneMockup screen="markets" glow parallax />
          </div>
        </section>

        <Reveal>
          <section id="how" className="wl-section wl-section--how" aria-labelledby="wl-how-title">
            <div className="wl-section__head">
              <h2 id="wl-how-title" className="wl-section__title">
                How it works
              </h2>
              <p className="wl-section__lead">Three screens. One Devnet path from city to settlement.</p>
            </div>
            <ol className="wl-steps">
              {STEPS.map((step, index) => (
                <li key={step.title} className={`wl-steps__item wl-steps__item--${index % 2 === 0 ? "ltr" : "rtl"}`}>
                  <div className="wl-steps__copy">
                    <span className="wl-steps__num" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                  <div className="wl-steps__phone">
                    <PhoneMockup screen={step.screen} />
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </Reveal>

        <Reveal>
          <section id="markets" className="wl-section" aria-labelledby="wl-markets-title">
            <div className="wl-section__head">
              <h2 id="wl-markets-title" className="wl-section__title">
                Live markets
              </h2>
              <p className="wl-section__lead">Rainfall cities on Devnet research. Toronto stays soon until evidence lands.</p>
            </div>
            <ul className="wl-markets">
              {MARKETS.map((market) => (
                <li key={market.city} className="wl-markets__chip">
                  <div>
                    <p className="wl-markets__city">{market.city}</p>
                    <p className="wl-markets__detail">{market.detail}</p>
                  </div>
                  <span
                    className={
                      market.status === "Live"
                        ? "wl-markets__status wl-markets__status--live"
                        : "wl-markets__status wl-markets__status--soon"
                    }
                  >
                    {market.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>

        <Reveal>
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
        </Reveal>

        <Reveal>
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
        </Reveal>

        <Reveal>
          <section className="wl-section wl-section--cta" aria-labelledby="wl-cta-title">
            <h2 id="wl-cta-title" className="wl-section__title">
              Join the waitlist
            </h2>
            <p className="wl-section__lead">Get Seeker and city launch notes. Or open the Devnet app now.</p>
            <div className="wl-cta-row">
              <WaitlistForm variant="compact" />
              <Link to="/app" className="wl-cta-secondary">
                Open app
              </Link>
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
              <p className="wl-footer__tag">Weather risk, settled on Solana</p>
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
