import { waitUntil } from "@vercel/functions";

const TELEGRAM_TIMEOUT_MS = 3000;

export type WaitlistSignupNotice = {
  email: string;
  source: string;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  /** Includes the row just inserted. Failures still send the notice. */
  count: () => Promise<number>;
};

export type WaitlistTelegramOptions = {
  token?: string;
  chatId?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/** First character of the local part only, so `jane@gmail.com` becomes `j***@gmail.com`. */
export function maskWaitlistEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return "***";
  return `${normalized[0]}***@${normalized.slice(at + 1)}`;
}

/** Prefer UTM, then referrer, then the signup source label. */
export function formatWaitlistNotifySource(notice: Pick<
  WaitlistSignupNotice,
  "source" | "referrer" | "utmSource" | "utmMedium" | "utmCampaign"
>): string {
  const utm = [notice.utmSource, notice.utmMedium, notice.utmCampaign].filter((part): part is string => Boolean(part)).join("/");
  const parts = [utm, notice.referrer ?? ""].filter((part) => part.length > 0);
  const label = parts.length > 0 ? parts.join(" / ") : notice.source || "landing";
  return label.length > 300 ? `${label.slice(0, 297)}...` : label;
}

export function waitlistSignupTelegramText(notice: WaitlistSignupNotice, total: string): string {
  return `New SkyHedge waitlist signup: ${maskWaitlistEmail(notice.email)}, total: ${total}, source: ${formatWaitlistNotifySource(notice)}`;
}

function telegramConfig(options?: WaitlistTelegramOptions): { token: string; chatId: string } | null {
  const token = (options?.token ?? process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const chatId = (options?.chatId ?? process.env.TELEGRAM_CHAT_ID ?? "").trim();
  if (!token || !chatId) return null;
  return { token, chatId };
}

/**
 * Posts one masked signup notice. Missing env, a count failure, or Telegram
 * being down are all swallowed. Callers can fire this without awaiting.
 */
export async function deliverWaitlistTelegram(
  notice: WaitlistSignupNotice,
  options?: WaitlistTelegramOptions,
): Promise<void> {
  const config = telegramConfig(options);
  if (!config) return;

  let total = "?";
  try {
    const value = await notice.count();
    if (Number.isFinite(value)) total = String(value);
  } catch {
    // The signup is already stored. Send the notice without a count.
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: waitlistSignupTelegramText(notice, total),
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(options?.timeoutMs ?? TELEGRAM_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.info(`waitlist telegram status ${response.status}`);
      return;
    }
    let messageId = "";
    try {
      const payload = (await response.json()) as { result?: { message_id?: number } };
      if (payload.result?.message_id != null) messageId = String(payload.result.message_id);
    } catch {
      // Delivery already succeeded.
    }
    console.info(messageId ? `waitlist telegram sent id=${messageId}` : "waitlist telegram sent");
  } catch {
    // Timeout or network failure. Never surface this to the signup response.
  }
}

/** Starts delivery and returns immediately. On Vercel, waitUntil keeps the invocation alive. */
export function scheduleWaitlistTelegram(notice: WaitlistSignupNotice): void {
  const task = deliverWaitlistTelegram(notice).catch(() => {});
  try {
    waitUntil(task);
  } catch {
    // Local Node has no request context. The task is already running.
  }
}
