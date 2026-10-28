/** Public /preview URL matrix. Every numeric sample is explicitly labelled Fixture. */
export const pr2States = [
  ...["ready", "loading", "error", "empty", "modelled", "expanded", "rail", "with-covers", "markets-mixed"].map(state => ({ name: `markets-${state}`, url: `/preview?screen=markets&state=${state}` })),
  ...["rain", "snow", "wind", "heat", "cold"].map(peril => ({ name: `markets-${peril}`, url: `/preview?screen=markets&peril=${peril}` })),
  ...["connect", "loading", "error", "empty", "open", "totals-rows", "paid", "dry", "pending", "refund-ready", "refunded", "unknown", "technical", "wallet-multi"].map(state => ({ name: `wallet-${state}`, url: `/preview?screen=wallet&state=${state}` })),
  ...["open", "paid", "dry", "pending", "refund-ready", "refunded", "unknown"].map(state => ({ name: `receipt-${state}`, url: `/preview?screen=wallet&state=${state}&receipt=1` })),
  ...["rain", "snow", "wind", "heat", "cold"].map(peril => ({ name: `landing-${peril}`, url: `/preview?screen=landing&peril=${peril}` })),
  ...["loading", "error", "empty", "modelled"].map(state => ({ name: `landing-${state}`, url: `/preview?screen=landing&state=${state}` })),
  ...["loading", "ready", "month", "week-closed", "snow", "wind", "heat", "cold-not-open", "covered", "paid", "dry", "cold", "sign", "sign-progress", "sign-success", "sign-declined", "sign-insufficient", "sign-closed", "sign-already", "sign-cap", "sign-unconfirmed", "sign-other", "info", "error", "connect", "signing", "cap", "closed", "modelled"].map(state => ({ name: `protect-${state}`, url: `/preview?state=${state}` })),
  ...["send", "confirm"].map(step => ({ name: `protect-sign-progress-${step}`, url: `/preview?state=sign-progress&step=${step}` })),
];
