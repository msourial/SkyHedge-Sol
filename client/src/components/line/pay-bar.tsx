import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DONE, GETTING_QUOTE, MAX_GAIN, MAX_LOSS, PAID_OUT, DRY_WINDOW, TRY_AGAIN, VIEW_WALLET, infoSheetTitle } from "../../../../shared/ui-copy.ts";
import { signCopy, type SignAction, type SignContext, type SignState } from "../../../../shared/ui-sign.ts";
import type { MoneyFigure, NotOpenLink, PanelModel, TicketModel } from "../../../../shared/ui-view.ts";
import { MoneyCell } from "./ticket";

export function PayBar({ panel, ticket, disabled, onConnect, onProtect, onWallet, onRetry, onGo }: {
  panel: PanelModel; ticket: TicketModel | null; disabled?: boolean; onConnect: () => void; onProtect: () => void;
  onWallet: () => void; onRetry: () => void; onGo: (link: NotOpenLink) => void;
}) {
  if (panel.kind === "loading") return <div className="ln-pay" aria-busy="true">
    <Figures /><button type="button" className="ln-cta" disabled>{GETTING_QUOTE}</button>
  </div>;
  if (panel.kind === "error") return <div className="ln-pay ln-pay--message" role="alert">
    <p className="ln-alert">{panel.message}</p><button type="button" className="ln-text-btn" onClick={onRetry}>{TRY_AGAIN}</button>
  </div>;
  if (panel.kind === "not-open") return <section className="ln-not-open" aria-label="Not open">
    <p>{panel.line}</p>{panel.go ? <button type="button" className="ln-text-btn" onClick={() => onGo(panel.go!)}>{panel.go.label}</button> : null}
  </section>;
  if (panel.kind === "closed") return <div className="ln-pay ln-pay--message"><p>{panel.line}</p></div>;
  if (panel.kind === "paid" || panel.kind === "dry") return <div className="ln-pay ln-pay--message">
    <p className="ln-fig-m">{panel.result}</p><p className="ln-stamp">{panel.kind === "paid" ? PAID_OUT : DRY_WINDOW}</p>
  </div>;
  if (panel.kind === "covered") return <div className="ln-pay ln-pay--receipt">
    <div><p className="ln-receipt-title"><GlacierTick />{panel.title}</p><Figures loss={panel.loss} gain={panel.gain} /></div>
    <button type="button" className="ln-text-btn" onClick={onWallet}>{VIEW_WALLET}</button>
  </div>;
  return <div className="ln-pay">
    <Figures loss={panel.loss} gain={panel.gain} />
    <button type="button" className="ln-cta ln-press" disabled={panel.kind === "signing" || !ticket || disabled}
      onClick={panel.kind === "connect" ? onConnect : onProtect}>{panel.cta}</button>
  </div>;
}

function Figures({ loss, gain }: { loss?: MoneyFigure; gain?: MoneyFigure }) {
  const label = (figure?: MoneyFigure) => figure ? `${figure.sign}${figure.whole}.${figure.fraction}` : "...";
  return <div className="ln-pay-figures" data-loading={!loss}>
    <p className="ln-pay-side"><span className="ln-label">{MAX_LOSS}</span><span className="ln-money-figure ln-fig-m">{label(loss)}</span></p>
    <p className="ln-pay-side"><span className="ln-label">{MAX_GAIN}</span><span className="ln-money-figure ln-fig-m">{label(gain)}</span><span className="ln-label ln-pay-unit">SKYT</span></p>
  </div>;
}
function GlacierTick({ size = 18 }: { size?: number }) {
  return <svg className="ln-tick-glyph" width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
    <path d="M3.5 9.2 7.1 12.8 14.5 5.2" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

/** Portal covers the navigation too. Focus and scroll stay in this single modal. */
export function ModalSheet({ title, canDismiss, onClose, children, className = "" }: {
  title: string; canDismiss: boolean; onClose: () => void; children: ReactNode; className?: string;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const dismissible = useRef(canDismiss);
  dismissible.current = canDismiss;
  const close = useRef(onClose);
  close.current = onClose;
  const dismiss = () => {
    if (!canDismiss || closing) return;
    setClosing(true);
    closeTimer.current = setTimeout(() => close.current(), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200);
  };
  const dismissFromBack = useRef(dismiss);
  dismissFromBack.current = dismiss;
  useEffect(() => {
    navigator.vibrate?.(10);
    const previous = document.activeElement as HTMLElement | null;
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const navs = [...document.querySelectorAll<HTMLElement>(".ln-tabs")];
    const inert = navs.map((nav) => nav.inert);
    navs.forEach((nav) => { nav.inert = true; });
    dialog.current?.focus();
    const marker = `line-sheet-${Date.now()}`;
    history.pushState({ ...history.state, lineSheet: marker }, "", location.href);
    const back = () => {
      if (dismissible.current) dismissFromBack.current();
      else history.pushState({ ...history.state, lineSheet: marker }, "", location.href);
    };
    window.addEventListener("popstate", back);
    return () => {
      window.removeEventListener("popstate", back);
      if (history.state?.lineSheet === marker) history.back();
      clearTimeout(closeTimer.current);
      document.body.style.overflow = scroll;
      navs.forEach((nav, index) => { nav.inert = inert[index]; });
      previous?.focus();
    };
  }, []);
  return createPortal(<div className="ln-modal ln-sheet-back" data-closing={closing} onClick={dismiss}>
    <div ref={dialog} tabIndex={-1} className={`ln-sheet ${className}`} role="dialog" aria-modal="true" aria-label={title}
      onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); dismiss(); }
        if (event.key === "Tab") {
          const buttons = [...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex="0"]')];
          const first = buttons[0], last = buttons.at(-1);
          if (!first) { event.preventDefault(); return; }
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
        }
      }}>
      <div className="ln-sheet-handle" aria-hidden="true" />
      {children}
    </div>
  </div>, document.querySelector(".ln-frame") ?? document.body);
}

