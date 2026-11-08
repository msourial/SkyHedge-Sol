import { createWelcomeStore } from "./welcome-state.ts";
export const welcomeStore = createWelcomeStore({
  getItem: async key => localStorage.getItem(key),
  setItem: async (key, value) => { localStorage.setItem(key, value); },
});
