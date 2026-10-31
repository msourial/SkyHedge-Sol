import type { TipStorage } from "./round3.ts";
export const multipleTipStorage: TipStorage = {
  getItem: async key => { try { return localStorage.getItem(key); } catch { return null; } },
  setItem: async (key, value) => { try { localStorage.setItem(key, value); } catch { /* Preference storage is optional. */ } },
};
