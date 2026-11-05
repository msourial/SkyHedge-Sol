# Local settlement + Collect replay

Branch: `encode-final`. No commits, pushes, builds of the Solana program, or deployments. Devnet was accessed only with read-only `program dump`; every transaction was sent to `http://127.0.0.1:8899`. No existing keypair, `.env`, `.local-secrets`, or `/workspace/.bp-new` was opened. Fresh identities and validator files live under `/tmp`. No files were deleted.

## Recording steps

Use two terminals. Start in `/workspace/skyhedge-work`. The replay is a terminal demo and does not require DATABASE_URL or the web app. SKYT-LOCAL is the console label for a new six-decimal SPL test mint; it has no token metadata account. The user-supplied probability is a demo input, not an audited quote.

CLI installation used the stable installer downloaded to `/tmp/skyhedge-agave-install.sh`. Stable (commit `0f131d3`) installed successfully but its validator panicked because this container forbids io_uring (`assertion failed: io_uring_supported()`). Agave 2.3.13 was installed as the working compatibility fallback:

```bash
curl -sSfL https://release.anza.xyz/v2.3.13/install -o /tmp/skyhedge-agave-compat-install.sh
sh /tmp/skyhedge-agave-compat-install.sh
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

The program is already available at `/tmp/skyhedge_protection.so`. The original read-only download command explicitly used a new throwaway CLI identity and a `/tmp` config path to avoid home configuration:

```bash
solana --config /tmp/skyhedge-cli/config.yml --keypair /tmp/skyhedge-cli/identity.json program dump 5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx /tmp/skyhedge_protection.so -u devnet
```

Terminal 1 (new ledger each recording; no reset or deletion needed):

```bash
cd /workspace/skyhedge-work
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
REPLAY_LEDGER=$(mktemp -d /tmp/skyhedge-recording-ledger-XXXXXX)
solana-test-validator --ledger "$REPLAY_LEDGER" --bind-address 127.0.0.1 --rpc-port 8899 --bpf-program 5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx /tmp/skyhedge_protection.so
```

Wait for slots to advance (roughly 5–15 seconds). Terminal 2:

```bash
cd /workspace/skyhedge-work
npm run demo:replay -- --threshold-mm 6 --probability-bps 2000 --start-date 2026-10-09 --end-date 2026-10-15
```

Or use `npm run demo:replay` to search recent past complete weeks (up to 12 weeks) for a total meeting the threshold. Explicit dates are inclusive, must be past dates, and require both flags. The script rejects non-triggering evidence before creating local keys or sending transactions, so this Collect demo always has a payout. Each run needs an uninitialized protocol/fresh ledger. It refuses every RPC string except exactly `http://127.0.0.1:8899`, including RPC supplied through SOLANA_RPC_URL.

Expected recording sequence (about 2.5–3 minutes after validator startup, depending on local clock progress and NOAA latency):

1. Large `LOCAL REPLAY - local Solana validator, not Devnet` banner, NOAA URL, dates, daily millimeters, total, fresh `/tmp` directory.
2. Four local SOL airdrops, new test mint, protocol initialization with fresh settlement authority, New York Central Park rain market, LP funds 2000, market opens, buyer protects 100.
3. Premium is 24 SKYT-LOCAL at default probability: vault 2000 → 2024, buyer 1000 → 976.
4. Sales close 45 local seconds after setup, then `lock_market`. Observation starts at sales close and ends 90 seconds later; countdown uses the on-chain Clock sysvar.
5. `begin_settlement`, `submit_weather_observation`, `settle_market`, `MARKET RESULT: {"triggered":{}}`, then `Collect: buyer claim_payout`.
6. Claim output: vault 2024 → 1924, buyer 976 → 1076; final `COLLECT SUCCEEDED: payout_claimed=true; buyer +100 SKYT-LOCAL; vault -100 SKYT-LOCAL. LOCAL REPLAY ONLY.` Every transaction prints its signature and custom local Explorer URL.

Keep the local validator running while showing Explorer links; the browser must run on the same machine or have ports 8899/8900 forwarded. Stop Terminal 1 with Ctrl-C after recording. Preserve the ledger and generated files. The script itself does not start/stop the validator.

This is explicitly a historical evidence replay, not current-window weather or a Devnet settlement: the NOAA dates differ from the compressed local market window. On-chain submission uses the exact local market start/end, `observed_at = observation_end`, and the identical station/methodology hashes used at creation. The source hash is SHA256 of the exact fetched JSON text, saved as `noaa.json` in the fresh `/tmp` run directory. Existing NOAA parsing validates measurement/quality flags; missing or duplicate days and invalid rainfall fail closed.

## NOAA evidence used in the verified run

Station USW00094728 (New York Central Park), NOAA GHCN-Daily Access Services, metric PRCP. Inclusive 2026-10-09 through 2026-10-15:

| Date | Rainfall mm |
| --- | ---: |
| 2026-10-09 | 0.0 |
| 2026-10-10 | 0.0 |
| 2026-10-11 | 46.7 |
| 2026-10-12 | 0.0 |
| 2026-10-13 | 0.0 |
| 2026-10-14 | 0.5 |
| 2026-10-15 | 0.0 |
| Total | 47.2 |

Source: https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries&stations=USW00094728&dataTypes=PRCP&startDate=2026-10-09&endDate=2026-10-15&units=metric&format=json&includeAttributes=true

Raw response: `/tmp/skyhedge-replay-wSDjS7/noaa.json`. Run transcript: `/tmp/skyhedge-replay-run.log`. Working validator ledger: `/tmp/skyhedge-replay-ledger-compat`. Stable failed ledger preserved at `/tmp/skyhedge-replay-ledger`.

## Checks

- `npm run test:replay`: 2 tests passed (strict RPC guard, metric NOAA totals and invalid/missing evidence).
- `npm run check`: passed, including the new replay script via tsconfig.
- `DOTENV_CONFIG_PATH=/tmp/skyhedge-no-env-file npm run test:web`: all 12 tests passed (32.8 seconds). The explicit unused dotenv path prevents the existing preview server's dotenv import from opening repository `.env` files.

End-to-end replay passed with process exit code 0. Market result `triggered`, status `settled`, position `payoutClaimed=true`; balances verified against a 100-token payout. Claim signature: `4i3FnVHDQ2NBNo8yasC6tZuey5f3N1AHyJdRQYH1ebxWXL9STbqZbYrvxwH24phWeeN2k45BBBjfCN7KTHX4S8Ka`. Raw NOAA SHA256: `91e6219cbc16f9d9cf10d496f82d69d845fbb8192fe7c86b23624348e9959308`.

Validator stopped cleanly via `agave-validator --ledger /tmp/skyhedge-replay-ledger-compat exit --force`; validator process exited 0 and local RPC no longer responded. `git diff --check` passed. Pre-existing untracked submission deck/description/PDF files were left untouched.
