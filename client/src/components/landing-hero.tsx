import { MapPin, SlidersHorizontal, Waves } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

const FEATURES = [
  {
    icon: MapPin,
    title: "Markets by city",
    body: "Browse researched locations with live and soon statuses. Des Moines rainfall is the Devnet pilot.",
  },
  {
    icon: SlidersHorizontal,
    title: "Peril picker",
    body: "Rain is live today. Wind and snow stay marked soon until station evidence and pricing rules are ready.",
  },
  {
    icon: Waves,
    title: "Paid from live weather data",
    body: "Settlement reads official observations only. Missing values are never estimated or filled in.",
  },
] as const;

/** CSS phone frame mirroring the Storm Glass Markets screen — decorative, not interactive. */
function PhoneMockup() {
  return (
    <div className="sky-phone" aria-hidden="true">
      <div className="sky-phone__bezel">
        <div className="sky-phone__notch" />
        <div className="sky-phone__screen">
          <div className="sky-phone__status">
            <span>9:41</span>
            <span className="sky-phone__devnet">Devnet</span>
          </div>
          <div className="sky-phone__brand">
            <BrandMark size={26} />
            <span>SkyHedge</span>
          </div>
          <p className="sky-phone__headline">Get paid when the weather ruins your plans.</p>
          <div className="sky-phone__card sky-phone__card--hero">
            <div className="sky-phone__row">
              <span>Des Moines, IA</span>
              <span className="sky-phone__live">Live</span>
            </div>
            <div className="sky-phone__bars">
              {[35, 55, 40, 70, 48, 62, 30].map((height, index) => (
                <span key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className="sky-phone__row sky-phone__row--muted">
              <span>From NOAA station</span>
              <span className="sky-mono">DSM</span>
            </div>
          </div>
          <div className="sky-phone__card">
            <div className="sky-phone__row">
              <span>Toronto</span>
              <span className="sky-phone__soon">Soon</span>
            </div>
            <p className="sky-phone__card-sub">Opens when Environment Canada evidence is finalized.</p>
          </div>
          <div className="sky-phone__cta">Protect this window</div>
        </div>
      </div>
    </div>
  );
}

export function LandingHero() {
  return (
    <section className="sky-landing" aria-labelledby="sky-landing-title">
      <div className="sky-landing__copy">
        <p className="sky-landing__eyebrow">SkyHedge on Solana Devnet</p>
        <h1 id="sky-landing-title" className="sky-landing__title">Weather risk, settled on-chain.</h1>
        <p className="sky-landing__lead">
          Parametric rainfall protection you buy from a wallet. If official weather data hits the trigger, payout settles automatically — no claims forms.
        </p>
        <div className="sky-landing__actions">
          <a href="#markets-workspace" className="sky-btn-primary">Explore markets</a>
          <a href="/?tab=protect&city=des-moines" className="sky-btn-ghost">Open Protect</a>
        </div>
        <ul className="sky-landing__features">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="sky-landing__feature">
              <span className="sky-landing__feature-icon" aria-hidden="true"><Icon className="h-4 w-4" /></span>
              <div>
                <h2>{title}</h2>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <PhoneMockup />
    </section>
  );
}
