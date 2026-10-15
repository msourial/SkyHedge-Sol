type Screen = "markets" | "protect" | "wallet";

/** Marketing-only screenshots: status bar cropped, Devnet badge removed. */
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
            loading="eager"
            decoding="async"
            fetchPriority={screen === "protect" ? "high" : "auto"}
            draggable={false}
          />
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
                loading="eager"
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
