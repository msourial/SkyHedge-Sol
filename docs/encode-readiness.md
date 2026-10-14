# Encode Club Solana Hackathon 2026: readiness

Tracks: **Best Consumer App on Solana**, **Best Use of x402 on Solana** (x402 not integrated yet; planned / under evaluation).

## Deadlines (ET)

| Checkpoint | Deadline | What is required |
|---|---|---|
| Checkpoint 1 | **Oct 19, 2026, 7:59 AM ET** | Create the project and team on the platform. No submission. |
| Checkpoint 2 | **Nov 2, 2026, 6:59 AM ET** | Description, code, demo video, live demo, slides. |
| Final | **Nov 9, 2026, 6:59 AM ET** | Hard cut-off. |

## Checklist

Owner: **Miro** = needs Miro's account or decision · **On-chain** = needs an admin-wallet transaction · **Done** = complete in the repo.

| Item | Owner | Status |
|---|---|---|
| Mobile app audit, version 0.2.0 (3), tests passing | Done | Committed on `seeker-revamp` |
| README header + "For judges" section for Encode | Done | This commit |
| Push `seeker-revamp` commits to GitHub | Miro | Local only until approved |
| Checkpoint 1: create project, confirm name, tracks, team (solo?) | Miro | Open |
| Decide whether to keep the x402 track (needs a real x402 integration to be credible) | Miro | Open |
| Commit or drop the uncommitted map work-in-progress files, then redeploy web | Miro | Open |
| Set `OPENROUTER_API_KEY` on Vercel (guide currently runs in offline mode) | Miro | Open |
| Demo video (narrated, max 3 min) on Vimeo; replace `<<DEMO_VIDEO_URL>>` | Miro | Open |
| Encode pitch deck; replace `<<PITCH_DECK_URL>>` | Miro | Open |
| GitHub repo About description, homepage, topics | Miro | Open |
| New Des Moines sales window (current one closed Oct 13, 1:37 AM ET) | On-chain | Open |
| Create, fund and open Chicago, New York, Miami markets | On-chain | Open |
| Funding amount per market (see open decision) | Miro + On-chain | Open |

## Open decision: funding per market

The disabled legacy script `scripts/seed-markets.ts` deposits **2,000 SKYT** per market (`LP_FUND_PER_MARKET`) with a **10,000 SKYT** liquidity cap (`maxLiquidity`). The current plan says **10,000 SKYT** funding per market. These disagree. Decide the deposit amount (and whether the cap must rise) before any market is funded. Three markets at 10,000 SKYT each would need 30,000 SKYT in the admin wallet. No transactions have been sent.
