import { BrandMark } from "@/components/brand-mark";

/** CSS phone frame mirroring the Storm Glass Markets screen — decorative, not interactive. */
export function PhoneMockup() {
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
