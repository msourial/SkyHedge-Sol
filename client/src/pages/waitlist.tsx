import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/brand-mark";
import { PhoneMockup, PhoneMockupStack, PhonePlans } from "@/components/phone-mockup";
import { WaitlistForm } from "@/components/waitlist-form";
import { CONSUMER_CITIES } from "../../../shared/consumer-cities";
import { chipClass, useSalesChips } from "@/lib/sales-chips";

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

/**
 * October rainfall normal for NY CITY CENTRAL PARK, millimetres.
 * Source: CITY_INDEX `new-york` monthlyNormalsMm[9] in shared/cities.ts.
 * Climatology prior (1991–2020), not a live station total.
 */
const NYC_OCTOBER_NORMAL_MM = 89;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Count a known figure once. The DOM already shows the final number if this never runs. */
function RainCount({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion() || typeof IntersectionObserver !== "function") return;
    let frame = 0;
    let played = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || played) return;
        played = true;
        observer.disconnect();
        const start = performance.now();
        const duration = 600;
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - (1 - t) ** 3;
          node.textContent = String(Math.round(value * eased));
          if (t < 1) frame = requestAnimationFrame(tick);
          else node.textContent = String(value);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      node.textContent = String(value);
    };
  }, [value]);
  return (
    <span ref={ref} className="wl-markets__rain-value">
      {value}
    </span>
  );
}

function HeroWeather() {
  return (
    <div className="wl-hero__weather" aria-hidden="true">
      <svg className="wl-hero__sky" viewBox="0 0 360 640" preserveAspectRatio="xMidYMid slice">
        <g className="wl-cloud wl-cloud--a" fill="currentColor">
          <ellipse cx="78" cy="108" rx="86" ry="18" />
          <ellipse cx="132" cy="98" rx="42" ry="16" />
        </g>
        <g className="wl-cloud wl-cloud--b" fill="currentColor">
          <ellipse cx="248" cy="196" rx="96" ry="16" />
          <ellipse cx="304" cy="186" rx="38" ry="14" />
        </g>
        <g className="wl-rain" fill="none" stroke="#7CC4FF" strokeWidth="1.6" strokeLinecap="round">
          <path d="M48 40 v28" />
          <path d="M96 70 v22" />
          <path d="M150 28 v26" />
          <path d="M210 64 v24" />
          <path d="M268 36 v30" />
          <path d="M318 78 v20" />
          <path d="M70 150 v24" />
          <path d="M188 120 v28" />
          <path d="M340 150 v22" />
        </g>
        <g transform="translate(150 430)">
          <rect x="16" y="8" width="32" height="144" rx="16" fill="#1C2433" stroke="#2A3444" strokeWidth="2" />
          <rect x="20" y="96" width="24" height="52" fill="#7CC4FF" />
          <line x1="48" x2="64" y1="70" y2="70" stroke="#F2C230" strokeWidth="2" />
        </g>
      </svg>
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
        const offset = Math.max(-14, Math.min(14, (0.45 - progress) * 28));
        const tilt = Math.max(-2.2, Math.min(2.2, (0.42 - progress) * 4.4));
        node.style.setProperty("--wl-parallax", `${offset.toFixed(2)}px`);
        node.style.setProperty("--wl-tilt", `${tilt.toFixed(2)}deg`);
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
  const heroPhoneRef = usePhoneParallax(true);
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
          <nav className="wl-nav__links" aria-label="Primary">
            <a href="#how">How it works</a>
            <a href="#markets">Markets</a>
            <a href="#faq">FAQ</a>
            <Link to="/developers">Developers</Link>
          </nav>
          <div className="wl-nav__actions">
            <Link to="/app" className="wl-cta-secondary wl-nav__app">
              Open web app
            </Link>
            <a href="#waitlist" className="wl-nav__cta">
              Join waitlist
            </a>
          </div>
        </div>
      </header>

      <main>
        <section ref={heroRef} className="wl-hero" aria-labelledby="wl-hero-title">
          <div className="wl-hero__copy">
            <h1 id="wl-hero-title" className="wl-hero__title">
              Rain on your plans? Get paid.
            </h1>
            <p className="wl-hero__lead">
              Pick the city and the days. If NOAA rain at the station reaches the threshold, the payout lands in your
              wallet.
            </p>
            <div id="waitlist" className="wl-hero__form">
              <div className="wl-hero__cta">
                <WaitlistForm variant="hero" />
                <Link to="/app?tab=markets&city=new-york" className="wl-cta-secondary">
                  Pick your city
                </Link>
                <Link to="/app" className="wl-cta-secondary">
                  Open web app
                </Link>
              </div>
              <p className="wl-hero__fine">Devnet only. No spam.</p>
            </div>
          </div>
          <div ref={heroPhoneRef} className="wl-hero__phone wl-hero__phone--enter">
            <HeroWeather />
            <PhonePlans glow parallax float />
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
                const chip = chips[market.code] ?? { label: "Opening shortly", tone: "soon" as const };
                return (
                <li key={market.code} className="wl-markets__card">
                  <div className="wl-markets__top">
                    <p className="wl-markets__city">{market.city}</p>
                    <span className={chipClass(chip, market.code === "NYC" && chip.tone === "live")}>
                      {chip.label}
                    </span>
                  </div>
                  <p className="wl-markets__peril">{market.moment}</p>
                  {market.code === "NYC" ? (
                    <p className="wl-markets__rain" aria-label={`${NYC_OCTOBER_NORMAL_MM} millimetres, October normal at Central Park`}>
                      <RainCount value={NYC_OCTOBER_NORMAL_MM} />
                      <span className="wl-markets__rain-unit">mm</span>
                      <span className="wl-markets__rain-note">October normal, Central Park</span>
                    </p>
                  ) : null}
                  <p className="wl-markets__source">{market.payout}</p>
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

        <section className="wl-section wl-section--cta" aria-labelledby="wl-cta-title">
            <h2 id="wl-cta-title" className="wl-section__title">
              Join the waitlist
            </h2>
            <p className="wl-section__lead">Get Seeker and city launch notes. Or open the Devnet app now.</p>
            <div className="wl-cta-row">
              <WaitlistForm variant="compact" />
              <Link to="/app" className="wl-cta-secondary">
                Open web app
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
