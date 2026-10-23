import * as SecureStore from "expo-secure-store";

const KEY = "skyhedge.first-run-done";

/** True once this install has connected a wallet, held a position, or left the city step. */
export async function loadFirstRunDone(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === "1";
  } catch {
    return false;
  }
}

export async function markFirstRunDone(): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, "1");
  } catch {
    // Storage can fail on a locked device. The in-memory flag still hides the step.
  }
}
