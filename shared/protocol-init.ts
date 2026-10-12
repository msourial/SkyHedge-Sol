/** Owner console gate: the client RPC check OR the server's finalized status may confirm initialization. */
export function isProtocolInitialized(clientCheck: boolean | null, serverProtocol?: { initialized?: boolean; status?: string } | null): boolean {
  return clientCheck === true || (serverProtocol?.initialized === true && serverProtocol.status === "ready");
}

/** "Approve initialization" is only offered when the client confirmed absence AND the server does not report it initialized. */
export function canOfferInitialization(clientCheck: boolean | null, serverProtocol?: { initialized?: boolean; status?: string } | null): boolean {
  return clientCheck === false && serverProtocol?.initialized !== true;
}

/** Reject after ms so a stalled RPC cannot hang the console. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = "Devnet RPC"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}
