import { phantomProvider } from "./wallet.web";

export function watchWalletSession(invalidate: () => void): () => void {
  try {
    const provider = phantomProvider();
    provider.on?.("accountChanged", invalidate);
    provider.on?.("disconnect", invalidate);
    return () => {
      provider.removeListener?.("accountChanged", invalidate);
      provider.removeListener?.("disconnect", invalidate);
    };
  } catch { return () => {}; }
}
