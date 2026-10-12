# SkyHedge Clock In — UX/UI redesign log

Worktree: `SkyHedge-clock-in-redesign`, branch `clock-in-redesign` (from `codex/clock-in-mobile` @ e00f28e). Nothing pushed or merged. `mobile/node_modules` is an untracked symlink to the main clone (not committed).

## Skills used
- `~/.codex/skills/open-design-frontend-design`: one committed direction, honest data states, no AI-slop glow/gradients.
- `~/.codex/skills/ui-ux-pro-max`: priority checks (accessibility, 48dp touch, ≥12sp text, semantic tokens, nav ≤5).
- Existing `mobile/DESIGN.md` (Signal Dark) treated as the brand contract.
- Also installed, not used yet: impeccable-design-polish, design-brief, design-md, nextlevel-ui-ux-pro-max, web-design-guidelines.

## Ranked UX problems (before)
1. Monolithic 1,150-line App.tsx with ~200 one-off styles. Hierarchy is inconsistent between screens.
2. 26 text styles at 10–11sp (metadata, pills, chart labels, signatures), which is illegible on Seeker and fails pro-max rule 6.
3. Protect flow: the progress stepper sat *below* the form and verification, so users had no orientation. The trigger (the actual contract term) had the same visual weight as the helper text.
4. Copy overload: every block carries a disclaimer paragraph, so the primary action competes with 3–4 notes.
5. Ad hoc buttons (Wallet used raw Pressables with a different radius and height from ActionButton). Buttons were inconsistent.
6. Decorative "liquid glass" and ambient aura chrome reads as consumer crypto, not enterprise insurance.
7. Explore: search, filters, examples, guide and catalog are all on one scroll before a decision.

## Direction: "Institutional Signal Dark"
Keep the Signal Dark semantic palette (it already passes contrast and is test-pinned), and make it more restrained. Use a strict type scale (display 32, title 24, heading 18, body 15, label 13, caption/overline 12, so nothing is below 12). Radii are 8/12/16 (no 18–22 pills on cards). Elevation comes from a surface step plus a 1px hairline, not glow. Contract terms get a rain-accent left rule, like a term sheet. There is one primary (mint) action per screen, and secondary actions are outlined.
Why: insurance/fintech buyers trust dense, calm, legible term presentation. Seeker is a small dark-OLED device.

## Commits
- 5bd6316 design: tokens (`type`, `radius`, `elevation`, `MIN_TOUCH`, `MIN_FONT`) + tests
- design: legible shared primitives and secondary action variant (`src/ui.tsx`)
- design: protect term-sheet hierarchy, stepper first, 12sp minimum, unified wallet actions (`App.tsx`)

## Commands / results
`npm run check` (tsc --noEmit): clean after every step. `npm run test:mobile`: 35 pass / 0 fail (33 original + 2 new token tests).
MWA/wallet logic untouched: `connect`, `submitApprovedAction` and `src/wallet.ts` are unchanged.

## Milestone 2 (Oct 12, ~1:10–1:30 AM ET)
1. **Flat app bar** (`20c32e7`): removed GlassBackdrop, AmbientGlassAura and every LiquidGlassSurface use in App.tsx (header, tab bar, Explore outcome, quote, wallet card). The header and tab bar are now a flat canvas with a 1px rule. Cards use the shared `styles.card` (surface + border, radius 12). The selected tab has a mint top rule instead of a filled pill. `src/liquid-glass.tsx` is kept for ScreenTransition/TactilePressable.
2. **One disclosure per screen** (`192f645`): new `Disclosure` primitive in `src/ui.tsx`. Weather, Explore, Protect and Wallet each have exactly one. Removed the Weather source note card, the Wallet "finalized reads" card, the Protect SKYT/USD/test disclaimers (merged into one), the inline "no value is estimated" lines and the error-banner footnote. All honesty claims are preserved in the per-screen disclosure.
3. **Explore restructure** (`2cb9a6d`): the picker is now search, then the Places list (with a Place→Risk→Evidence stepper), then an optional "Describe your plans" guide, then the disclosure. Removed the risk-before-place quick filters and the duplicate example buttons (the same 3 pilots are already in the list). The selected place shows the risk choice inside a raised "risk sheet" container, then the map.
4. **Weather chart labels** (`116389b`): `formatWeekLabel` ("2026-09-07" becomes "Sep 7") and `formatRainfallBarValue` (explicit "n/a"; one decimal under 10 mm) were added to `src/presentation.ts` with tests. They are used in both the Weather chart and the Explore mini chart. The chart is now in a bordered surface with a "Weekly rainfall · millimetres" header.
5. **Screens out of App.tsx**: SKIPPED as not low-risk right now. All screens share one ~200-entry StyleSheet and many helpers, so splitting them would be a large mechanical diff right before the deadline.

Checks after every step: `npm run check` is clean. `npm run test:mobile` is 37 pass / 0 fail (2 new chart-label tests). Wallet/MWA code is unchanged.

Screenshots/APK: not produced. The Pixel_7 emulator was booted at 1:11 AM by another workstream, and a USB device (SM02G406197714, likely the Seeker) is attached. Installing a debug build would overwrite `com.skyhedge.mobile` on those devices, so I didn't. react-native-web isn't installed, so web screenshots weren't possible either.

## Not yet verified
No on-device or emulator visual check yet.

## Left
- Explore: collapse the pre-decision scroll into a search, then a place list, then a risk sheet.
- Replace the header aura/liquid glass with a flat app bar.
- Split App.tsx screens into `src/screens/*`.
- Trim the disclaimer copy into one disclosure per screen.
- Weather chart labels.
- Screenshots on device.

## 2026-10-12 ~01:45 ET: Instrument revamp (overnight)
- Skills applied: open-design-frontend-design, ui-ux-pro-max, impeccable-design-polish.
- Direction is "Instrument": a calm, financial-terminal feel. Graphite canvas, one signal colour (glacier #5CC8FF for rain and primary action), gold #E8B04B only for money/payout, mint only for verified state. Purple and neon-mint CTAs removed.
- Token radii are now 6/10/14. All App.tsx card radii are unified to 12 (16 to 22 before). Eyebrows are uppercase muted overlines.
- New `PayoffProfile` (mobile/src/ui.tsx) on Protect shows the strike and the gold payout zone on a 0 to 2× scale.
- Commit 497d409. tsc clean, mobile tests 47/47.
- Mockup: docs/mockups/skyhedge-instrument-mockup.{html,png}, 3 screens (Markets, Protect ticket, Position). Proposed next step is to merge Weather into Markets for 3 tabs.
