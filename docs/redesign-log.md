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

## Not yet verified
No on-device or emulator visual check yet.

## Left
- Explore: collapse the pre-decision scroll into a search, then a place list, then a risk sheet.
- Replace the header aura/liquid glass with a flat app bar.
- Split App.tsx screens into `src/screens/*`.
- Trim the disclaimer copy into one disclosure per screen.
- Weather chart labels.
- Screenshots on device.
