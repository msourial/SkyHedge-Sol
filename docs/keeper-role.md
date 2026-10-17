# Keeper role (after the hackathon)

Do not implement this before the hackathon. The Devnet protocol admin stays `DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y`. The cron stays a dry run. The admin key is not stored.

`propose_admin` / `accept_admin` hands over every admin power, including pause, cancel, and close. That is the wrong tool for a ladder keeper.

Add a second pubkey on `ProtocolConfig`, `keeper`, distinct from `admin`.

The keeper may call only:

- `create_market`
- `fund_pool` (already allowed for any SKYT holder; the keeper is just another funder)
- `open_market`

The keeper may not call `set_pause`, `cancel_empty_draft`, `close_market`, settlement instructions, fee withdrawal, or `propose_admin`.

Transfer the keeper with the same two-step pattern as admin (`propose_keeper`, `accept_keeper`) so a leaked proposal cannot seize the role. Admin keeps the power to clear the keeper. Devnet and test SKYT only until that program change is reviewed.
