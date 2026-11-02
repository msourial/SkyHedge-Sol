import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CloudRain,
  Download,
  Globe2,
  Layers3,
  Pause,
  Play,
  ShieldCheck,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { WaitlistForm } from "@/components/waitlist-form";

const steps = [
  {
    name: "Choose",
    title: "Your place. Your weather.",
    copy: "Find a covered US location and choose the weather event that puts your plans or income at risk.",
    screen: "markets",
    alt: "SkyHedge Markets: browse locations and weather cover",
  },
  {
    name: "Protect",
    title: "A clear price. A clear payout.",
    copy: "Pick your cover. Review the premium, weather threshold and potential payout before you approve in Phantom.",
    screen: "protect",
    alt: "SkyHedge Protect: review weather coverage and its terms",
  },
  {
    name: "Collect",
    title: "Weather hits? One tap.",
    copy: "When the agreed weather threshold is met and verified, collect from the funded vault. No claims forms. No back and forth.",
    screen: "wallet",
    alt: "SkyHedge Wallet: connect your wallet and manage your cover",
  },
] as const;

function Brand() {
  return (
    <a className="brand" href="/" aria-label="SkyHedge home">
      <BrandMark size={35} tile={false} />
      <span>SkyHedge</span>
    </a>
  );
}

function Phone({
  screen,
  priority = false,
  className = "",
}: {
  screen: (typeof steps)[number]["screen"];
  priority?: boolean;
  className?: string;
}) {
  const step = steps.find((s) => s.screen === screen)!;
  return (
    <div className={`landing-phone ${className}`}>
      <div className="landing-phone__screen">
        <img
          src={`/mockups/landing/${screen}.webp`}
          width="478"
          height="1024"
          alt={step.alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
        />
      </div>
      <span className="landing-phone__key" aria-hidden="true" />
    </div>
  );
}

function RainChart() {
  return (
    <div className="rain-card">
      <div className="rain-card__heading">
        <span>
          <CloudRain aria-hidden="true" size={16} /> When the rain adds up
        </span>
        <span className="chart-tag">Illustration</span>
      </div>
      <div className="rain-card__value">A little more certainty.</div>
      <svg
        className="rain-chart"
        viewBox="0 0 280 93"
        fill="none"
        role="img"
        aria-label="Illustration of rainfall reaching an agreed payout threshold; not live market data"
      >
        <path d="M0 21H280M0 55H280M0 89H280" stroke="#2A3444" />
        <path d="M0 37H280" stroke="#A9B4C7" strokeDasharray="3 5" />
        <g className="rain-bars" fill="#354D66">
          {[13, 21, 18, 29, 25, 34, 41, 38, 47, 59, 65, 61, 75, 80].map(
            (h, i) => (
              <rect
                key={i}
                x={i * 20 + 2}
                y={89 - h}
                width="10"
                height={h}
                rx="3"
                style={{ animationDelay: `${i * 65}ms` }}
              />
            ),
          )}
        </g>
        <path
          className="rain-chart__line"
          d="M7 79L27 76L47 77L67 70L87 72L107 64L127 58L147 60L167 49L187 34L207 27L227 31L247 18L267 10"
          stroke="#7CC4FF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="267" cy="10" r="4" fill="#7CC4FF" />
      </svg>
      <div className="rain-card__footer">
        <span>Agreed threshold</span>
        <span>
          <Check aria-hidden="true" size={12} /> Payout triggered
        </span>
      </div>
    </div>
  );
}

function ProductDemo() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    if (!playing) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => setPlaying(false);
    if (reduced.matches) {
      stop();
      return;
    }
    reduced.addEventListener("change", stop);
    const timer = window.setTimeout(() => {
      if (active === steps.length - 1) setPlaying(false);
      else setActive(active + 1);
    }, 5000);
    return () => {
      window.clearTimeout(timer);
      reduced.removeEventListener("change", stop);
    };
  }, [playing, active]);
  return (
    <section
      className="product-demo section reveal"
      id="demo"
      aria-labelledby="demo-title"
    >
      <div className="demo-copy">
        <span className="eyebrow">A forecast. A plan. A little cover.</span>
        <h2 id="demo-title">
          Less weather worry.
          <br />
          More living.
        </h2>
        <p className="section-lead">See how simple weather hedging can feel.</p>
        <div
          className="demo-tabs"
          role="tablist"
          aria-label="Product walkthrough"
          aria-orientation="vertical"
        >
          {steps.map((step, index) => (
            <button
              key={step.name}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`step-${index}`}
              aria-controls="demo-panel"
              aria-selected={active === index}
              tabIndex={active === index ? 0 : -1}
              onClick={() => {
                setActive(index);
                setPlaying(false);
              }}
              onKeyDown={(event) => {
                const next =
                  event.key === "ArrowDown"
                    ? (index + 1) % steps.length
                    : event.key === "ArrowUp"
                      ? (index + steps.length - 1) % steps.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? steps.length - 1
                          : null;
                if (next === null) return;
                event.preventDefault();
                setActive(next);
                setPlaying(false);
                tabs.current[next]?.focus();
              }}
            >
              <span className="step-number">0{index + 1}</span>
              <span>
                <span className="demo-step-name">{step.name}</span>
                <span className="demo-step-title">{step.title}</span>
                {active === index && (
                  <span className="demo-step-copy">{step.copy}</span>
                )}
              </span>
              <ChevronRight aria-hidden="true" size={18} />
            </button>
          ))}
        </div>
        <button
          className="text-action demo-play"
          type="button"
          onClick={() => {
            if (!playing) setActive(0);
            setPlaying(!playing);
          }}
        >
          {playing ? (
            <Pause aria-hidden="true" size={15} />
          ) : (
            <Play aria-hidden="true" size={15} />
          )}{" "}
          {playing ? "Pause walkthrough" : "Play walkthrough"}
        </button>
        <p className="demo-disclaimer">
          Actual app screens. Availability varies by location.
        </p>
      </div>
      <div
        className="demo-stage"
        id="demo-panel"
        role="tabpanel"
        aria-labelledby={`step-${active}`}
        tabIndex={0}
      >
        <span className="stage-caption">
          THE APP, AT A GLANCE <span>0{active + 1} / 03</span>
        </span>
        <Phone screen={steps[active].screen} />
        <span className="stage-bottom">
          <ShieldCheck aria-hidden="true" size={14} /> Your cover, in your
          wallet.
        </span>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    root.current
      .querySelectorAll(".reveal")
      .forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
  return (
    <div className="landing" ref={root}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="landing-header">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#demo">How it works</a>
          <a href="#money">The money flow</a>
          <a href="#faq">FAQs</a>
        </nav>
        <a className="button nav-cta" href="/app">
          Open app <ArrowUpRight aria-hidden="true" size={16} />
        </a>
      </header>
      <main id="main">
        <section className="hero" aria-labelledby="headline">
          <div className="hero-copy">
            <span className="eyebrow hero-enter">
              <span className="eyebrow-dot" /> WEATHER HEDGING. FOR REAL LIFE.
            </span>
            <h1 className="hero-enter" id="headline">
              Weather on
              <br className="hero-break" /> your plans?
              <br />
              <span>Get paid.</span>
            </h1>
            <p className="lead hero-enter">
              For the days you can’t leave to chance.
              <br />
              Simple weather cover for your plans, your work,
              <br className="desktop-break" /> and everything you’re building.
            </p>
            <div className="hero-signup hero-enter">
              <WaitlistForm />
              <p className="form-note">
                Get launch updates. US first. Then the world.
              </p>
            </div>
            <div className="hero-links hero-enter">
              <a className="text-action" href="#demo">
                <span className="play-icon">
                  <Play aria-hidden="true" size={12} fill="currentColor" />
                </span>
                Watch demo
              </a>
              <span className="link-divider" />
              <a
                className="text-action"
                href="https://github.com/msourial/SkyHedge-Sol/releases"
                target="_blank"
                rel="noreferrer"
              >
                Download APK <Download aria-hidden="true" size={14} />
              </a>
            </div>
          </div>
          <div className="hero-visual hero-enter">
            <div className="hero-orbit" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <span className="visual-note">
              <span /> Made for whatever’s ahead.
            </span>
            <Phone screen="markets" priority className="hero-phone" />
            <RainChart />
            <span className="visual-footnote">
              REAL APP. REAL WEATHER DATA.
            </span>
          </div>
        </section>
        <section className="audiences reveal" aria-labelledby="audience-title">
          <div className="audiences-intro">
            <span className="eyebrow">Life happens outdoors.</span>
            <h2 id="audience-title">A little cover goes a long way.</h2>
          </div>
          <ul>
            {[
              "Farms & growers",
              "Outdoor events",
              "Aviation & travel",
              "Street vendors",
              "Construction",
              "Small businesses",
            ].map((item) => (
              <li key={item}>
                <ArrowUpRight aria-hidden="true" size={14} />
                {item}
              </li>
            ))}
          </ul>
        </section>
        <ProductDemo />
        <section
          className="money section reveal"
          id="money"
          aria-labelledby="money-title"
        >
          <div className="money-heading">
            <div>
              <span className="eyebrow">Clear from the first tap.</span>
              <h2 id="money-title">
                A forecast can be uncertain.
                <br />
                The money flow shouldn’t be.
              </h2>
            </div>
            <p className="section-lead">
              Collateral behind the cover.
              <br />
              Terms you can see before you buy.
            </p>
          </div>
          <ol className="money-flow">
            <li>
              <span className="flow-icon">
                <Layers3 aria-hidden="true" size={23} />
              </span>
              <span className="flow-index">01 / FUNDED</span>
              <h3>LPs back the vault.</h3>
              <p>
                Liquidity providers fund collateralized vaults, reserving the
                funds that back each market’s cover.
              </p>
              <ArrowRight aria-hidden="true" className="flow-arrow" size={20} />
            </li>
            <li>
              <span className="flow-icon">
                <ShieldCheck aria-hidden="true" size={23} />
              </span>
              <span className="flow-index">02 / PROTECTED</span>
              <h3>You choose your cover.</h3>
              <p>
                Pay a fixed premium. Know the location, weather threshold and
                potential payout before you commit.
              </p>
              <ArrowRight aria-hidden="true" className="flow-arrow" size={20} />
            </li>
            <li>
              <span className="flow-icon">
                <ArrowDown aria-hidden="true" size={23} />
              </span>
              <span className="flow-index">03 / SETTLED</span>
              <h3>If it hits, collect.</h3>
              <p>
                Verified weather data determines the outcome. When your cover
                pays, collect from the vault in one tap.
              </p>
            </li>
          </ol>
          <div className="money-fee">
            <span>
              LPs earn the margin for backing cover. SkyHedge takes{" "}
              <strong>1–4%</strong>.
            </span>
            <span>
              Clear terms. No claims forms.{" "}
              <ArrowUpRight aria-hidden="true" size={15} />
            </span>
          </div>
        </section>
        <section
          className="faq section reveal"
          id="faq"
          aria-labelledby="faq-title"
        >
          <div>
            <span className="eyebrow">Good to know.</span>
            <h2 id="faq-title">A clearer outlook.</h2>
            <p className="section-lead">
              A few answers before you get started.
            </p>
          </div>
          <div className="faq-items">
            <details>
              <summary>
                Who is SkyHedge for?<span aria-hidden="true">+</span>
              </summary>
              <p>
                Anyone whose plans or income are exposed to weather: farmers,
                event organizers, aviation and travel operators, street vendors,
                construction crews and small businesses. Each market has
                specific locations, dates and thresholds; cover depends on what
                is available.
              </p>
            </details>
            <details>
              <summary>
                What makes a payout happen?<span aria-hidden="true">+</span>
              </summary>
              <p>
                The weather threshold in your cover must be met during its
                agreed period, using the market’s stated data source. US
                rainfall markets use NOAA observations. Your actual business
                loss is not the trigger, and a loss alone does not guarantee a
                payout.
              </p>
            </details>
            <details>
              <summary>
                Where is it available?<span aria-hidden="true">+</span>
              </summary>
              <p>
                We’re starting with US weather markets and building toward
                global coverage. Join the waitlist for launch and location
                updates. The app shows which markets are available to explore.
              </p>
            </details>
            <details>
              <summary>
                Can I try it today?<span aria-hidden="true">+</span>
              </summary>
              <p>
                Yes. Open the app in your browser, or download the Android APK
                from our GitHub releases. SkyHedge currently runs on Solana
                Devnet using SKYT test tokens. There is no real money or live
                commercial cover in this version.
              </p>
            </details>
            <details>
              <summary>
                What happens after I join the waitlist?
                <span aria-hidden="true">+</span>
              </summary>
              <p>
                We save your email for SkyHedge launch and availability updates.
                You don’t need a wallet to join. No confirmation email is sent
                at this stage.
              </p>
            </details>
          </div>
        </section>
        <section
          className="closing reveal"
          id="join"
          aria-labelledby="join-title"
        >
          <span className="closing-mark">
            <BrandMark size={60} tile={false} />
          </span>
          <span className="eyebrow">You have plans. Keep them.</span>
          <h2 id="join-title">
            Whatever the weather.
            <br />
            <span>Be a little more ready.</span>
          </h2>
          <p>Be first to hear when SkyHedge opens near you.</p>
          <WaitlistForm variant="compact" />
          <span className="form-note">Just your email. No wallet needed.</span>
          <span className="closing-location">
            <Globe2 aria-hidden="true" size={14} /> Starting in the US. Built to
            go further.
          </span>
        </section>
      </main>
      <footer className="landing-footer">
        <div className="footer-top">
          <Brand />
          <p>Weather on your plans? Get paid.</p>
          <a className="text-action" href="/app">
            Explore the app <ArrowUpRight aria-hidden="true" size={16} />
          </a>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} SkyHedge</span>
          <span>Built on Solana. Weather data from NOAA.</span>
          <span>Devnet preview · SKYT test tokens · No real money</span>
        </div>
      </footer>
    </div>
  );
}
