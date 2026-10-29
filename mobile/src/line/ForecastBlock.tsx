import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Text, View } from "react-native";
import type { ForecastEdge } from "../api.ts";
import { lineTokens as C } from "../../../shared/ui-tokens.ts";
import { forecastChip } from "../round3.ts";
import { GaugeTrack } from "./CoverGauge.tsx";
import { ui } from "./primitives.tsx";
function SignalReveal({ children, changeKey }: { children: ReactNode; changeKey: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => { opacity.setValue(0); const animation = Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }); animation.start(); return () => animation.stop(); }, [opacity, changeKey]);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}
export function EdgeChip({ edge }: { edge?: ForecastEdge }) {
  const chip = forecastChip(edge);
  return chip ? <SignalReveal changeKey={String(chip.points)}><View style={{ alignSelf: "flex-start", paddingHorizontal: 8, minHeight: 28, borderRadius: 999, justifyContent: "center", backgroundColor: chip.sign === "neg" ? C.avatarFill.heat : C.avatarFill.wind }}><Text style={[ui.label, { fontFamily: "Inter_700Bold", color: chip.sign === "neg" ? C.heat : C.wind }]}>{chip.points < 0 ? "−" : "+"}{Math.abs(chip.points).toFixed(0)} pts</Text></View></SignalReveal> : null;
}
export function ForecastBlock({ edge, condition }: { edge?: ForecastEdge; condition: string }) {
  if (!edge?.forecast) return null;
  return <SignalReveal changeKey={`${condition}/${edge.forecast.probability}`}><View style={{ backgroundColor: C.surface2, borderRadius: 16, padding: 12, marginTop: 10, gap: 10 }}><Text style={ui.label}>Chance of {condition}</Text>{[{ label: "Forecast", value: edge.forecast.probability }, { label: "History", value: edge.historyProbability }].map(row => <View key={row.label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Text style={[ui.figure, { fontSize: 15, width: 68 }]}>{row.label}</Text><View style={{ flex: 1 }}><GaugeTrack fraction={row.value} grey={row.label === "History"} color={row.label === "Forecast" ? C.wind : C.fg2}/></View><Text style={[ui.figure, { fontSize: 15, width: 58, textAlign: "right" }]}>{(row.value * 100).toFixed(row.label === "History" ? 1 : 0)}%</Text></View>)}</View></SignalReveal>;
}
