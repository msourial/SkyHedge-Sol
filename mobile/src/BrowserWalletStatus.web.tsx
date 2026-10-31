import React from "react";
import { View } from "react-native";
import { Text } from "./ui";
import { lineTokens as C } from "../../shared/ui-tokens.ts";

export function BrowserWalletStatus({ wallet, balance, error }: { wallet: string | null; balance: string | null; error: string | null }) {
  return <View style={{ marginTop: 16, padding: 16, borderRadius: 16, backgroundColor: C.surface1, gap: 8 }}>
    <Text style={{ color: C.fg, fontSize: 14, fontWeight: "600" }}>Phantom · Solana Devnet</Text>
    {wallet ? <><Text selectable style={{ color: C.fg2, fontSize: 12, overflowWrap: "anywhere" } as any}>{wallet}</Text><Text style={{ color: C.fg, fontSize: 20 }}>{balance ?? "—"} SKYT</Text></> : <Text style={{ color: C.fg2, fontSize: 13, lineHeight: 20 }}>Connect the Phantom browser extension. In Phantom, enable Testnet Mode and choose Solana Devnet. SKYT is a test token.</Text>}
    {error ? <Text accessibilityRole="alert" style={{ color: C.heat, fontSize: 13, lineHeight: 20 }}>{error}</Text> : null}
  </View>;
}
