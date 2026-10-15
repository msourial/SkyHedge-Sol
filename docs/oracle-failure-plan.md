# Oracle failure plan (SkyHedge)

Branch: `seeker-revamp`. Audited: Anchor program `skyhedge_protection`, `server/services/noaa.ts`, `server/routes.ts`, plus settlement worker (`server/services/settlement.ts`, `server/services/consensus.ts`) where behavior is implemented off-chain.

Scope rule: NOAA is the sole settlement source. Incomplete, flagged, or malformed station data must never be synthesized into a rainfall value.

---

## Audit findings

### a. NOAA revises data after settlement

| | |
|---|---|
| **Handled?** | Partial (grace window only; no post-settle revision path) |
| **Where** | `lib.rs:11` `DATA_GRACE_SECONDS` (7 days) → `lib.rs:89` `data_deadline = observation_end + grace`; settle allowed while `now <= data_deadline` (`lib.rs:235`, `lib.rs:263`). Worker uses Solana `finalized` commitment (`settlement.ts:41`, `:52`, `:259`) — chain finality, not NOAA finality. Consensus notes revisions explicitly (`consensus.ts:11–12`). |
| **Gap** | There is **no NOAA finality delay** before settle. As soon as the window ends, `begin_settlement` is callable (`lib.rs:218–222`), and the worker may settle on the first complete quality-screened package (`settlement.ts:130–206`). Observation PDA is `init`-once (`lib.rs:459`); values cannot be corrected if NOAA later revises GHCN-Daily. Settled markets are final. |

### b. Station gap mid-window (missing days)

| | |
|---|---|
| **Handled?** | Yes — incomplete window → unavailable path (refund), **not** tolerance |
| **Where** | `consensus.ts:98–117` `validateFinalDailyRecords` requires every UTC day in the window; incomplete throws. Forecast path also rejects gaps (`noaa.ts:136–152`). Settlement runner leaves market `pending` on failure (`settlement.ts:131–137`); after `data_deadline`, marks `DATA_UNAVAILABLE` (`settlement.ts:109–123`). On-chain: `mark_data_unavailable` → buyers `claim_premium_refund` (`lib.rs:273–322`). |
| **Gap** | None for V1 policy (strict completeness). Off-chain: if the settlement signer never calls `mark_data_unavailable` after the deadline, refunds stay blocked (see **d**). |

### c. Settler / oracle authority

| | |
|---|---|
| **Handled?** | Yes for authorization; partial for liveness and event coverage |
| **Where** | Single protocol `settlement_authority` (`lib.rs:22`, two-step rotate `lib.rs:48–60`). **Who can call:** `submit_weather_observation` — settlement authority only (`lib.rs:228`); `settle_market` — settlement authority signer (`lib.rs:460` `has_one = settlement_authority`); `mark_data_unavailable` — settlement authority only (`lib.rs:275`). Admin is separate. **Events:** `ObservationSubmitted` (`lib.rs:247–256`, `:491`), `MarketSettled` (`lib.rs:269`, `:492`), `DataUnavailable` (`lib.rs:286–294`, `:493`). Authority rotation emits `AuthorityProposed` / `AuthorityAccepted`. Worker logs + optional DB evidence (`settlement.ts:120`, `:204`, `:226–241`). Cron gated by `CRON_SECRET` (`api/cron/settlement.ts`). |
| **Gap** | Single key controls submit, settle, and unavailable attestation — key loss or offline worker blocks resolution. `begin_settlement` emits no event (`lib.rs:218–222`). `MarketSettled` does not include signer pubkey. Contrast: `lock_market` / `begin_settlement` are permissionless (`AdvanceMarket`, `lib.rs:458`). |

### d. Nobody settles (deadline → refund)

| | |
|---|---|
| **Handled?** | Partial — deadline exists, but **only** the settlement authority can open the refund path |
| **Where** | After `data_deadline`, authority may `mark_data_unavailable` (`lib.rs:273–277`); then buyers `claim_premium_refund` (`lib.rs:312–322`). Worker automates this when configured (`settlement.ts:109–123`). Health surfaces worker readiness (`routes.ts:79–82`, `settlement-config.ts`). |
| **Gap** | **No permissionless fallback.** If the signer is missing, cron is off, or the key is lost, markets can remain `AwaitingSettlement` past the deadline. `close_market` requires `Settled \| DataUnavailable` (`lib.rs:326`), and refunds require `DataUnavailable` — so stuck markets never refund and never close. |

### e. NOAA API outage / format change

