# Devnet keeper plan: multi-peril rungs

As of 2026-10-24T15:00:00.000Z (Solana Devnet only).
This is a dry run. It does not sign, and it does not submit a transaction.
Miro approves each Phantom signature himself. No admin key is read here.

## What would be created

New markets: **131**.
Phantom approvals: **393** (3 per market: create_market, fund_pool, open_market; the signer does not batch).
SKYT to fund: **262,000** (2,000 SKYT each, from the existing pool-fund constant).
Prices below use history only (no forecast term). The Phantom signer uses these same committed GHCN totals and the same history-only premium, and it re-reads Devnet before it builds an instruction.
Many rank-10 rain strikes have 0 analogue hits. A whole-millimetre ceil can sit above the wettest of the ten years, so those markets price at the 1% floor (215 bps).
Devnet was read at 2026-10-24 from https://api.devnet.solana.com (devnet, next market id 11). A rung is kept only when an open account has the same city, peril, window, threshold, and operator. Chicago, Miami, Dallas, Los Angeles, Seattle, Boston, and Austin had no market in that read, so their rank 8 is created.

| City | Peril | Window (UTC, end exclusive) | Rank | Trigger | Hits / 10 | Chance | Premium bps | Premium for 100 SKYT | Approvals | SKYT |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| new-york | rain | 2026-10-26 → 2026-11-02 | 6 | 50 mm | 5 | 50.0% | 5850 | 58.5 SKYT | 3 | 2000 |
| new-york | rain | 2026-10-26 → 2026-11-02 | 10 | 114 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| new-york | rain | 2026-11-02 → 2026-11-09 | 6 | 2 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| new-york | rain | 2026-11-02 → 2026-11-09 | 8 | 6 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| new-york | rain | 2026-11-02 → 2026-11-09 | 10 | 40 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| new-york | rain | 2026-11-01 → 2026-12-01 | 6 | 80 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| new-york | rain | 2026-11-01 → 2026-12-01 | 10 | 194 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| new-york | rain | 2026-12-01 → 2027-01-01 | 6 | 118 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| new-york | rain | 2026-12-01 → 2027-01-01 | 10 | 181 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| chicago | rain | 2026-10-26 → 2026-11-02 | 6 | 6 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| chicago | rain | 2026-10-26 → 2026-11-02 | 8 | 26 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| chicago | rain | 2026-10-26 → 2026-11-02 | 10 | 85 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| chicago | rain | 2026-11-02 → 2026-11-09 | 6 | 8 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| chicago | rain | 2026-11-02 → 2026-11-09 | 8 | 17 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| chicago | rain | 2026-11-02 → 2026-11-09 | 10 | 48 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| chicago | rain | 2026-11-01 → 2026-12-01 | 6 | 45 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| chicago | rain | 2026-11-01 → 2026-12-01 | 8 | 54 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| chicago | rain | 2026-11-01 → 2026-12-01 | 10 | 93 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| chicago | rain | 2026-12-01 → 2027-01-01 | 6 | 55 mm | 5 | 50.0% | 5850 | 58.5 SKYT | 3 | 2000 |
| chicago | rain | 2026-12-01 → 2027-01-01 | 8 | 65 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| chicago | rain | 2026-12-01 → 2027-01-01 | 10 | 85 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| miami | rain | 2026-10-26 → 2026-11-02 | 6 | 13 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| miami | rain | 2026-10-26 → 2026-11-02 | 8 | 27 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| miami | rain | 2026-10-26 → 2026-11-02 | 10 | 92 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| miami | rain | 2026-11-02 → 2026-11-09 | 6 | 17 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| miami | rain | 2026-11-02 → 2026-11-09 | 8 | 45 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| miami | rain | 2026-11-02 → 2026-11-09 | 10 | 107 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| miami | rain | 2026-11-01 → 2026-12-01 | 6 | 112 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| miami | rain | 2026-11-01 → 2026-12-01 | 8 | 216 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| miami | rain | 2026-11-01 → 2026-12-01 | 10 | 244 mm | 1 | 10.0% | 1250 | 12.5 SKYT | 3 | 2000 |
| miami | rain | 2026-12-01 → 2027-01-01 | 6 | 41 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| miami | rain | 2026-12-01 → 2027-01-01 | 8 | 60 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| miami | rain | 2026-12-01 → 2027-01-01 | 10 | 164 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| dallas | rain | 2026-10-26 → 2026-11-02 | 6 | 20 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| dallas | rain | 2026-10-26 → 2026-11-02 | 8 | 29 mm | 3 | 30.0% | 3550 | 35.5 SKYT | 3 | 2000 |
| dallas | rain | 2026-10-26 → 2026-11-02 | 10 | 110 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| dallas | rain | 2026-11-02 → 2026-11-09 | 6 | 21 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| dallas | rain | 2026-11-02 → 2026-11-09 | 8 | 36 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| dallas | rain | 2026-11-02 → 2026-11-09 | 10 | 78 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| dallas | rain | 2026-11-01 → 2026-12-01 | 6 | 46 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| dallas | rain | 2026-11-01 → 2026-12-01 | 8 | 82 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| dallas | rain | 2026-11-01 → 2026-12-01 | 10 | 163 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| dallas | rain | 2026-12-01 → 2027-01-01 | 6 | 77 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| dallas | rain | 2026-12-01 → 2027-01-01 | 8 | 116 mm | 1 | 10.0% | 1250 | 12.5 SKYT | 3 | 2000 |
| dallas | rain | 2026-12-01 → 2027-01-01 | 10 | 117 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| los-angeles | rain | 2026-10-26 → 2026-11-02 | 10 | 2 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| los-angeles | rain | 2026-11-02 → 2026-11-09 | 8 | 3 mm | 1 | 10.0% | 1250 | 12.5 SKYT | 3 | 2000 |
| los-angeles | rain | 2026-11-02 → 2026-11-09 | 10 | 42 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| los-angeles | rain | 2026-11-01 → 2026-12-01 | 6 | 29 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| los-angeles | rain | 2026-11-01 → 2026-12-01 | 8 | 45 mm | 3 | 30.0% | 3550 | 35.5 SKYT | 3 | 2000 |
| los-angeles | rain | 2026-11-01 → 2026-12-01 | 10 | 117 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| los-angeles | rain | 2026-12-01 → 2027-01-01 | 6 | 71 mm | 3 | 30.0% | 3550 | 35.5 SKYT | 3 | 2000 |
| los-angeles | rain | 2026-12-01 → 2027-01-01 | 8 | 91 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| los-angeles | rain | 2026-12-01 → 2027-01-01 | 10 | 210 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| seattle | rain | 2026-10-26 → 2026-11-02 | 6 | 51 mm | 5 | 50.0% | 5850 | 58.5 SKYT | 3 | 2000 |
| seattle | rain | 2026-10-26 → 2026-11-02 | 8 | 58 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| seattle | rain | 2026-10-26 → 2026-11-02 | 10 | 82 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| seattle | rain | 2026-11-02 → 2026-11-09 | 6 | 40 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| seattle | rain | 2026-11-02 → 2026-11-09 | 8 | 49 mm | 3 | 30.0% | 3550 | 35.5 SKYT | 3 | 2000 |
| seattle | rain | 2026-11-02 → 2026-11-09 | 10 | 94 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| seattle | rain | 2026-11-01 → 2026-12-01 | 6 | 145 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| seattle | rain | 2026-11-01 → 2026-12-01 | 8 | 165 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| seattle | rain | 2026-11-01 → 2026-12-01 | 10 | 261 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| boston | rain | 2026-10-26 → 2026-11-02 | 6 | 43 mm | 5 | 50.0% | 5850 | 58.5 SKYT | 3 | 2000 |
| boston | rain | 2026-10-26 → 2026-11-02 | 8 | 53 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| boston | rain | 2026-10-26 → 2026-11-02 | 10 | 63 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| boston | rain | 2026-11-02 → 2026-11-09 | 6 | 5 mm | 3 | 30.0% | 3550 | 35.5 SKYT | 3 | 2000 |
| boston | rain | 2026-11-02 → 2026-11-09 | 8 | 7 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| boston | rain | 2026-11-02 → 2026-11-09 | 10 | 74 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| boston | rain | 2026-11-01 → 2026-12-01 | 6 | 69 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| boston | rain | 2026-11-01 → 2026-12-01 | 8 | 86 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| boston | rain | 2026-11-01 → 2026-12-01 | 10 | 236 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| boston | rain | 2026-12-01 → 2027-01-01 | 6 | 96 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| boston | rain | 2026-12-01 → 2027-01-01 | 8 | 144 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| boston | rain | 2026-12-01 → 2027-01-01 | 10 | 156 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| austin | rain | 2026-10-26 → 2026-11-02 | 6 | 15 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| austin | rain | 2026-10-26 → 2026-11-02 | 8 | 22 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| austin | rain | 2026-10-26 → 2026-11-02 | 10 | 77 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| austin | rain | 2026-11-02 → 2026-11-09 | 6 | 14 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| austin | rain | 2026-11-02 → 2026-11-09 | 8 | 38 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| austin | rain | 2026-11-02 → 2026-11-09 | 10 | 52 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| austin | rain | 2026-11-01 → 2026-12-01 | 6 | 39 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| austin | rain | 2026-11-01 → 2026-12-01 | 8 | 62 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| austin | rain | 2026-11-01 → 2026-12-01 | 10 | 99 mm | 1 | 10.0% | 1250 | 12.5 SKYT | 3 | 2000 |
| austin | rain | 2026-12-01 → 2027-01-01 | 6 | 59 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| austin | rain | 2026-12-01 → 2027-01-01 | 8 | 93 mm | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| austin | rain | 2026-12-01 → 2027-01-01 | 10 | 162 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| des-moines | rain | 2026-10-26 → 2026-11-02 | 6 | 6 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| des-moines | rain | 2026-10-26 → 2026-11-02 | 10 | 46 mm | 1 | 10.0% | 1250 | 12.5 SKYT | 3 | 2000 |
| des-moines | rain | 2026-11-02 → 2026-11-09 | 6 | 3 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| des-moines | rain | 2026-11-02 → 2026-11-09 | 8 | 33 mm | 3 | 30.0% | 3550 | 35.5 SKYT | 3 | 2000 |
| des-moines | rain | 2026-11-02 → 2026-11-09 | 10 | 65 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| des-moines | rain | 2026-11-01 → 2026-12-01 | 6 | 39 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| des-moines | rain | 2026-11-01 → 2026-12-01 | 10 | 75 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| des-moines | rain | 2026-12-01 → 2027-01-01 | 6 | 40 mm | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| des-moines | rain | 2026-12-01 → 2027-01-01 | 10 | 74 mm | 0 | 1.0% | 215 | 2.15 SKYT | 3 | 2000 |
| chicago | snow | 2026-11-09 → 2026-11-16 | 6 | 3 mm | 5 | 50.0% | 5850 | 58.5 SKYT | 3 | 2000 |
| chicago | snow | 2026-11-09 → 2026-11-16 | 8 | 43 mm | 3 | 30.0% | 3550 | 35.5 SKYT | 3 | 2000 |
| chicago | snow | 2026-11-09 → 2026-11-16 | 10 | 91 mm | 1 | 10.0% | 1250 | 12.5 SKYT | 3 | 2000 |
| chicago | snow | 2026-11-01 → 2026-12-01 | 6 | 46 mm | 5 | 50.0% | 5850 | 58.5 SKYT | 3 | 2000 |
| chicago | snow | 2026-11-01 → 2026-12-01 | 8 | 94 mm | 3 | 30.0% | 3550 | 35.5 SKYT | 3 | 2000 |
| chicago | snow | 2026-11-01 → 2026-12-01 | 10 | 323 mm | 1 | 10.0% | 1250 | 12.5 SKYT | 3 | 2000 |
| chicago | snow | 2026-12-01 → 2027-01-01 | 6 | 71 mm | 5 | 50.0% | 5850 | 58.5 SKYT | 3 | 2000 |
| chicago | snow | 2026-12-01 → 2027-01-01 | 8 | 135 mm | 3 | 30.0% | 3550 | 35.5 SKYT | 3 | 2000 |
| chicago | snow | 2026-12-01 → 2027-01-01 | 10 | 451 mm | 1 | 10.0% | 1250 | 12.5 SKYT | 3 | 2000 |
| new-york | snow | 2026-12-01 → 2027-01-01 | 6 | 71 mm | 5 | 50.0% | 5850 | 58.5 SKYT | 3 | 2000 |
| new-york | snow | 2026-12-01 → 2027-01-01 | 8 | 183 mm | 3 | 30.0% | 3550 | 35.5 SKYT | 3 | 2000 |
| new-york | snow | 2026-12-01 → 2027-01-01 | 10 | 267 mm | 1 | 10.0% | 1250 | 12.5 SKYT | 3 | 2000 |
| chicago | wind | 2026-10-26 → 2026-11-02 | 6 | 12.5 m/s | 5 | 50.0% | 5850 | 58.5 SKYT | 3 | 2000 |
| chicago | wind | 2026-10-26 → 2026-11-02 | 8 | 13.4 m/s | 3 | 30.0% | 3550 | 35.5 SKYT | 3 | 2000 |
| chicago | wind | 2026-10-26 → 2026-11-02 | 10 | 14.3 m/s | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| chicago | wind | 2026-11-02 → 2026-11-09 | 6 | 10.7 m/s | 6 | 60.0% | 7000 | 70 SKYT | 3 | 2000 |
| chicago | wind | 2026-11-02 → 2026-11-09 | 8 | 11.6 m/s | 3 | 30.0% | 3550 | 35.5 SKYT | 3 | 2000 |
| chicago | wind | 2026-11-02 → 2026-11-09 | 10 | 18.3 m/s | 1 | 10.0% | 1250 | 12.5 SKYT | 3 | 2000 |
| chicago | wind | 2026-11-01 → 2026-12-01 | 6 | 16.1 m/s | 5 | 50.0% | 5850 | 58.5 SKYT | 3 | 2000 |
| chicago | wind | 2026-11-01 → 2026-12-01 | 8 | 17.4 m/s | 3 | 30.0% | 3550 | 35.5 SKYT | 3 | 2000 |
| chicago | wind | 2026-11-01 → 2026-12-01 | 10 | 18.3 m/s | 1 | 10.0% | 1250 | 12.5 SKYT | 3 | 2000 |
| chicago | wind | 2026-12-01 → 2027-01-01 | 6 | 14.8 m/s | 5 | 50.0% | 5850 | 58.5 SKYT | 3 | 2000 |
| chicago | wind | 2026-12-01 → 2027-01-01 | 8 | 15.7 m/s | 3 | 30.0% | 3550 | 35.5 SKYT | 3 | 2000 |
| chicago | wind | 2026-12-01 → 2027-01-01 | 10 | 18.3 m/s | 1 | 10.0% | 1250 | 12.5 SKYT | 3 | 2000 |
| miami | heat | 2026-10-26 → 2026-11-02 | 6 | 31.7 C | 7 | 70.0% | 8150 | 81.5 SKYT | 3 | 2000 |
| miami | heat | 2026-10-26 → 2026-11-02 | 8 | 32.2 C | 4 | 40.0% | 4700 | 47 SKYT | 3 | 2000 |
| miami | heat | 2026-10-26 → 2026-11-02 | 10 | 32.8 C | 2 | 20.0% | 2400 | 24 SKYT | 3 | 2000 |
| miami | heat | 2026-11-02 → 2026-11-09 | 6 | 30.6 C | 5 | 50.0% | 5850 | 58.5 SKYT | 3 | 2000 |
| miami | heat | 2026-11-02 → 2026-11-09 | 8 | 31.1 C | 3 | 30.0% | 3550 | 35.5 SKYT | 3 | 2000 |
| miami | heat | 2026-11-02 → 2026-11-09 | 10 | 32.2 C | 1 | 10.0% | 1250 | 12.5 SKYT | 3 | 2000 |
| miami | heat | 2026-11-01 → 2026-12-01 | 6 | 30.6 C | 8 | 80.0% | 9300 | 93 SKYT | 3 | 2000 |
| miami | heat | 2026-11-01 → 2026-12-01 | 8 | 31.7 C | 3 | 30.0% | 3550 | 35.5 SKYT | 3 | 2000 |
| miami | heat | 2026-11-01 → 2026-12-01 | 10 | 32.8 C | 1 | 10.0% | 1250 | 12.5 SKYT | 3 | 2000 |
| miami | heat | 2026-12-01 → 2027-01-01 | 6 | 30.6 C | 6 | 60.0% | 7000 | 70 SKYT | 3 | 2000 |
| miami | heat | 2026-12-01 → 2027-01-01 | 10 | 31.7 C | 1 | 10.0% | 1250 | 12.5 SKYT | 3 | 2000 |

