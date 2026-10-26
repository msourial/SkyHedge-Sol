import * as SecureStore from "expo-secure-store";

import { FIRST_RUN_KEY } from "../../shared/ui-copy.ts";
const KEY = FIRST_RUN_KEY;

/** True only after the user dismisses the Line introduction. */
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
    // Storage can fail on a locked device. The in-memory flag still hides the strip.
  }
}
