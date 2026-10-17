import { useId, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";

type Status = "idle" | "submitting" | "success" | "already" | "error";

export function WaitlistForm({ variant = "hero", id }: { variant?: "hero" | "compact"; id?: string }) {
  const fieldId = useId();
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setMessage(null);
    try {
      const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const result = await api<{ ok: true; status: string }>("/api/waitlist", {
        method: "POST",
        body: JSON.stringify({
          email,
          company,
          source: "landing",
          referrer: typeof document !== "undefined" ? document.referrer || null : null,
          utmSource: params?.get("utm_source"),
          utmMedium: params?.get("utm_medium"),
          utmCampaign: params?.get("utm_campaign"),
        }),
      });
      const already = result.status === "already_subscribed";
      setStatus(already ? "already" : "success");
      setMessage(
        already
          ? "This email is already on the list. We'll email when Seeker access opens."
          : "You're on the list. We'll email when Seeker access opens.",
      );
      setEmail("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof ApiError ? error.message : "Could not join the waitlist. Try again.");
    }
  }

  if (status === "success" || status === "already") {
    return (
      <div
        className={
          variant === "hero"
            ? `wl-form wl-form--success${status === "already" ? " wl-form--already" : ""}`
            : `wl-form wl-form--compact wl-form--success${status === "already" ? " wl-form--already" : ""}`
        }
        role="status"
        aria-live="polite"
      >
        <div className="wl-form__success-head">
          <svg className="wl-form__check" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
            <path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="wl-form__success-title">
            {status === "already" ? "Already on the list" : "You're on the waitlist"}
          </p>
        </div>
        <p className="wl-form__success-body">{message}</p>
      </div>
    );
  }

  return (
    <form
      id={id}
      className={variant === "hero" ? "wl-form" : "wl-form wl-form--compact"}
      onSubmit={(event) => void onSubmit(event)}
      noValidate
    >
      <label className="sr-only" htmlFor={`${fieldId}-email`}>
        Email
      </label>
      <div className="wl-form__pill">
        <input
          id={`${fieldId}-email`}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com…"
          spellCheck={false}
          className="wl-form__input"
          disabled={status === "submitting"}
          aria-invalid={status === "error"}
          aria-describedby={message ? `${fieldId}-msg` : undefined}
        />
        <input
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          name="company"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          className="wl-form__honeypot"
        />
        <button type="submit" className="wl-form__submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Joining…" : "Join waitlist"}
        </button>
      </div>
      {message ? (
        <p id={`${fieldId}-msg`} className="wl-form__error" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
