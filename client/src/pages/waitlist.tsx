import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/brand-mark";
import { PhoneMockup, PhoneMockupStack, PhonePlans } from "@/components/phone-mockup";
import { WaitlistForm } from "@/components/waitlist-form";
import { CONSUMER_CITIES } from "../../../shared/consumer-cities";

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
    a: "New York (Central Park), Dallas (DFW), and Des Moines are the rainfall cities. Des Moines already has weekly and monthly windows. New York and Dallas use the same NOAA ladder once you sign those Devnet markets. Toronto stays closed until Environment Canada data is in.",
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

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Content stays readable; motion only lifts opacity/transform slightly when in view. */
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (prefersReducedMotion()) {
      setVisible(true);
      return;
    }
    setVisible(false);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    // If already in view on mount (fast scroll / short viewport), reveal immediately.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92) setVisible(true);
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
    if (prefersReducedMotion()) return;
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

export default function WaitlistPage() {
  const heroPhoneRef = usePhoneParallax(true);
  const { active, stepRefs } = useStickyStepScreen();
  const activeScreen = STEPS[active]?.screen ?? "markets";

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
          <div className="wl-hero__copy">
            <h1 id="wl-hero-title" className="wl-hero__title">
              Wedding in Central Park this Saturday?
            </h1>
            <p className="wl-hero__lead">
              Pick the city and the days. If NOAA rain at the station reaches the threshold, the payout lands in your
              wallet.
            </p>
            <div id="waitlist" className="wl-hero__form">
              <WaitlistForm variant="hero" />
              <p className="wl-hero__fine">Devnet only. No spam.</p>
            </div>
          </div>
          <div ref={heroPhoneRef} className="wl-hero__phone wl-hero__phone--enter">
            <PhonePlans glow parallax float />
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
                      <span className="wl-how__num" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
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
                  <PhoneMockupStack active={activeScreen} glow />
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section id="markets" className="wl-section" aria-labelledby="wl-markets-title">
            <div className="wl-section__head">
              <h2 id="wl-markets-title" className="wl-section__title">
                Where are your plans?
              </h2>
              <p className="wl-section__lead">
                New York first. Dallas and Des Moines stay on the same weekly and monthly rain ladder. Toronto opens
                later.
              </p>
            </div>
            <ul className="wl-markets" aria-label="Rainfall cities">
              {CONSUMER_CITIES.map((market) => (
                <li key={market.code} className="wl-markets__card">
                  <div className="wl-markets__top">
                    <p className="wl-markets__city">{market.city}</p>
                    <span
                      className={
                        market.code === "DSM"
                          ? "wl-markets__status wl-markets__status--live"
                          : "wl-markets__status wl-markets__status--soon"
                      }
                    >
                      {market.code === "DSM" ? "Weekly · Monthly open" : market.status === "soon" ? "Opens soon" : "Next window opening shortly"}
                    </span>
                  </div>
                  <p className="wl-markets__peril">{market.moment}</p>
                  <p className="wl-markets__source">{market.payout}</p>
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
