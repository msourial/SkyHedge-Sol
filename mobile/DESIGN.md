# SkyHedge Android Signal Dark system

The Android app is a calm, dark climate-fintech experience. It shares semantic status language with the future web refresh while preserving Android-native navigation and wallet behavior.

## Tokens

- Canvas `#080B14`; surface `#111827`; raised surface `#182235`; primary text `#F6F8FC`; secondary text `#A7B3C8`.
- Rain `#70D6FF` identifies weather, maps, and selected data. Mint `#32E6A1` means verified or finalized. Amber `#F5C66D` means research or pending. Coral `#FF8C91` means unavailable or failed. Violet `#9B8CFF` is reserved for product identity.
- Use a soft violet ambient field only in the app chrome and selected context. Do not add glow to every card or use gradients to hide hierarchy.

## Structure

- Mode: operate. Every screen has one visible primary action; technical details are disclosed only when useful.
- `ScreenHeader`, `SectionHeader`, `InsetSurface`, `StatusSignal`, `EvidenceTimeline`, and `PrimaryAction` are shared primitives. Do not recreate their hierarchy ad hoc in individual screens.
- Space Grotesk is for place names, decision headings, and important values. Inter is for controls, body, and metadata. Monospace is reserved for addresses, hashes, and signatures.
- Explore progresses from place to risk to evidence. After choosing a place, collapse search/list into a concise selected-place brief with a visible Change action.
- Protect leads with contract terms, amount, readiness, and one action. Wallet and program diagnostics live in expandable details.
- Weather shows only source-dated NOAA observations. Wallet shows only real finalized balances and positions.

## Trust and accessibility

- The map appears after the risk/evidence decision and draws only reference coordinates. It never implies an coverage boundary, a station marker, coverage, or live WeatherXM observations. Exact text location remains available when tiles fail.
- Preserve Android safe areas, system Back, 48dp controls, scalable fonts, TalkBack order, clear labels, status text in addition to color, and reduced-motion support.
- Never fabricate prices, rainfall observations, readiness, coverage, wallet balances, or transaction confirmation.
