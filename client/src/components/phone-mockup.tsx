type Screen = "markets" | "protect" | "wallet";

const SCREENS: Record<Screen, { src: string; alt: string }> = {
  markets: { src: "/mockups/markets.png", alt: "SkyHedge Markets screen" },
  protect: { src: "/mockups/protect.png", alt: "SkyHedge Protect screen" },
  wallet: { src: "/mockups/wallet.png", alt: "SkyHedge Wallet screen" },
};

/** Clean device frame wrapping a real Storm Glass app screenshot. */
export function PhoneMockup({
  screen = "markets",
  className = "",
  glow = false,
  parallax = false,
}: {
  screen?: Screen;
  className?: string;
  glow?: boolean;
  parallax?: boolean;
}) {
  const asset = SCREENS[screen];
  return (
    <div
      className={[
        "sky-phone",
        glow ? "sky-phone--glow" : "",
        parallax ? "sky-phone--parallax" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="sky-phone__bezel">
        <div className="sky-phone__notch" aria-hidden="true" />
        <div className="sky-phone__screen">
          <img
            src={asset.src}
            alt={asset.alt}
            width={390}
            height={844}
            loading="eager"
            decoding="async"
            fetchPriority={screen === "markets" ? "high" : "auto"}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
