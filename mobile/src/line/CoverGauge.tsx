import { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import type { ReceiptModel } from "../../../shared/ui-discovery.ts";
import { lineMotion, lineTokens as C } from "../../../shared/ui-tokens.ts";
import type { CoverProgress } from "../api.ts";
import { coverGauge } from "../round3.ts";
import { useReducedMotion } from "../liquid-glass.tsx";
import { ui } from "./primitives.tsx";
export function GaugeTrack({ fraction, grey, large = false, color }: { fraction: number; grey: boolean; large?: boolean; color?: string }) {
  const reduced = useReducedMotion(), fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) { fill.setValue(fraction); return; }
    const animation = Animated.timing(fill, { toValue: fraction, duration: lineMotion.fillMs, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start(); return () => animation.stop();
  }, [fraction, reduced, fill]);
  return <View accessible={false} style={{ height: large ? 16 : 8, borderRadius: 8, backgroundColor: C.bgRaised, overflow: "hidden" }}><Animated.View style={{ height: "100%", borderRadius: 8, width: fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }), backgroundColor: color ?? (grey ? C.dryText : C.glacier) }}/></View>;
}
export function CoverGauge({ receipt, progress, now }: { receipt: ReceiptModel; progress?: CoverProgress | null; now?: number }) {
  const g = coverGauge(receipt, progress, now);
  return <View accessibilityLabel={`${g.label}. ${g.reading}. ${g.timing}. ${g.through ?? ""}. ${g.coverage ?? ""}`} style={{ marginLeft: 62, marginRight: 14, paddingBottom: 12, gap: 7 }}><GaugeTrack fraction={g.fraction} grey={g.grey}/><View style={{ flexDirection: "row", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}><Text style={[ui.label, { color: C.fg }]}>{g.reading}</Text><Text style={ui.label}>{g.timing}</Text></View>{g.through ? <Text style={[ui.label, { color: C.dryText }]}>{g.through} · {g.coverage}</Text> : null}</View>;
}