| | |
|---|---|
| **Handled?** | Fail-closed + retry; no alternate settlement source |
| **Where** | Fetch/parse failures → `DataUnavailableError` (`noaa.ts:38–46`, `:71–88`). Routes return 503 with explicit “do not synthesize; mark DATA_UNAVAILABLE after deadline” (`routes.ts:353–354`). Cron retries next schedule (`api/cron/settlement.ts:45–46`). Quote path has rate-limit retry only (`quote-engine.ts` `retryNoaaRateLimit`) — not a settlement fallback. Health `manual-or-missing` when worker secrets absent (`settlement-config.ts:12`). |
| **Gap** | No secondary feed for settlement (by design). No structured human “manual review” queue beyond operating the same settlement authority / reconfiguring NOAA token. Format-change fixes require a code deploy of parsers. |

### Already handled (confirmed)

| Mode | Behavior | Where |
|---|---|---|
| Missing data | Empty/incomplete results → unavailable / pending until deadline | `noaa.ts:46`; `consensus.ts:99`, `:115–116`; `settlement.ts:131–137`, `:109–123` |
| Quality flags | Nonblank GHCN quality → reject; unsupported measurement flags → reject | `noaa.ts:82–87`; `consensus.ts:106–108` |
| Window mismatch | On-chain window/time/station/methodology checks; off-chain date set must match | `lib.rs:229–232`; `consensus.ts:110`, `:115–116`; `settlement.ts:140–152` |

---

## Failure mode summary

| Failure mode | Current behavior | Proposed fix | Effort |
|---|---|---|---|
| a. NOAA revises after settle | 7-day data grace; settle as soon as complete package arrives; no revise/reopen | Optional settle floor: wait N days after `observation_end` (or require dual reads with matching `source_hash`) before `submit`/`settle`; document that blank QA ≠ irrevocable | M |
| b. Station gap mid-window | Incomplete days rejected; after deadline → `DATA_UNAVAILABLE` → premium refund | Keep strict completeness. Close liveness gap via **d** so refunds cannot be blocked by a dead signer | S (ops) / see d |
| c. Settler authority (single key) | One settlement authority for submit, settle, and unavailable; events mostly present | See **Proposed program changes (c)** below: permissionless `settle_market` after observation exists; richer events; keep submit gated | S–M |
| d. Nobody settles | Deadline exists; only settlement authority can `mark_data_unavailable` | See **Proposed program changes (d)** below: permissionless `mark_data_unavailable` after deadline when no observation | S |
| e. NOAA outage / format change | Fail-closed, cron retry, 503 guidance; no alt settlement source | Keep fail-closed. Add runbook alert when markets sit `AwaitingSettlement` near deadline; parser version pin in methodology hash (already hashed) | S (ops/docs) |
| Missing / quality / window (baseline) | Reject; never invent | No change | — |

Cheap closes completed in this pass: this document only (no on-chain or program edits). Program diffs for **c** and **d** are planned below and **not** applied.

---

## Proposed program changes (c and d only)

Do **not** apply until reviewed. Listed diffs are the intended `lib.rs` edits.

### c — Authority / settle liveness

**Goals**

1. Keep `submit_weather_observation` gated to `settlement_authority` (oracle attestation stays single-key).
2. Once a valid observation PDA exists, allow **anyone** to call `settle_market` (deterministic from observation + market terms) so settlement cannot stall after a successful submit.
3. Emit `BeginSettlement`; include `authority` on `MarketSettled` for audit parity with observation/unavailable events.

**Planned diff (illustrative)**