## Already open at this strike, not created

| City | Peril | Window (UTC, end exclusive) | Trigger | Hits / 10 | Market |
| --- | --- | --- | --- | --- | --- |
| new-york | rain | 2026-10-26 → 2026-11-02 | 69 mm | 2 | 4MVypmwGhpNTvLhpEUTPu6AHEXL5aRzuprkPWT9o6ygq |
| new-york | rain | 2026-11-01 → 2026-12-01 | 102 mm | 2 | 67Xi3JFHAHyPAfYP6nTzaEzYp1UU5cFzvTu8gwGZATZe |
| new-york | rain | 2026-12-01 → 2027-01-01 | 166 mm | 2 | 2dra67fraFWM7TJ8NXGAuuGVde8LnUDXFKmEGVHCDPFa |
| des-moines | rain | 2026-10-26 → 2026-11-02 | 33 mm | 2 | 8tAPwdDQsW6ab1TDceZ9qzfS3scG5Kn7nwFhrFALNg9Y |
| des-moines | rain | 2026-11-01 → 2026-12-01 | 63 mm | 3 | BWLUtPtJf7NTa1X7gEuMxdyxhYoGnKSSt6SCFcXwmsmv |
| des-moines | rain | 2026-12-01 → 2027-01-01 | 50 mm | 2 | 9L9xAU8xJ84uGN87s6FH8MzVfKmZPEJDpJ7hNc5WWdH4 |

