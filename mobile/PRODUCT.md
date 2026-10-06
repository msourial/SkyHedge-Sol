# SkyHedge Android product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

People planning around weather, including event organizers and farmers, who need to understand whether a specific place and risk has a real protection contract. Solana Mobile hackathon reviewers also need to inspect the Devnet proof.

## Product Purpose

Help a person find a place, choose a weather risk, inspect NOAA evidence and contract terms, and—only when every prerequisite is verified—review a Devnet test quote and approve a Solana transaction in their wallet.

## Operating Context

The app runs natively on Android. It reads SkyHedge API and finalized Solana Devnet state. Mobile Wallet Adapter handles wallet approval on compatible Android devices.

## Capabilities and Constraints

- Rainfall is the sole protection pilot. Wind gust and new snowfall are research-only.
- NOAA is the sole settlement source. WeatherXM is not used to settle contracts.
- A listed place or reference marker is not an insured boundary or an available market.
- Ordinary dollar amounts are non-binding previews. SKYT is a separate Devnet test asset with no real-world value; it is not USD or USDC. The test position cap is 500 SKYT per wallet.
- AI guidance can explain existing areas and contracts, but cannot create or sign one.
- No balance, observation, quote, transaction, or payout may be invented for presentation.

## Evidence on Hand

The current app has API-backed NOAA weather, a 12-area research catalog, finalized Devnet status, wallet and portfolio reads, and wallet-approved transaction preparation. The approved OpenDesign place-first prototype is the visual reference. Des Moines may have a station package while its market remains Draft with an empty vault; those are distinct states.

## Product Principles

1. Start with the customer's place and weather concern, not blockchain terms.
2. Show what is known, what is unavailable, and why.
3. Separate preview dollars from actual test tokens.
4. Require explicit wallet approval and finalized proof for every test transaction.

## Accessibility & Inclusion

Use exact place names, scalable text, descriptive status language, screen-reader labels, and 48dp minimum touch targets.
