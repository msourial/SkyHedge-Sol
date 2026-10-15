import { useId, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";

type Status = "idle" | "submitting" | "success" | "error";

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
      await api<{ ok: true; status: string }>("/api/waitlist", {
        method: "POST",
        body: JSON.stringify({ email, company, source: "landing" }),
      });
      setStatus("success");
      setMessage("You're on the list. We'll email when access opens.");
      setEmail("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof ApiError ? error.message : "Could not join the waitlist. Try again.");
    }
  }

  if (status === "success") {
    return (
      <div className={variant === "hero" ? "wl-form wl-form--success" : "wl-form wl-form--compact wl-form--success"} role="status" aria-live="polite">
        <p className="wl-form__success-title">You're on the waitlist</p>
        <p className="wl-form__success-body">{message}</p>
      </div>
    );
  }

  return (
    <form id={id} className={variant === "hero" ? "wl-form" : "wl-form wl-form--compact"} onSubmit={(event) => void onSubmit(event)} noValidate>
      <label className="sr-only" htmlFor={`${fieldId}-email`}>Email</label>
      <div className="wl-form__row">
        <input
          id={`${fieldId}-email`}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Your email address"
          className="wl-form__input"
          disabled={status === "submitting"}
          aria-invalid={status === "error"}
          aria-describedby={message ? `${fieldId}-msg` : undefined}
        />
        {/* Honeypot — visually hidden, not tabbable */}
        <input
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          name="company"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          className="wl-form__honeypot"
        />
        <button type="submit" className="sky-btn-primary wl-form__submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Joining…" : "Join the waitlist"}
        </button>
      </div>
      {message ? <p id={`${fieldId}-msg`} className="wl-form__error" role="alert">{message}</p> : null}
    </form>
  );
}
