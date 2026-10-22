import type { ChainProtection } from "./positions.ts";
import { formatSkytFixed, utcDateTime } from "./ticket.ts";

/** The wallet's position on one window, if the finalized chain read has it. */
export function positionForWindow(
  protections: readonly ChainProtection[] | null | undefined,
  windowAddress: string | null | undefined,
): ChainProtection | null {
  if (!protections || !windowAddress) return null;
  return protections.find((position) => position.market === windowAddress) ?? null;
}

/** The buy was refused because this wallet already holds this window (app gate or program "account already in use"). */
export function isExistingPositionError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /already has a .*position|pending outcome on this window|second position on the same window|already in use|duplicate position/i.test(message);
}

/** The person said no in the wallet: nothing was signed, so there is nothing to look for on chain. */
export function isWalletDecline(message: string | null | undefined): boolean {
  return !!message && /declined|user rejected|cancell?ed by user/i.test(message);
}

/**
 * After a buy reports failure, look for the position on chain before saying so.
 * Finalized reads lag a confirmed send by a few seconds, so this retries a few times.
 */
export async function findPositionAfterBuy(input: {
  read: () => Promise<readonly ChainProtection[]>;
  windowAddress: string;
  attempts?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ position: ChainProtection | null; protections: readonly ChainProtection[] | null }> {
  const attempts = Math.max(1, input.attempts ?? 4);
  const sleep = input.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let last: readonly ChainProtection[] | null = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await sleep(input.delayMs ?? 4_000);
    try {
      last = await input.read();
      const position = positionForWindow(last, input.windowAddress);
      if (position) return { position, protections: last };
    } catch {
      // A failed read is not evidence either way; try again.
    }
  }
  return { position: null, protections: last };
}

export type CoveredRow = { label: string; value: string; gold?: boolean };

/** Rows for the "You're covered" card. Every value comes from the position account. */
export function coveredRows(position: ChainProtection): CoveredRow[] {
  const rows: CoveredRow[] = [
    { label: "Covered", value: `${formatSkytFixed(position.protectedAmount, 0)} SKYT` },
    { label: "Paid", value: `${formatSkytFixed(position.premiumPaid, 2)} SKYT` },
    { label: "Payout if triggered", value: `${formatSkytFixed(position.potentialPayout, 0)} SKYT`, gold: true },
    { label: "Window", value: position.windowLabel },
    { label: "Trigger", value: position.triggerLabel === "—" ? "—" : `${position.triggerLabel} cumulative` },
    { label: "Status", value: position.statusLabel },
  ];
  const opened = utcDateTime(position.openedAt);
  if (opened) rows.push({ label: "Opened", value: opened });
  return rows;
}

export function coveredLead(position: ChainProtection): string {
  return `This wallet already holds ${position.city} protection on this window. One protection per wallet per window.`;
}
