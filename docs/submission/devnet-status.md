# Devnet status

| Item | Value |
| --- | --- |
| Program | `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx` |
| SKYT mint | `3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g` (Devnet, no value) |
| Demo market | New York (Central Park), NOAA. On 18 Oct 2026 the Seeker showed **Nov 1 · W** priced at ≥ 69 mm, 20.0%, 24.00 SKYT per 100, 4.1×. Nov 30 · M and Dec 31 · M were listed and not the buy. |
| Also on Devnet | Des Moines windows are in `/api/devnet/status`. They are not the Encode camera path. |
| Soon on the first Markets screen | Chicago, Miami, Dallas–Fort Worth, Los Angeles. Toronto stays closed. |
| Research-only | Wind, snow, and heat (UI only; no prices or triggers) |
| Website | https://skyhedge.app (waitlist) · https://skyhedge.app/app (product) |
| Branch | `seeker-revamp` |

## Settlement / oracle (program source)

On `seeker-revamp`:

- Permissionless `settle_market` once a valid observation PDA exists (`settler` signer).
- Permissionless `mark_data_unavailable` after `data_deadline` when no observation exists.
- Events: `BeginSettlement`, `MarketSettled` (includes settler), `DataUnavailable`.

**Devnet upgrade of this binary may still be pending** — do not claim permissionless settle/unavailable is live on-chain until the program is upgraded.

## Honesty

- SKYT has no real value. No mainnet. No regulated product claims.
- No fabricated traction counts. Waitlist signup volume is only stated after a verified export.
- OpenPosition purchase proof (historical Seeker → Phantom Devnet): see README Explorer link.