```diff
--- a/anchor/programs/skyhedge_protection/src/lib.rs
+++ b/anchor/programs/skyhedge_protection/src/lib.rs
@@ begin_settlement
     pub fn begin_settlement(ctx: Context<AdvanceMarket>) -> Result<()> {
         require!(ctx.accounts.market.status == MarketStatus::Locked, ErrorCode::InvalidMarketStatus);
         require!(Clock::get()?.unix_timestamp >= ctx.accounts.market.observation_end, ErrorCode::ObservationNotFinished);
         ctx.accounts.market.status = MarketStatus::AwaitingSettlement;
+        emit!(BeginSettlement { market: ctx.accounts.market.key() });
         Ok(())
     }

@@ settle_market
     pub fn settle_market(ctx: Context<SettleMarket>) -> Result<()> {
         let market = &mut ctx.accounts.market;
         require!(market.status == MarketStatus::AwaitingSettlement, ErrorCode::InvalidMarketStatus);
         require!(Clock::get()?.unix_timestamp <= market.data_deadline, ErrorCode::StaleObservation);
         let triggered = market.operator.matches(ctx.accounts.observation.cumulative_rainfall_mm_x100, market.threshold_mm_x100);
         market.result = if triggered { SettlementResult::Triggered } else { SettlementResult::NotTriggered };
         market.payout_liability = if triggered { market.reserved_exposure } else { 0 };
         if !triggered { market.reserved_exposure = 0; }
         market.status = MarketStatus::Settled;
-        emit!(MarketSettled { market: market.key(), result: market.result });
+        emit!(MarketSettled {
+            market: market.key(),
+            result: market.result,
+            settler: ctx.accounts.settler.key(),
+        });
         Ok(())
     }

@@ SettleMarket accounts
-#[derive(Accounts)] pub struct SettleMarket<'info> {
-  #[account(seeds = [b"protocol"], bump = protocol.bump, has_one = settlement_authority)]
-  pub protocol: Account<'info, ProtocolConfig>,
-  pub settlement_authority: Signer<'info>,
-  #[account(mut, has_one = protocol)] pub market: Account<'info, Market>,
-  #[account(seeds = [b"settlement", market.key().as_ref()], bump = observation.bump, has_one = market)]
-  pub observation: Account<'info, SettlementObservation>
-}
+#[derive(Accounts)] pub struct SettleMarket<'info> {
+  pub settler: Signer<'info>,
+  #[account(seeds = [b"protocol"], bump = protocol.bump)]
+  pub protocol: Account<'info, ProtocolConfig>,
+  #[account(mut, has_one = protocol)] pub market: Account<'info, Market>,
+  #[account(seeds = [b"settlement", market.key().as_ref()], bump = observation.bump, has_one = market)]
+  pub observation: Account<'info, SettlementObservation>
+}

+#[event] pub struct BeginSettlement { pub market: Pubkey }
+#[event] pub struct MarketSettled { pub market: Pubkey, pub result: SettlementResult, pub settler: Pubkey }
```

**Off-chain follow-up (after program upgrade):** `SettlementRunner` may keep signing settle with the authority key; optionally document that any wallet can finish settle if observation already exists. Update IDL + `unsigned-tx` / tests. Effort: **S** (events + permissionless settle) to **M** (IDL, worker, client).

**Not proposed here:** multisig settlement authority (larger ops change, effort **L**).

### d — Permissionless unavailable after deadline

**Goal:** After `data_deadline`, if no observation account exists, **any** signer can `mark_data_unavailable` so buyers can `claim_premium_refund` without depending on the settlement key.

**Planned diff (illustrative)**

```diff
--- a/anchor/programs/skyhedge_protection/src/lib.rs
+++ b/anchor/programs/skyhedge_protection/src/lib.rs
@@ mark_data_unavailable
     pub fn mark_data_unavailable(ctx: Context<MarkDataUnavailable>, source_hash: [u8; 32]) -> Result<()> {
         require!(ctx.accounts.market.status == MarketStatus::AwaitingSettlement, ErrorCode::InvalidMarketStatus);
-        require_keys_eq!(ctx.accounts.authority.key(), ctx.accounts.protocol.settlement_authority, ErrorCode::UnauthorizedAuthority);
         require!(data_unavailable_attestation_allowed(ctx.accounts.observation.is_some(), source_hash), ErrorCode::InvalidObservation);
         require!(Clock::get()?.unix_timestamp > ctx.accounts.market.data_deadline, ErrorCode::DataDeadlineNotReached);
         // ... existing market field updates unchanged ...
         emit!(DataUnavailable {
             market: market.key(),
             authority: ctx.accounts.authority.key(),
             // ...
         });
         Ok(())
     }
```

`MarkDataUnavailable` already takes a generic `authority: Signer` (`lib.rs:461`); removing the key equality check is enough. Keep `data_unavailable_attestation_allowed` (no observation + nonzero `source_hash`) so a posted observation cannot be overwritten by an unavailable attestation.

**Off-chain follow-up:** expose an unsigned `mark_data_unavailable` path for buyers/bots after deadline (mirror permissionless `lock_market`). Worker remains the happy path. Effort: **S**.

**Safety note:** Anyone can attest unavailable after the deadline only when no observation exists. A malicious early unavailable call is already blocked by `DataDeadlineNotReached`. A malicious unavailable after a valid observation exists is blocked by `data_unavailable_attestation_allowed`.

---

## Recommended sequence

1. Ship **d** (permissionless unavailable) — highest buyer-liveness value, smallest blast radius.
2. Ship **c** permissionless settle + events.
3. Decide separately whether to add an NOAA settle floor (**a**, effort M).
4. Ops: ensure production `SETTLEMENT_AUTHORITY_KEYPAIR`, `NOAA_TOKEN`, and `CRON_SECRET` so the worker remains the primary path (`docs/settlement-worker.md`).
