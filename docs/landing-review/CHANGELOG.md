# Landing pass — 2026-10-15

## Hero uniqueness + spacing (follow-up)

- Hero phone uses Protect ticket (`protect.png`); How-it-works step 1 keeps Markets — no duplicate Markets shot.
- Tightened hero bottom padding, `#how` section padding, and sticky step `min-height` (42/36vh → 32/28vh).
- Shots: `fix-hero-desktop-1440.png`, `fix-hero-mobile-390.png`, `fix-how-desktop-1440.png`, `fix-hero-how-junction-1440.png`.

## Phone + motion polish (follow-up)

Skills: **frontend-design**, **react-bits** (restraint — CSS motion only), **21st-ui-review**.

- Rebuilt Seeker/Android frame: 44px outer radius, matching inner clip, graphite bezel, edge highlight, glacier glow + shadow.
- Marketing screenshots in `client/public/mockups/landing/` — status bar cropped, Devnet badge removed (disclosure stays in page copy/footer).
- Hero: staggered fade/rise (title → lead → form), 300–500ms ease-out, ~12px travel.
- Phone: 3px float + scroll parallax; how-it-works sticky stack crossfades Markets → Protect → Wallet.
- Market cards: hover lift + border glow; status dots soft pulse.
- Content visible by default; `prefers-reduced-motion` disables float/pulse/stagger.
- Shots: `before-phone-*` / `after-phone-*` (1440 + 390).

## Skill 1 · refero-design

References: **airpayy.com** (primary), **Nuri sticky-phone crypto banking** (secondary), **Keel / mobile-crypto product hero** (secondary).

Eight techniques adopted:

1. Product phone as the section spine (sticky device, copy scrolls).
2. Distinct screen per step — Markets → Protect → Wallet.
3. Fused pill waitlist (email + CTA).
4. Sparse nav — logo, anchors, one primary CTA.
5. One job per section — short H2 + lead + one visual system.
6. Rich market cards + horizontal snap-scroll on mobile.
7. Body contrast floor `#A9B4C7` (`C.bodyOnNavy`) on navy.
8. Motion enhances only — content readable by default; `prefers-reduced-motion` respected.

**Reference lock:** Storm Glass navy + rain CTA + BrandMark umbrella; sticky-phone narrative + airpayy pill CTA; no fake metrics.

## Skill 2 · 21st-ui-review + design-critique (before)

| Severity | Issue |
|----------|--------|
| **High** | `.wl-reveal` started at `opacity: 0` — below-fold content invisible until IO fired |
| **High** | How-it-works: small type, dead space, phone not sticky / screen swap unclear |
| **High** | Evidence + FAQ body used `--muted` / `--faint` — too light on navy |
| **High** | Hero `letter-spacing: -0.05em` (too tight) |
| **Med** | Markets chips weak; mobile overflow / weak hierarchy |
| **Med** | Hero phone ~300px — needs ~25% larger + stronger glacier glow |
| **Low** | Form placeholder without `…`; touch targets mixed 44/48 |

## Skills 3–5 · brand + build + motion

- Tokens from `shared/storm-glass.ts` + web BrandMark matching `mobile/src/BrandMark.tsx`.
- Added `C.bodyOnNavy` (`#A9B4C7`); landing `--wl-body` maps to it (contrast **8.95:1** on canvas).
- Sticky how-it-works phone swaps Markets / Protect / Wallet; mobile stacks per-step phones.
- Markets → rich glass cards, snap-scroll &lt;1100px.
- Hero tracking `-0.02em`; phone **375px** desktop; stronger glacier glow.
- Reveal: always ≥0.92 opacity; enhance on intersect only.
- React Bits **BlurText** (fetched live) on hero; skipped under reduced motion. Adapted to `framer-motion`.

## Skill 6 · accessibility + web-design-guidelines

- Skip link, labels, `spellCheck={false}` on email, placeholder `…`.
- Focus-visible ring preserved; tap targets ≥48px (`--min-touch`).
- `scroll-margin-top` on anchors; FAQ summaries ≥48px.
- No `outline: none` without replacement; motion gated.

## Skill 7 · re-review

Remaining **high/med** from pass 1 addressed. Residual **low**: sticky step inactive opacity 0.58 (intentional hierarchy); markets card partial peek on mobile is intentional snap affordance.

## Screenshots

| | Desktop 1440 | Mobile 390 |
|--|--------------|------------|
| Before | `before-desktop-1440.png` | `before-mobile-390.png` |
| After | `after-desktop-1440.png` | `after-mobile-390.png` |
| Extra | `after-how-desktop.png` | `after-markets-mobile.png` |

## Rules kept

- No fake numbers / testimonials
- Never “insurance”
- Map WIP untouched
- Waitlist `POST /api/waitlist` unchanged
