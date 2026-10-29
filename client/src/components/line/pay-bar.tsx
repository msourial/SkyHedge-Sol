import { APPROVE_WALLET, DONE, GETTING_QUOTE, MAX_GAIN, MAX_LOSS, PAID_OUT, DRY_WINDOW, TRY_AGAIN, VIEW_WALLET, WAITING_WALLET, infoSheetTitle } from "../../../../shared/ui-copy.ts";
import type { PanelModel, TicketModel } from "../../../../shared/ui-view.ts";

export function PayBar({ panel, ticket, onConnect, onProtect, onApprove, onWallet, onRetry, onGo }: {
  panel: PanelModel;
  ticket: TicketModel | null;
  onConnect: () => void;
  onProtect: () => void;
  onApprove: () => void;
  onWallet: () => void;
  onRetry: () => void;
  onGo: (cityId: string) => void;
}) {
  if (panel.kind === "loading") {
    return (
      <div className="ln-pay">
        <div className="ln-skel" />
        <button type="button" className="ln-cta" disabled>{GETTING_QUOTE}</button>
      </div>
    );
  }
  if (panel.kind === "error") {
    return (
      <div className="ln-pay" role="alert">
        <p className="ln-alert">{panel.message}</p>
        <button type="button" className="ln-text-btn" onClick={onRetry}>{TRY_AGAIN}</button>
      </div>
    );
  }
  if (panel.kind === "not-open") {
    return (
      <div className="ln-pay">
        <p>{panel.line}</p>
        {panel.go ? <button type="button" className="ln-text-btn" onClick={() => onGo(panel.go!.cityId)}>{panel.go.label}</button> : null}
      </div>
    );
  }
  if (panel.kind === "closed") {
    return <div className="ln-pay"><p>{panel.line}</p></div>;
  }
  if (panel.kind === "paid") {
    return (
      <div className="ln-pay">
        <p className="ln-fig-m ln-result--paid">{panel.result}</p>
        <p className="ln-stamp">{PAID_OUT}</p>
      </div>
    );
  }
  if (panel.kind === "dry") {
    return (
      <div className="ln-pay">
        <p className="ln-fig-m">{panel.result}</p>
        <p className="ln-stamp ln-stamp--dry">{DRY_WINDOW}</p>
      </div>
    );
  }
  if (panel.kind === "covered") {
    return (
      <div className="ln-pay ln-pay--receipt">
        <p className="ln-receipt-title"><GlacierTick />{panel.title}</p>
        <Figures loss={panel.loss} gain={panel.gain} />
        <button type="button" className="ln-text-btn" onClick={onWallet}>{VIEW_WALLET}</button>
      </div>
    );
  }
  const action = panel.kind === "connect" ? onConnect : panel.kind === "signing" ? undefined : onProtect;
  return (
    <div className="ln-pay">
      <Figures loss={panel.loss} gain={panel.gain} />
      <button type="button" className="ln-cta ln-press" disabled={panel.kind === "signing" || !ticket} onClick={action}>{panel.cta}</button>
    </div>
  );
}

function Figures({ loss, gain }: { loss: { sign: string; whole: string; fraction: string }; gain: { sign: string; whole: string; fraction: string } }) {
  const lossText = `${loss.sign}${loss.whole}.${loss.fraction}`;
  const gainText = `${gain.sign}${gain.whole}.${gain.fraction}`;
  return (
    <div className="ln-pay-figures">
      <p className="ln-pay-side"><span className="ln-label">{MAX_LOSS}</span><span className="ln-money-figure ln-fig-m">{lossText}</span></p>
      <p className="ln-pay-side"><span className="ln-label">{MAX_GAIN}</span><span className="ln-money-figure ln-fig-m">{gainText}</span></p>
      <span className="ln-fig-minor">SKYT</span>
    </div>
  );
}

function GlacierTick() {
  return (
    <svg className="ln-tick-glyph" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M3.5 9.2 7.1 12.8 14.5 5.2" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SignSheet({ ticket, busy, error, onClose, onApprove }: { ticket: TicketModel; busy: boolean; error: string | null; onClose: () => void; onApprove: () => void }) {
  return (
    <div className="ln-sheet-back" onClick={onClose}>
      <div className="ln-sheet" role="dialog" aria-label={APPROVE_WALLET} onClick={(event) => event.stopPropagation()}>
        <h2>{APPROVE_WALLET}</h2>
        <dl>
          {ticket.signRows.map((row) => (
            <div key={row.label} className="ln-sign-row"><dt>{row.label}</dt><dd data-payout={row.payout ? "true" : "false"}>{row.value}</dd></div>
          ))}
        </dl>
        <p className="ln-sentence">{ticket.sentence}</p>
        {ticket.salesClose ? <p className="ln-note">{ticket.salesClose}</p> : null}
        {error ? <p className="ln-alert" role="alert">{error}</p> : null}
        <button type="button" className="ln-cta ln-press" disabled={busy} onClick={onApprove}>{busy ? WAITING_WALLET : APPROVE_WALLET}</button>
      </div>
    </div>
  );
}

export function InfoSheet({ body, onClose }: { body: string; onClose: () => void }) {
  return (
    <div className="ln-sheet-back" onClick={onClose}>
      <div className="ln-sheet" role="dialog" aria-label={infoSheetTitle()} onClick={(event) => event.stopPropagation()}>
        <h2>{infoSheetTitle()}</h2>
        <p>{body}</p>
        <button type="button" className="ln-cta ln-press" onClick={onClose}>{DONE}</button>
      </div>
    </div>
  );
}
