import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, Vibration, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signCopy, type SignAction, type SignContext, type SignOutcome, type SignState, type SignStep } from "../../../shared/ui-sign.ts";
import { lineTokens as C } from "../../../shared/ui-tokens.ts";
import type { TicketModel } from "../../../shared/ui-view.ts";
import type { LineSubmitTarget } from "../line-submit.ts";
import { F } from "../theme.ts";
import { MoneyCells, TicketRow } from "./ProtectLine.tsx";
import { LinePressable } from "./pressable.tsx";

export type SignReview = { target: LineSubmitTarget; context: SignContext; ticket: TicketModel; wallet: string | null };

/** Frozen quote and wallet survive page refreshes throughout a single signing attempt. */
export function SignSheet({ review, onApprove, onClose, onWallet, onMarkets }: {
  review: SignReview;
  onApprove: (review: SignReview, onStep: (step: SignStep) => void) => Promise<SignOutcome>;
  onClose: () => void;
  onWallet: () => void;
  onMarkets: () => void;
}) {
  const [state, setState] = useState<SignState>({ status: "review" });
  const [displayed, setDisplayed] = useState<SignState>(state);
  const [motionPreference, setMotionPreference] = useState<boolean | null>(null);
  const reduced = motionPreference !== false;
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (live) setMotionPreference(value); }).catch(() => { if (live) setMotionPreference(true); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setMotionPreference);
    return () => { live = false; subscription.remove(); };
  }, []);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const entry = useRef(new Animated.Value(0)).current;
  const swap = useRef(new Animated.Value(1)).current;
  const busy = useRef(false);
  const closing = useRef(false);
  const mounted = useRef(true);
  const copy = signCopy(displayed, review.context);
  useEffect(() => { mounted.current = true; Vibration.vibrate(10); return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (motionPreference == null || closing.current) return;
    const animation = Animated.timing(entry, { toValue: 1, duration: reduced ? 0 : 320, easing: Easing.bezier(.23, 1, .32, 1), useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [entry, motionPreference, reduced]);
  useEffect(() => {
    if (reduced) { swap.setValue(1); setDisplayed(state); return; }
    const out = Animated.timing(swap, { toValue: 0, duration: 60, useNativeDriver: true });
    out.start(({ finished }) => {
      if (!finished || !mounted.current) return;
      setDisplayed(state);
      Animated.timing(swap, { toValue: 1, duration: 60, useNativeDriver: true }).start();
    });
    return () => { out.stop(); swap.stopAnimation(); };
  }, [state, reduced, entry, swap]);
  useEffect(() => { if (state.status === "success") Vibration.vibrate(10); }, [state.status]);
  const close = (after?: () => void) => {
    if (closing.current || busy.current) return;
    closing.current = true;
    Animated.timing(entry, { toValue: 0, duration: reduced ? 0 : 200, easing: Easing.bezier(.23, 1, .32, 1), useNativeDriver: true }).start(({ finished }) => { if (finished) { onClose(); after?.(); } });
  };
  const dismiss = () => { if (signCopy(state, review.context).canDismiss) close(); };
  const approve = async () => {
    if (busy.current || state.status !== "review") return;
    busy.current = true;
    setState({ status: "progress", step: "wallet" });
    let outcome: SignOutcome;
    try {
      outcome = await onApprove(review, (step) => {
        if (mounted.current) setState((previous) => previous.status === "progress" && ["wallet", "send", "confirm"].indexOf(step) >= ["wallet", "send", "confirm"].indexOf(previous.step) ? { status: "progress", step } : previous);
      });
    } catch (reason) {
      console.warn("Cover submit failed", reason);
      outcome = { kind: "error", error: "unconfirmed" };
    }
    busy.current = false;
    if (mounted.current) setState(outcome.kind === "confirmed" ? { status: "success" } : { status: "error", kind: outcome.kind === "already-covered" ? "already-covered" : outcome.error });
  };
  const act = (action: SignAction) => {
    if (busy.current || closing.current) return;
    if (action === "approve") void approve();
    else if (action === "retry") setState({ status: "review" });
    else if (action === "wallet") close(onWallet);
    else if (action === "markets") close(onMarkets);
    else if (action === "close" || action === "done") close();
  };
  return <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={dismiss} accessibilityViewIsModal>
    <View style={styles.modal}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: entry }]}><Pressable accessibilityLabel="Dismiss cover review" accessible={false} onPress={dismiss} style={styles.scrim} /></Animated.View>
      <Animated.View accessibilityViewIsModal style={[styles.sheet, { maxHeight: height - insets.top - 12, paddingBottom: 16 + insets.bottom, transform: [{ translateY: entry.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }]}>
        <View style={styles.handle} />
        <Animated.View style={[styles.content, { opacity: swap }]}>
          {displayed.status === "success" ? <Text accessibilityLabel="Cover confirmed" style={styles.success}>✓</Text> : displayed.status === "error" ? <Text style={styles.warning}>⚠</Text> : null}
          <Text accessibilityRole="header" style={displayed.status === "error" ? styles.errorTitle : styles.title}>{copy.title}</Text>
          {displayed.status === "review" ? <>
            <Text style={styles.note}>{copy.body}</Text>
            <MoneyCells ticket={review.ticket} />
            <ScrollView style={styles.rows} contentContainerStyle={styles.rowsContent} bounces={false}>{review.ticket.signRows.map((row) => <TicketRow key={row.label} {...row} />)}</ScrollView>
            <Text style={styles.body}>{review.ticket.sentence}</Text>
            <Text style={styles.note}>{review.ticket.salesClose}</Text>
            <Text style={styles.note}>{review.ticket.refund}</Text>
            {review.ticket.note ? <Text style={styles.note}>{review.ticket.note}</Text> : null}
          </> : displayed.status === "progress" ? <>
            <View style={styles.steps}>{copy.steps.map((step) => <View key={step.step} style={styles.step}>
              <Text style={[styles.stepGlyph, step.state === "done" && styles.done]}>{step.state === "done" ? "✓" : step.state === "active" ? "•" : "○"}</Text>
              <View style={styles.stepContent}><Text style={[styles.body, step.state === "pending" && styles.pending]}>{step.label}</Text>{step.state === "active" ? reduced ? <Text style={styles.note}>Working</Text> : <ProgressBar /> : null}</View>
            </View>)}</View><Text style={styles.note}>{copy.body}</Text>
          </> : displayed.status === "success" ? <><MoneyCells ticket={review.ticket} /><Text style={styles.body}>{copy.body}</Text></> : <Text style={styles.body}>{copy.body}</Text>}
          <LinePressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(copy.primary.disabled) }} disabled={copy.primary.disabled} onPress={() => act(copy.primary.action)} style={[styles.primary, copy.primary.disabled && styles.disabled]}><Text style={[styles.primaryText, copy.primary.disabled && styles.pending]}>{copy.primary.label}</Text></LinePressable>
          {copy.secondary ? <Pressable accessibilityRole="button" onPress={() => act(copy.secondary!.action)} style={styles.secondary}><Text style={styles.secondaryText}>{copy.secondary.label}</Text></Pressable> : null}
        </Animated.View>
      </Animated.View>
    </View>
  </Modal>;
}
function ProgressBar() {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => { const a = Animated.loop(Animated.timing(progress, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })); a.start(); return () => a.stop(); }, [progress]);
  return <View style={styles.progressTrack}><Animated.View style={[styles.progress, { transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-80, 300] }) }] }]} /></View>;
}
const styles = StyleSheet.create({
  modal: { flex: 1, justifyContent: "flex-end" }, scrim: { flex: 1, backgroundColor: "rgba(11,18,32,0.72)" },
  sheet: { backgroundColor: C.surface1, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 12 }, handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.tick, alignSelf: "center", marginBottom: 16 }, content: { flexShrink: 1 },
  title: { color: C.fg, fontFamily: "Inter_750", fontVariant: ["tabular-nums"], fontSize: 28, lineHeight: 30, marginBottom: 4 }, errorTitle: { color: C.fg, fontFamily: F.bodyBold, fontVariant: ["tabular-nums"], fontSize: 20, lineHeight: 24, marginBottom: 12 },
  body: { color: C.fg, fontFamily: F.body, fontVariant: ["tabular-nums"], fontSize: 15, lineHeight: 22 }, note: { color: C.fg2, fontFamily: F.body, fontVariant: ["tabular-nums"], fontSize: 13, lineHeight: 18, marginTop: 4 },
  rows: { flexShrink: 1, minHeight: 48, marginBottom: 12 }, rowsContent: { flexGrow: 0 }, success: { color: C.glacier, fontSize: 48, lineHeight: 56, marginBottom: 8 }, warning: { color: C.fg2, fontSize: 24, lineHeight: 32, marginBottom: 8 },
  steps: { marginVertical: 24 }, step: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 }, stepGlyph: { width: 24, color: C.fg2, fontSize: 24 }, stepContent: { flex: 1 }, done: { color: C.glacier }, pending: { color: C.dryText },
  progressTrack: { height: 2, backgroundColor: C.surface2, overflow: "hidden", marginTop: 4 }, progress: { width: 80, height: 2, backgroundColor: C.glacier },
  primary: { minHeight: 56, backgroundColor: C.glacier, borderRadius: 999, justifyContent: "center", alignItems: "center", marginTop: 16 }, disabled: { backgroundColor: C.surface2 }, primaryText: { color: C.onGlacier, fontFamily: F.bodySemi, fontSize: 15, lineHeight: 22 }, secondary: { minHeight: 48, justifyContent: "center", alignItems: "center" }, secondaryText: { color: C.fg2, fontFamily: F.bodySemi, fontSize: 15, lineHeight: 22 },
});
