# How it works

1. **Markets** — Browse city rainfall markets. Des Moines is the Devnet pilot; Toronto shows as opens-soon (Environment Canada adapter already in-repo). Live NOAA chart and station evidence on the market card.
2. **Protect** — Pick coverage (50 / 100 / 250 / Max SKYT). The option ticket shows premium, payout if triggered, rain trigger (mm), window, chance, and 1% protocol fee.
3. **Approve** — Tap **Review in wallet**. The server builds an unsigned transaction; Phantom (Mobile Wallet Adapter) asks the user to approve. Premium lands in the market’s PDA vault.
4. **Wallet** — See SKYT balance, connected address, and open positions with Explorer links.
5. **Settlement** — After the observation window, a settlement authority submits a hashed NOAA observation. Anyone can finish `settle_market` once the observation exists. If the trigger is hit, the buyer claims the payout. If no valid data by the deadline, anyone can `mark_data_unavailable` and buyers reclaim premiums.

```
Place + risk → NOAA/ECCC inputs → quote → MWA approve → vault position
  → observation hashed on-chain → payout or premium refund
```