export type SignSheetData = { ticket: TicketModel; context: SignContext; state: SignState };
export function SignSheet({ ticket, context, state, onAction }: SignSheetData & { onAction: (action: SignAction) => void }) {
  const copy = signCopy(state, context);
  useEffect(() => { if (state.status === "success") navigator.vibrate?.(10); }, [state.status]);
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const action = (value: SignAction) => {
    if (value === "close" || value === "done") {
      if (closing) return;
      setClosing(true);
      timer.current = setTimeout(() => onAction(value), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200);
    } else onAction(value);
  };
  return <ModalSheet title={copy.title} canDismiss={copy.canDismiss} onClose={() => onAction("close")} className={`ln-sign-sheet ${closing ? "ln-sheet--closing" : ""}`}>
    <div className="ln-sign-content" key={state.status === "error" ? state.kind : state.status} data-state={state.status}>
      {state.status === "success" ? <GlacierTick size={48} /> : state.status === "error" ? <span className="ln-warning" aria-hidden="true">△</span> : null}
      <h2>{copy.title}</h2>
      {state.status === "review" ? <p className="ln-note ln-sign-context">{copy.body}</p> : null}
      {state.status === "review" || state.status === "success" ? <div className="ln-cells">
        <MoneyCell label={MAX_LOSS} figure={ticket.loss} caption="" /><MoneyCell label={MAX_GAIN} figure={ticket.gain} caption="" />
      </div> : null}
      {state.status === "review" ? <div className="ln-sign-rows">
        <dl>{ticket.signRows.map((row) => <div key={row.label} className="ln-sign-row"><dt>{row.label}</dt><dd data-payout={row.payout}>{row.value}</dd></div>)}</dl>
        <p className="ln-sentence">{ticket.sentence}</p>
        <p className="ln-note">{ticket.salesClose}</p><p className="ln-note">{ticket.refund}</p>
        {ticket.note ? <p className="ln-note">{ticket.note}</p> : null}
      </div> : null}
      {state.status === "progress" ? <ol className="ln-progress" aria-live="polite">
        {copy.steps.map((step) => <li key={step.step} data-state={step.state}>
          <span className="ln-progress-glyph" aria-hidden="true">{step.state === "done" ? <GlacierTick size={24} /> : step.state === "active" ? "◌" : "○"}</span>
          <span>{step.label}</span>{step.state === "active" ? <><i className="ln-progress-bar" /><span className="ln-working">Working</span></> : null}
        </li>)}
      </ol> : null}
      {state.status !== "review" ? <p className="ln-sentence" role={state.status === "error" ? "alert" : undefined}>{copy.body}</p> : null}
    </div>
    <div className="ln-sign-actions">
      <button type="button" className="ln-cta ln-press" disabled={copy.primary.disabled} onClick={() => action(copy.primary.action)}>{copy.primary.label}</button>
      {copy.secondary ? <button type="button" className="ln-text-btn" onClick={() => action(copy.secondary!.action)}>{copy.secondary.label}</button> : null}
    </div>
  </ModalSheet>;
}

export function InfoSheet({ body, onClose }: { body: string; onClose: () => void }) {
  return <ModalSheet title={infoSheetTitle()} canDismiss onClose={onClose}>
    <h2>{infoSheetTitle()}</h2><p>{body}</p><button type="button" className="ln-cta ln-press" onClick={onClose}>{DONE}</button>
  </ModalSheet>;
}
