# Devnet status

| Item | Value |
| --- | --- |
| Program | `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx` |
| SKYT mint | `3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g` (Devnet, no value) |
| Live pilot | Des Moines cumulative rainfall — sales/observation windows follow each seeded market; check the live ticket |
| Coming soon | Toronto (ECCC adapter in-repo); Chicago / New York / Miami need admin create + fund |
| Research-only | Wind gust, snowfall (UI only) |
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
