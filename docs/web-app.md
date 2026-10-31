# Web app and landing

The landing page is built by Vite at `/`. The app at `/app` is an Expo web export of the same `mobile/App.tsx` used on Android, with the Markets, Protect and Wallet screens from seeker-revamp. Metro selects `.web.ts` / `.web.tsx` implementations for browser-only capabilities; Android continues using `mobile/src/wallet.ts` and its Mobile Wallet Adapter.

## Local build and checks

Use Node 22.13 or later. Install both dependency trees with `npm ci && npm --prefix mobile ci`.

- `npm run build:site` builds the landing and exports the app to `dist/app`. The Expo export uses `/app` as its asset base and pins its RPC to Solana Devnet. Browser APIs use the current origin's `/api` routes.
- `node --import tsx scripts/web-preview.ts` serves the combined build and the existing API handlers at http://127.0.0.1:5002.
- `npm run dev` serves the landing through Vite and the existing app export. Run `npm run build:app` first and again after app edits.
- `npm run build` builds the equivalent Express production layout in `dist/public`, including `dist/public/app`; `npm start` serves it.
- `npm run check && npm --prefix mobile run check`
- `npm run test:line && npm run test:server && npm --prefix mobile run test:mobile`
- `npm run test:phantom && npm run test:web` checks the browser adapter and combined exported site. The Playwright tests use mocked public data and a mock injected Phantom provider. They do not establish that an actual extension approved a real on-chain purchase.

`/app`, `/app/markets`, `/app/protect` and `/app/wallet` support direct visits and reloads. Tab changes update browser history, and trusted Phantom session restoration preserves the requested browser tab. The existing `/preview` design fixtures and `/developers` page remain available. Vercel retains the existing API functions and rewrites, with a separate `/app` fallback before the landing fallback.

## Phantom browser check

1. Open the preview in a desktop browser with the Phantom extension installed, or in Phantom's in-app browser. Enable Phantom Testnet Mode and select Solana Devnet. Ordinary mobile Safari/Chrome does not inject the desktop extension; it shows installation guidance.
2. Open Wallet, connect, approve access, and check the full address and finalized SKYT balance. The wallet must hold Devnet SOL and SKYT.
3. Choose an open city/event/window in Markets. Review the fixed premium and cover amount, then approve the review in Phantom.
4. The browser calls `signTransaction`, verifies the payer/account and unchanged message, broadcasts the signed bytes to the pinned Devnet RPC, and waits for finalization. It never asks Phantom to broadcast to its selected network.
5. Change accounts or disconnect in Phantom: the app clears the active session. Rejected approvals send nothing. A pending confirmation keeps its signature for later verification.

No seed phrases or wallet keys are stored. Browser restoration uses Phantom's `onlyIfTrusted` connection. Location details link to OpenStreetMap on web; Android keeps its embedded native map.

## Preview deployment only

Commit and push `web-app-and-landing`. With an authenticated Vercel CLI, link to the existing SkyHedge project and run `npx vercel deploy --environment preview` from the repo. Never use production deployment, promotion or production aliases for this task. Vercel installs both dependency trees using the committed lockfiles.

The CLI's no-login `--temporary` mode targets production internally and must not be used under this task's preview-only rule. Authentication is required if Git integration does not create a Preview automatically.

The demo button intentionally links to `#demo` with a TODO until a public demo video URL is supplied. Download APK links to the repository's Releases page.
