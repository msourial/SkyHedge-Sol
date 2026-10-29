import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Linking, ScrollView, Text, Vibration, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { ArrowUpRight, X } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { lineTokens as C } from "../../../shared/ui-tokens.ts";
import { formatBaseGrouped } from "../../../shared/ui-money.ts";
import { perilById } from "../../../shared/peril-registry.ts";
import type { PurchaseState } from "../round3.ts";
import type { SignReview } from "./SignSheet.tsx";
import { useReducedMotion } from "../liquid-glass.tsx";
import { LinePressable } from "./pressable.tsx";
import { Group, Pill, Row, ui } from "./primitives.tsx";
function Arrive({ index, children, reduced }: { index: number; children: ReactNode; reduced: boolean }) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { const a = Animated.timing(fade, { toValue: 1, duration: reduced ? 150 : 200, delay: reduced ? 0 : 200 + 40 * Math.min(index, 7), easing: Easing.out(Easing.cubic), useNativeDriver: true }); a.start(); return () => a.stop(); }, [fade, reduced, index]);
  return <Animated.View style={{ opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 8, 0] }) }] }}>{children}</Animated.View>;
}
export function PurchaseReceipt({ review, state, signature, reason, reducedMotion, onWallet, onDone, onRetry }: { review: SignReview; state: Exclude<PurchaseState, "hidden">; signature?: string | null; reason?: string | null; reducedMotion?: boolean; onWallet: () => void; onDone: () => void; onRetry: () => void }) {
  const preference = useReducedMotion(), reduced = reducedMotion ?? preference, insets = useSafeAreaInsets();
  const pending = state === "pending" || state === "still_confirming", success = state === "success", cancelled = state === "cancelled";
  const scale = useRef(new Animated.Value(.6)).current, draw = useRef(new Animated.Value(0)).current, spin = useRef(new Animated.Value(0)).current;
  const hapticState = useRef<string | null>(null);
  const notify = () => { if (!pending && hapticState.current !== state) { hapticState.current = state; Vibration.vibrate(success ? [0, 12] : [0, 24]); } };
  const [stroke, setStroke] = useState(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) { scale.setValue(1); setStroke(1); notify(); return; }
    scale.setValue(.6); draw.setValue(0); setStroke(0);
    const listener = draw.addListener(({ value }) => setStroke(value));
    const a = Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 320, easing: Easing.bezier(.2, .8, .2, 1), useNativeDriver: true }),
      Animated.timing(draw, { toValue: 1, delay: 120, duration: 200, useNativeDriver: false }),
    ]);
    a.start(({ finished }) => { if (finished) notify(); });
    return () => { a.stop(); draw.removeListener(listener); };
  }, [success, pending, reduced, scale, draw]);
  useEffect(() => { if (!pending || reduced) return; const a = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })); a.start(); return () => a.stop(); }, [pending, reduced, spin]);
  const pay = formatBaseGrouped(BigInt(review.target.premiumBase)), payout = review.ticket.payout;
  const station = review.ticket.signRows.find(row => row.label === "Station")?.value ?? review.context.cityName;
  const title = success ? "You're covered" : pending ? state === "still_confirming" ? "Still confirming" : "Confirming on Devnet" : cancelled ? "Cancelled in Phantom" : "Cover not bought";
  const rows = [{ label: "Trigger", value: review.context.triggerLabel }, { label: "Station", value: `${station}${station.includes(review.context.cityName) ? "" : `, ${review.context.cityName}`}` }, { label: "Window", value: review.context.windowLabel.replace(" to ", " – ") }, { label: "Cover size", value: `${formatBaseGrouped(BigInt(review.target.amount))} SKYT` }, { label: success ? "You paid" : pending ? "Paying" : "Would cost", value: `${pay} SKYT` }, { label: "Pays if it hits", value: `${payout} SKYT` }];
  return <View key={state} style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top, paddingHorizontal: 16, paddingBottom: Math.max(24, insets.bottom) }}>
    <View style={{ height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><LinePressable accessibilityLabel="Close purchase receipt" onPress={onDone} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}><View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface1, alignItems: "center", justifyContent: "center" }}><X weight="bold" size={22} color={C.fg}/></View></LinePressable><Pill devnet/></View>
    <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
      <Animated.View style={{ alignSelf: "center", marginTop: 18, marginBottom: 20, width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", backgroundColor: success ? C.glacier : pending ? C.surface2 : C.avatarFill.heat, transform: [{ scale: reduced || pending ? 1 : scale }] }}>
        {success ? <Svg width={56} height={56} viewBox="0 0 56 56"><Path d="M11 29 L23 41 L46 16" fill="none" stroke={C.bg} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="55 55" strokeDashoffset={55 * (1 - stroke)}/></Svg> : pending ? <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}><Svg width={56} height={56}><Path d="M28 7 A21 21 0 0 1 49 28" fill="none" stroke={C.glacier} strokeWidth={5} strokeLinecap="round"/></Svg></Animated.View> : <Text style={[ui.figure, { fontSize: 48, lineHeight: 58, color: C.heat }]}>!</Text>}
      </Animated.View>
      <Arrive index={0} reduced={reduced}><Text accessibilityRole="header" accessibilityLiveRegion="polite" accessibilityLabel={`${title}. ${review.context.triggerLabel}, ${station}, ${review.context.windowLabel}.`} style={[ui.figure, { fontFamily: "Inter_750", fontSize: 28, lineHeight: 34, textAlign: "center", letterSpacing: -.6 }]}>{title}</Text></Arrive>
      <Arrive index={1} reduced={reduced}><Text style={[ui.body, { textAlign: "center", marginTop: 10, marginBottom: 24 }]}>{success ? `${perilById(review.context.peril)?.label} in ${station}, ${review.context.cityName}` : pending ? `Paying ${pay} SKYT` : cancelled ? "You cancelled the request in Phantom." : "No SKYT left your wallet. The transaction didn't confirm on Devnet."}</Text></Arrive>
      <Group>{rows.map((row, index) => <Arrive key={row.label} index={index + 2} reduced={reduced}><Row divider={index > 0} height={52}><Text style={[ui.body, { flex: 1 }]}>{row.label}</Text><Text style={[ui.figure, { fontSize: 15, flexShrink: 1, textAlign: "right", maxWidth: "68%" }]}>{row.label === "Trigger" ? <><Text style={{ color: C.slicker }}>{row.value.split(/ or /)[0]}</Text>{row.value.includes(" or ") ? ` or ${row.value.split(" or ")[1]}` : ""}</> : row.value}</Text></Row></Arrive>)}</Group>
      {!pending && !success && !cancelled && reason ? <Text style={[ui.body, { color: C.heat, marginTop: 14 }]}>{reason}</Text> : null}
      {signature ? <Arrive index={8} reduced={reduced}><Group style={{ marginTop: 10 }}><Row onPress={() => { void Linking.openURL(`https://explorer.solana.com/tx/${signature}?cluster=devnet`); }}><Text style={[ui.body, { flex: 1, color: C.fg }]}>View transaction</Text><Text style={ui.body}>{signature.slice(0, 4)}…{signature.slice(-4)}</Text><ArrowUpRight size={20} weight="bold" color={C.fg2}/></Row></Group><Text style={[ui.label, { marginTop: 12, marginLeft: 4 }]}>Solana Explorer · Devnet</Text></Arrive> : null}
    </ScrollView>
    <Arrive index={9} reduced={reduced}><View style={{ paddingTop: 12, backgroundColor: C.bg }}><LinePressable disabled={pending} onPress={success ? onWallet : onRetry} style={[ui.cta, pending && { backgroundColor: C.surface2 }]}><Text style={[ui.ctaText, pending && { color: C.fg2 }]}>{success ? "View in Wallet" : pending ? "Confirming…" : "Try again"}</Text></LinePressable><LinePressable onPress={pending ? onWallet : onDone} style={{ height: 48, alignItems: "center", justifyContent: "center", marginTop: 4 }}><Text style={ui.figure}>{success ? "Done" : pending ? "Keep checking in Wallet" : "Back to Protect"}</Text></LinePressable></View></Arrive>
  </View>;
}
