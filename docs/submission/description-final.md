# SkyHedge: Encode Club Solana Hackathon final description (draft for Miro's review)

## Short version (for a short field)

SkyHedge is parametric weather hedging on Solana for anyone whose plans or income depend on the weather: farmers, event organizers, flight operators, street vendors. Pick a city, a weather risk and a trigger, pay a fixed premium in Phantom, and collect a fixed payout if NOAA data shows the trigger hit. No claims forms. Every payout is already locked in a fully collateralised on-chain vault. Live on Solana Devnet at skyhedge.app/app and as a Seeker app. Track: Best Consumer App on Solana.

## Full version

**What we built**

SkyHedge lets a person or a small business hedge one weather risk from their phone in a few taps. A farmer worried about a dry month, a festival organizer worried about a rainy weekend, a charter operator or a street vendor who loses a day's revenue to a storm: each picks a city, a peril (rain first, with snow, wind and heat markets in progress), a window and a trigger such as "at least 6 mm of rain at NOAA's Central Park station, Nov 2 to 9". The app shows "Pay X, get Y if it hits", the chance from 10 years of NOAA history, and the most you can lose. One approval in Phantom buys the cover.

There are three screens: Markets (what is open, with the live forecast beside the station's history), Protect (pick the trigger and cover size) and Wallet (each open cover tracked against NOAA observations, and a Collect button when a payout is ready). It runs as a React Native app built for the Solana Seeker and as a web app at skyhedge.app/app.

**The problem**

Weather risk hits the people least able to absorb it. Traditional weather cover is slow, paperwork-heavy and sold in sizes built for large companies, so farmers, small event businesses and daily earners usually carry the risk alone. A parametric hedge fixes the payout and the trigger up front and lets public data decide, so there is nothing to claim and nothing to argue about. We are starting with US cities on NOAA data, then going worldwide as more national weather sources are added.

**How Solana powers it**

- **An Anchor program holds every rule.** Market terms (station, window, threshold), pricing, purchases, settlement, payouts and refunds are enforced on chain. Terms cannot be edited after a market is created.
- **Fully collateralised vaults.** Each market has its own PDA-owned vault funded by liquidity providers. A purchase is rejected unless the vault covers every payout already promised, so a buyer's payout is reserved the moment they buy.
- **Fees in the program, not on a slide.** The premium is the NOAA probability plus a 15% margin, plus a 1% protocol fee of the cover amount. On 100 SKYT of cover at a 20% chance you pay 24 SKYT, of which 1 SKYT is the fee.
- **The user signs everything.** The server builds unsigned transactions; the user approves purchases and payout claims in Phantom through Mobile Wallet Adapter on the Seeker or the Phantom extension on the web.
- **Built for small tickets.** Cover with no minimum size only works on a chain where transaction fees are tiny and confirmation is fast.

**Why you can trust the outcome**

The judges asked this directly, so here is the honest answer. After the window ends, a SkyHedge settlement worker reads NOAA's GHCN-Daily records for the market's station, rejects missing or quality-flagged days, and posts the total on chain with a hash of the NOAA records it used. The program only accepts that reading from the protocol's settlement authority and only if the station, methodology and window match the market exactly. Settlement is then a deterministic comparison with the threshold, which anyone can trigger. If no valid reading arrives within 7 days, anyone can mark the market data-unavailable and every buyer gets their full premium back. Every step is a Devnet transaction you can open on Solana Explorer and compare with NOAA's public record. What is still trusted today is that SkyHedge's key copies NOAA's number faithfully. Next we move that role to a decentralized oracle feed so no single SkyHedge key decides an outcome.

**Status**

Live on Solana Devnet with SKYT, a test token with no value. Program `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx`. Solo builder. Pre-launch, so no traction numbers are claimed.

**Track entered:** Best Consumer App on Solana.

<!-- x402 paragraph: include ONLY if Miro decides to enter the x402 track and a paid call is shown in the video.
**x402:** SkyHedge also sells its NOAA quote as a paid API for other apps and AI agents. `GET /api/x402/quote` answers HTTP 402 with x402 V2 payment terms in Devnet USDC; after the payment settles through the x402 facilitator, it returns the quote. A payment that is submitted but not yet final returns 202 so the client retries the same payment instead of paying twice. Docs at skyhedge.app/developers.
Then change the track line to: Best Consumer App on Solana and Best Use of x402 on Solana.
-->