## Already on Devnet, outside this rung set

These accounts stay as they are. They are not repriced and not duplicated.

- des-moines rain cancelled 2026-09-30 → 2026-10-05 at 50 mm (9UUNQPXnrzUEDsra8PMMzByp9J9un1yysGdGuaz9JqVJ)
- des-moines rain open 2026-10-14 → 2026-10-19 at 50 mm (8pCnTVkAN3PtjSxsZuQt1QWmmZHbYKi4UAUpES8Utyho)
- des-moines rain open 2026-10-19 → 2026-10-24 at 50 mm (HDJiTEYSnaeUNZWAHvgWrMaefKemFq61S32bE2RVyiEZ)
- des-moines rain open 2026-10-19 → 2026-10-26 at 32 mm (8Dvx6RcPasUb3aahbWyohAKWMc3j2wpxnmKAWjmEqp9s)
- new-york rain open 2026-10-19 → 2026-10-26 at 29 mm (Bi7RnLKP7cvp4Q8F5YzZmaRiR9J9p51k2SbtEToGbd7U)

## Skipped

- seattle rain 2026-12-01 → 2027-01-01: missing 2021-12-18

## Ranks that did not become their own market

- los-angeles rain 2026-10-26 → 2026-11-02: rank 6 rounded to a non-positive strike; rank 8 rounded to a non-positive strike.
- los-angeles rain 2026-11-02 → 2026-11-09: rank 6 rounded to a non-positive strike.
- miami heat 2026-12-01 → 2027-01-01: rank 8 collapsed into 30.6.

