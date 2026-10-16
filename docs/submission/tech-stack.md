# Tech stack

| Layer | Stack |
| --- | --- |
| Mobile | Expo / React Native (Android), Solana Mobile Wallet Adapter, `@solana/web3.js` |
| Chain | Anchor program `skyhedge_protection` on Solana Devnet; SPL token **SKYT** |
| Server | Node / Express (TypeScript): quote engine, NOAA + Environment Canada providers, evidence builder, unsigned-tx builder, settlement runner |
| Web | React + Vite (Storm Glass waitlist + `/app` Devnet companion) |
| Hosting | Vercel (serverless API + static client) |
| Data | NOAA GHCN-Daily for US settlement; Environment Canada adapter for Toronto (not yet an open market) |
| Waitlist DB | Neon Postgres via `DATABASE_URL` (Drizzle); admin CSV export |

Settlement source of truth is **NOAA only** for live US markets. Incomplete, flagged, or malformed station data is rejected — never synthesized into a rainfall value.
