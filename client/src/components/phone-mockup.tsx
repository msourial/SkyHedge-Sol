import { CONSUMER_CITIES } from "../../../shared/consumer-cities";

type Screen = "markets" | "protect" | "wallet";

/** Marketing screenshots: status bar cropped; Devnet pill never rendered (EXPO_PUBLIC_MARKETING_SHOTS capture). */
const SCREENS: Record<Screen, { src: string; alt: string }> = {
  markets: { src: "/mockups/landing/markets.png", alt: "SkyHedge Markets screen" },
  protect: { src: "/mockups/landing/protect.png", alt: "SkyHedge Protect screen" },
  wallet: { src: "/mockups/landing/wallet.png", alt: "SkyHedge Wallet screen" },
};

/**
 * Seeker / modern Android device frame.
 * Outer radius ~44px; screen clipped to matching inner radius; no status-bar chrome.
 */
export function PhoneMockup({
  screen = "markets",
  className = "",
  glow = false,
  parallax = false,
  float = false,
}: {
  screen?: Screen;
  className?: string;
  glow?: boolean;
  parallax?: boolean;
  float?: boolean;
}) {
  const asset = SCREENS[screen];
  return (
    <div
      className={[
        "sky-phone",
        glow ? "sky-phone--glow" : "",
        parallax ? "sky-phone--parallax" : "",
        float ? "sky-phone--float" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="sky-phone__bezel">
        <div className="sky-phone__speaker" aria-hidden="true" />
        <div className="sky-phone__screen">
          <img
            src={asset.src}
            alt={asset.alt}
            width={390}
            height={844}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}

/** Hero phone. New York leads. New York and Des Moines have weekly and monthly windows open. */
export function PhonePlans({
  glow = false,
  parallax = false,
  float = false,
}: {
  glow?: boolean;
  parallax?: boolean;
  float?: boolean;
}) {
  return (
    <div
      className={["sky-phone", glow ? "sky-phone--glow" : "", parallax ? "sky-phone--parallax" : "", float ? "sky-phone--float" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="sky-phone__bezel">
        <div className="sky-phone__speaker" aria-hidden="true" />
        <div className="sky-phone__screen">
          <div className="sky-phone__plans">
            <p className="sky-phone__kicker">Markets</p>
            <p className="sky-phone__headline">Where are your plans?</p>
            <ul>
              {CONSUMER_CITIES.map((city) => {
                const open = city.code === "NYC" || city.code === "DSM";
                const label = open ? "Weekly · Monthly open" : city.status === "soon" ? "Opens soon" : "Opening shortly";
                return (
                  <li key={city.code}>
                    <p>{city.moment}</p>
                    <span>
                      {city.city}
                      <em className={open ? "is-open" : "is-soon"}>{label}</em>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Sticky how-it-works phone with crossfading screens (no remount/layout shift). */
export function PhoneMockupStack({
  active,
  glow = true,
}: {
  active: Screen;
  glow?: boolean;
}) {
  const order: Screen[] = ["markets", "protect", "wallet"];
  return (
    <div className={["sky-phone", "sky-phone--stack", glow ? "sky-phone--glow" : ""].filter(Boolean).join(" ")}>
      <div className="sky-phone__bezel">
        <div className="sky-phone__speaker" aria-hidden="true" />
        <div className="sky-phone__screen sky-phone__screen--stack">
          {order.map((id) => {
            const asset = SCREENS[id];
            return (
              <img
                key={id}
                src={asset.src}
                alt=""
                width={390}
                height={844}
                loading="lazy"
                decoding="async"
                draggable={false}
                className={id === active ? "is-active" : undefined}
                aria-hidden={id !== active}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
