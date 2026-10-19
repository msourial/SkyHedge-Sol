# How it works

1. **Landing** — https://skyhedge.app says “Rain on your plans? Get paid.” **Open web app** goes to `/app`.
2. **Markets** — The Seeker list leads with New York (Central Park). The row says **Open** while a rainfall window is selling. Other cities on the first screen showed **Soon** on 18 Oct 2026. Toronto stays closed.
3. **Protect** — An expiry chain. Pick **Nov 1 · W** (weekly). Trigger rows show chance and, for the one on-chain trigger, price per 100 SKYT and payout multiple. Other rows say Coming soon. Choose **100 SKYT**. The button reads **Protect for … SKYT** only when that amount has a live price.
4. **Approve** — The button asks the server for an unsigned `open_position`. Phantom (Mobile Wallet Adapter) is the signature. The premium lands in that market’s vault. Nothing is signed from the web screen.
5. **Position** — After approval, the Protect coverage ticket shows the position and an Explorer link. Wallet shows the connected address and the SKYT balance read from Solana. On this deployment the Wallet positions list is not indexed, so an empty list is not proof either way.
6. **Settlement** — After expiry, NOAA’s final station data is the observation. If cumulative rain reaches the trigger, the buyer can claim the payout. If no valid observation exists by the data deadline, the market can be marked `DataUnavailable` and the premium comes back. Missing days are not filled in.

```
New York + Nov 1 · W → priced trigger row → 100 SKYT → Phantom open_position
  → vault position → NOAA final data → payout, or DataUnavailable refund
```
