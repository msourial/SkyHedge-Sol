import { APPROVE_WALLET, DONE, GETTING_QUOTE, PAID_OUT, DRY_WINDOW, TRY_AGAIN, VIEW_WALLET, WAITING_WALLET, infoSheetTitle } from "../../../../shared/ui-copy.ts";
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
      <div className="ln-pay" style={{ minHeight: 104 }}>
        <p className="ln-label">{panel.title}</p>
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
  return (
    <div className="ln-pay-figures">
      <p className="ln-money-figure ln-fig-m">{loss.sign}{loss.whole}.{loss.fraction}</p>
      <p className="ln-money-figure ln-fig-m">{gain.sign}{gain.whole}.{gain.fraction}</p>
      <span className="ln-fig-minor">SKYT</span>
    </div>
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
