import * as SecureStore from "expo-secure-store";
import { createWelcomeStore } from "./welcome-state.ts";
export const welcomeStore = createWelcomeStore({
  getItem: SecureStore.getItemAsync, setItem: SecureStore.setItemAsync,
});
