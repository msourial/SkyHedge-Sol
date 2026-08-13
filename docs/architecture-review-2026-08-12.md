# SkyHedge V1 architecture review

## Implemented controls

- Market-to-protocol binding and PDA-owned SPL vaults.
- Full fixed-payout, premium, fee, exposure, share, claim, refund, and redemption accounting.
- Explicit locked, settled, data-unavailable, and closed states.
- Two-step admin/settlement signer rotation and pause control.
- NOAA-only source hashes with a seven-day data deadline.
- Immutable claim deadline and 30-day claim/refund window.

## Deployment gates

- Run local-validator integration tests that exercise the actual token CPIs before Devnet deployment.
- Register generated Anchor IDL/client transaction builders before enabling transaction endpoints.
- Configure `NOAA_TOKEN`, a dedicated settlement-service signer, Devnet SKYT mint, and PostgreSQL persistence.
- Complete external security review before any non-test-value use.
