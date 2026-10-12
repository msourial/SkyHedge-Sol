import React, { useEffect, useRef } from "react";
import Feather from "@expo/vector-icons/Feather";
import { AccessibilityInfo, Animated, StyleSheet, Text as NativeText, type TextProps, View, type ViewProps } from "react-native";
import { C, F } from "./theme";
import { TactilePressable } from "./liquid-glass";

export type AppIconName = React.ComponentProps<typeof Feather>["name"];

export function Text({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[{ fontFamily: F.body }, style]} />;
}

export function AppIcon({ name, color = C.muted, size = 20 }: { name: AppIconName; color?: string; size?: number }) {
  return <Feather name={name} size={size} color={color} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "ready" | "pending" | "error" }) {
  const color = tone === "ready" ? C.green : tone === "pending" ? C.amber : tone === "error" ? C.red : C.purple;
  return (
    <View style={[styles.pill, { borderColor: color }]} accessible accessibilityLabel={label}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function StatusSignal({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "ready" | "pending" | "error" }) {
  return <StatusPill label={label} tone={tone} />;
}

export function ScreenHeader({ eyebrow, title, detail, action }: { eyebrow?: string; title: string; detail?: string; action?: React.ReactNode }) {
  return <View style={styles.screenHeader}>
    <View style={styles.screenHeaderCopy}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={styles.screenTitle}>{title}</Text>
      {detail ? <Text style={styles.screenDetail}>{detail}</Text> : null}
    </View>
    {action ? <View style={styles.screenHeaderAction}>{action}</View> : null}
  </View>;
}

export function SectionHeader({ title, detail }: { title: string; detail?: string }) {
  return <View style={styles.sectionHeader}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>{detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}</View>;
}

export function InsetSurface({ children, style, ...props }: ViewProps) {
  return <View {...props} style={[styles.insetSurface, style]}>{children}</View>;
}

export function EvidenceTimeline({ steps }: { steps: Array<{ label: string; ready: boolean }> }) {
  return <View accessibilityLabel="Evidence and transaction progress" style={styles.timeline}>
    {steps.map((step, index) => <React.Fragment key={step.label}>
      {index > 0 ? <View style={styles.timelineRule} /> : null}
      <View style={styles.timelineStep}><View style={[styles.timelineDot, step.ready && styles.timelineDotReady]} /><Text style={[styles.timelineText, step.ready && styles.timelineTextReady]}>{step.label}</Text></View>
    </React.Fragment>)}
  </View>;
}

export function BottomSheet({ children }: { children: React.ReactNode }) {
  return <View style={styles.bottomSheet}>{children}</View>;
}

export function ActionButton({ label, onPress, disabled = false, busy = false, icon }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  icon?: AppIconName;
}) {
  return (
    <TactilePressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      android_ripple={{ color: C.greenSoft }}
      style={({ pressed }) => [styles.action, disabled && styles.actionDisabled, pressed && !disabled && styles.actionPressed]}
    >
      {icon ? <AppIcon name={icon} color={disabled ? C.quiet : C.actionText} size={19} /> : null}
      <Text style={[styles.actionText, disabled && styles.actionTextDisabled]}>{busy ? "Working…" : label}</Text>
    </TactilePressable>
  );
}

export const PrimaryAction = ActionButton;

/** A single short reveal for content produced by a user's action. */
export function Reveal({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!active) return;
      if (reduceMotion) opacity.setValue(1);
      else Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    }).catch(() => { if (active) opacity.setValue(1); });
    return () => { active = false; opacity.stopAnimation(); };
  }, [opacity]);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  pill: { minHeight: 32, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 7, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontFamily: F.bodySemi, fontSize: 11 },
  action: { minHeight: 52, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", borderRadius: 14, paddingHorizontal: 16, backgroundColor: C.green },
  actionDisabled: { backgroundColor: C.surfaceRaised, borderWidth: 1, borderColor: C.border },
  actionPressed: { opacity: 0.84 },
  actionText: { color: C.actionText, fontFamily: F.bodyBold, fontSize: 15 },
  actionTextDisabled: { color: C.quiet },
  screenHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 20 },
  screenHeaderCopy: { flex: 1 },
  screenHeaderAction: { paddingTop: 4 },
  eyebrow: { color: C.rain, fontFamily: F.bodySemi, fontSize: 12, marginBottom: 5 },
  screenTitle: { color: C.ink, fontFamily: F.headingBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.8 },
  screenDetail: { color: C.muted, fontFamily: F.body, fontSize: 14, lineHeight: 21, marginTop: 8 },
  sectionHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 24, marginBottom: 11 },
  sectionTitle: { color: C.ink, fontFamily: F.heading, fontSize: 19 },
  sectionDetail: { color: C.quiet, fontFamily: F.body, fontSize: 11 },
  insetSurface: { backgroundColor: C.surface, borderColor: C.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16 },
  timeline: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 6 },
  timelineRule: { flex: 1, minWidth: 8, height: StyleSheet.hairlineWidth, backgroundColor: C.border },
  timelineStep: { alignItems: "center", gap: 5 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.quiet },
  timelineDotReady: { backgroundColor: C.mint },
  timelineText: { color: C.quiet, fontFamily: F.bodyMedium, fontSize: 11 },
  timelineTextReady: { color: C.mint },
  bottomSheet: { backgroundColor: C.surfaceRaised, borderTopColor: C.border, borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18 },
});
