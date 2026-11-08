/** Independent of wallet credentials. Storage failures keep the explainer available next launch. */
export const WELCOME_SEEN_KEY = "skyhedge.welcome.seen";
export function createWelcomeStore(storage: { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<unknown> }) {
  return {
    async shouldShow(): Promise<boolean> {
      try { return await storage.getItem(WELCOME_SEEN_KEY) !== "true"; } catch { return true; }
    },
    async markSeen(): Promise<void> {
      try { await storage.setItem(WELCOME_SEEN_KEY, "true"); } catch { /* Allow entry even when preference storage is unavailable. */ }
    },
  };
}
