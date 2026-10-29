import * as SecureStore from "expo-secure-store";
import type { TipStorage } from "./round3.ts";
// Reuse the app's existing persistent storage; never mix this preference into wallet credentials.
export const multipleTipStorage: TipStorage = { getItem: SecureStore.getItemAsync, setItem: SecureStore.setItemAsync };
