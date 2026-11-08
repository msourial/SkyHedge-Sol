Welcome screenshots are generated locally and intentionally excluded from Git.

- `welcome.png`: exported app at 412×915, first launch, top of screen.
- `welcome-full.png`: same composition; all welcome sections fit without scrolling.
- `welcome-about-entry.png`: Markets header with About; market requests unavailable in the local export preview.

Copies also live in `/workspace/welcome/`.

Focused EGM self-review: surveyed landing, wallet restore, navigation, shared copy,
Line headers, fonts, safe areas, and preference storage before implementing only
welcome and its entry points. Checked copy requirements and prohibited claims;
kept LandingLine exported and Protect visuals unchanged. Independent storage fails
open to welcome; wallet restore no longer dismisses it. Existing safe-area and
scroll containers support large text; controls exceed 48dp, have accessible labels,
and do not depend on color. No welcome animation; existing transitions respect
reduced motion. Browser checks exercised first visit, subsequent visit, both About
entries, returning to Protect, enlarged text, and restored-wallet welcome gating.
Native TalkBack and device rendering remain untested on this host.
