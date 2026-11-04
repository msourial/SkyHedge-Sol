import React from "react";
import { Linking, View } from "react-native";
import { LinePressable } from "./line/pressable.tsx";
import { ui } from "./line/primitives.tsx";
import { Text } from "./ui";
import { lineTokens as C } from "../../shared/ui-tokens.ts";

export function BrowserWalletStatus({ wallet, balance, error }: { wallet: string | null; balance: string | null; error: string | null }) {
  return <View style={{ marginTop: 16, padding: 16, borderRadius: 16, backgroundColor: C.surface1, gap: 8 }}>
    <Text style={{ color: C.fg, fontSize: 14, fontWeight: "600" }}>Phantom · Solana Devnet</Text>
    {wallet ? <><Text selectable style={{ color: C.fg2, fontSize: 12, overflowWrap: "anywhere" } as any}>{wallet}</Text><Text style={{ color: C.fg, fontSize: 20 }}>{balance ?? "—"} SKYT</Text></> : <Text style={{ color: C.fg2, fontSize: 13, lineHeight: 20 }}>Connect the Phantom browser extension. SKYT is a test token.</Text>}
    <Text style={{ color: C.fg2, fontSize: 13, lineHeight: 20 }}>Before buying, enable Testnet Mode in Phantom settings and choose Solana Devnet. You need Devnet SOL for fees and test SKYT for cover. Request test SKYT from the SkyHedge team using your public wallet address; there is no in-app SKYT faucet.</Text>
    <LinePressable accessibilityRole="link" onPress={() => { void Linking.openURL("https://faucet.solana.com/"); }} style={{ minHeight: 48, justifyContent: "center" }}><Text style={[ui.figure, { color: C.glacier, fontSize: 15 }]}>Get Devnet SOL</Text></LinePressable>
    <Text style={{ color: C.fg2, fontSize: 13, lineHeight: 20 }}>After settlement, return to Wallet and open your cover. If a payout is ready, tap Collect and approve in Phantom.</Text>
    {error ? <Text accessibilityRole="alert" style={{ color: C.heat, fontSize: 13, lineHeight: 20 }}>{error}</Text> : null}
  </View>;
}