## How the strikes were chosen

Chicago WSF2 rank 8 is 13.4 m/s for the week of 26 Oct (3 of 10 years at or above it; a whole-unit ceil of that same value is 14 m/s) and 17.4 m/s for November (whole-unit ceil 18 m/s). Markets use the tenth, because a whole m/s sits above every analogue year often enough to force the 1% floor.
Miami warm-spell rank 8 (TMAX, the window maximum) is 32.2 C for the week of 26 Oct and 31.7 C for November. Whole-unit ceils of those same values are 33 C and 32 C. The label is warm spell.
Chicago snow rank 8 is 43 mm for the week of 9 Nov (the week ending 16 Nov, not the week ending 9 Nov), 94 mm for November, and 135 mm for December. New York December rank 8 is 183 mm with 3 of 10 years at or above it. New York's late October and early November snow ranks are not positive and are not opened.

Cold is not open. The program requires a positive strike and a non-negative observation, so a negative temperature cannot be stored without a program change. This plan does not change or redeploy the program.

Wind uses WSF2 (fastest 2-minute wind), not WSF5 and not WSFG. WSFG at Chicago ends in 1996. WSF2 is complete for Chicago across 2016–2025 on these windows. New York WSF2, WSF5, and AWND each miss days in the same decade, so New York wind is not open. The measurement-flag allow-list adds K (converted from knots) for wind. None of the nine pinned stations contain a K flag in their GHCN-Daily history; rain still rejects K.

Other stations also have complete series that this demo does not open: snow at Dallas, Seattle, Boston, Austin, and Des Moines; WSF2 at Miami, Seattle, Boston, Austin, and Des Moines; TMAX at every pinned city. Quotes for those city/peril pairs stay unavailable until they are added to the registry.

Account rent is not included. It was not simulated. Each new market still needs the 2,000 SKYT pool fund above, plus whatever Devnet rent create_market charges for the market and vault accounts.
