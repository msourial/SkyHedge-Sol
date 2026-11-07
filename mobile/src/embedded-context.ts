import { createContext } from "react";
import type { WalletAdapter } from "./wallet-adapter";
export const EmbeddedWalletContext = createContext<WalletAdapter | null>(null);
