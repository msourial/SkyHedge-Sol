# Landing review — Storm Glass redo

Side-by-side board: `comparison-board.png` (airpayy.com · skyhedge desktop · skyhedge mobile · Markets/Protect/Wallet app screens).

## Airpayy techniques studied

1. Hero type ~84px Inter, weight ~500, tracking ≈ −0.04em — extreme display vs muted body.
2. Aggressive negative space — first viewport is mostly headline + sub + CTA.
3. Centered hero column for copy/CTA (we adapt to split + phone for product proof).
4. Fused pill waitlist (input + button) and soft glowing pill nav CTA.
5. Real phone UI in a clean frame, often cropped by the section edge for depth.
6. One idea per section — short H2 + one line + product visual.
7. Calm motion — load/reveal only, not hover noise on every card.
8. Sparse nav — logo, few links, one primary CTA.

## Self-critique (5 gaps) → fixes

1. **Nav links hugged the CTA** instead of sitting centered like airpayy → 3-column nav grid.
2. **Hero glacier glow was too faint** behind the phone → larger radial bloom + bezel rim light.
3. **Screenshot status bars doubled the frame notch** → CSS crop (`object` / negative margin).
4. **Markets as a 5-up card grid felt SaaS-dense** → horizontal strip on small screens.
5. **Hero title `max-width: 11ch` cramped the line** → widened to 13ch with tighter tracking.

## Assets

- `skyhedge-desktop.png` / `skyhedge-mobile.png` — local landing after redo
- `airpayy-desktop.png` — reference hero
- `app-markets.png` / `app-protect.png` / `app-wallet.png` — real Storm Glass screens in the phone frames
