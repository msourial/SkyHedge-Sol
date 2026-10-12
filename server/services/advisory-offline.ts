import type { AdvisoryAssessment, ExtractedProtectionIntent } from "./advisory.js";

/**
 * Deterministic guide answers used when no language model is configured.
 * These answers explain how SkyHedge works. They never quote a price, never
 * claim a contract or transaction exists, and are labelled as offline mode.
 */
export type OfflineAdvisoryAssessment = AdvisoryAssessment & { mode: "offline"; modeLabel: string };

export const OFFLINE_MODE_LABEL = "Guide answers (offline mode)";

const emptyIntent: ExtractedProtectionIntent = { place: null, useCase: null, hazard: null, direction: null, date: null, amount: null, amountUnit: null, requestedThresholdMm: null };

const LIVE = "Des Moines, Iowa is the live Devnet market right now: a rainfall contract settled from NOAA observations. Open Protect to see its current terms and a committed quote.";

const topics: Array<{ pattern: RegExp; answer: string }> = [
  { pattern: /\b(saskatoon|saskatchewan|regina|alberta|calgary|edmonton|manitoba|winnipeg|prairie)\b/i,
    answer: `Saskatoon isn't live yet. Prairie rainfall protection is on our research list while we validate weather data, pricing and collateral there. ${LIVE}` },
  { pattern: /\btoronto\b|\bontario\b/i,
    answer: `Toronto is marked "Opens soon": we're still validating Canadian weather data rights, pricing and collateral, so it can't be purchased yet. ${LIVE}` },
  { pattern: /\b(des moines|iowa)\b/i,
    answer: `${LIVE} If it rains past the contract's trigger during the window, the position pays its fixed SKYT amount. Flights and events there are covered only by the rainfall contract itself, not by a flight-delay product.` },
  { pattern: /\b(fee|fees|cost|costs|price|premium|charge|expensive|cheap)\b/i,
    answer: "You pay a premium in SKYT for the payout you choose, plus a 1% SkyHedge fee and a small Solana network fee. The exact premium comes only from a committed NOAA quote on the Protect screen; the guide never makes up a price." },
  { pattern: /\b(payout|pay out|paid|claim|coverage|cover|how much|max|amount)\b/i,
    answer: "Pick a fixed payout of 50, 100 or 250 SKYT, or Max (up to the per-wallet limit). If the rain trigger is met, that amount is paid to your wallet automatically. No claim forms. It isn't profit: subtract the premium and fees." },
  { pattern: /\b(trigger|threshold|mm|millimet\w*)\b/i,
    answer: "Each contract has one rain trigger in millimetres over a fixed window, for example 50 mm. If the official NOAA total crosses it, the contract pays; if not, the premium is kept. The trigger is set when the market opens and can't be changed." },
  { pattern: /\b(settle\w*|noaa|oracle|data|resolve\w*|outcome)\b/i,
    answer: "When the window closes, rainfall from NOAA's official station observations is committed on Solana and the program settles every position against the trigger. Payouts go straight to winning wallets, and anyone can verify the outcome on Explorer." },
  { pattern: /\b(flight|fly|flying|airport|aviation|pilot|airline|weathered)\b/i,
    answer: `Aviation weather risk is where we're heading, but today the only live contract is rainfall. ${LIVE} If heavy rain is what threatens your plans, that contract may fit.` },
  { pattern: /\b(farm\w*|crop\w*|harvest|drought|dry|too little rain)\b/i,
    answer: `Farmers use SkyHedge to protect against a dry or wet season with a fixed SKYT payout tied to official rainfall. ${LIVE}` },
  { pattern: /\b(wind|gust\w*|snow\w*|hail|heat|frost)\b/i,
    answer: `Wind, snow and other hazards are research-only for now; only rainfall is live. ${LIVE}` },
  { pattern: /\b(wallet|phantom|sign|devnet|skyt|token)\b/i,
    answer: "SkyHedge runs on Solana Devnet with SKYT test tokens that have no real-world value. Every purchase needs your own approval in Phantom; the guide can never move funds." },
];

const WELCOME = "I can explain how SkyHedge weather protection works: where it's live, how the rain trigger and payouts work, what it costs, and how NOAA data settles a contract. Try asking about Des Moines, payouts, or the 1% fee.";

export function offlineAdvisoryAnswer(message: string): OfflineAdvisoryAssessment {
  const hits = topics.filter((topic) => topic.pattern.test(message)).slice(0, 1).map((topic) => topic.answer);
  const text = hits.length ? hits.join("\n\n") : WELCOME;
  return {
    status: "needs_input",
    message: text,
    intent: emptyIntent,
    match: null,
    unavailableReason: null,
    costExplanation: "No premium has been quoted here. Quotes come only from the Protect screen.",
    payoutExplanation: "No payout exists without a finalized position and settlement.",
    quote: null,
    transaction: null,
    explicitApprovalRequired: true,
    mode: "offline",
    modeLabel: OFFLINE_MODE_LABEL,
  };
}
