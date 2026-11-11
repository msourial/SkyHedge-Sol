# Web app and landing

The Vite React client serves landing `/` and the pm-AMM trading app at `/app` and every app subroute. The previous Expo export is excluded from web builds. Android/Seeker code and its API routes remain unchanged.

See [pm-AMM web operating guide](pm-amm-web/README.md) for devnet markets, trade/Collect semantics, wallet setup, NOAA evidence and resolver trust limits.

Use `npm ci`, `npm run check`, `npm run build:site`, then `node --import tsx scripts/web-preview.ts` for the static site and existing API handlers on port 5002. `npm run dev` serves React through Vite and Express. `npm run build && npm start` builds/serves React plus the Express server. Native dependencies are not needed to build the site.

`npm run test:web` uses mocked devnet RPC and wallet interactions; those tests do not demonstrate a real extension approving a real transaction. The pm-AMM run log separately records finalized devnet transactions and NOAA evidence.

Vercel rewrites `/app/:path*` to the Vite index and retains all existing API handlers and settlement schedules. No deployment, push or PR is performed by this migration.
