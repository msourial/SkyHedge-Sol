import React, { useEffect, useRef } from "react";
import Feather from "@expo/vector-icons/Feather";
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text as NativeText, type TextProps, View, type ViewProps } from "react-native";
import { C, F, glass, radius } from "./theme";
import { TactilePressable } from "./liquid-glass";

export type AppIconName = React.ComponentProps<typeof Feather>["name"];

export function Text({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[{ fontFamily: F.body }, style]} />;
}

export function AppIcon({ name, color = C.muted, size = 20 }: { name: AppIconName; color?: string; size?: number }) {
  return <Feather name={name} size={size} color={color} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "ready" | "pending" | "error" }) {
  const color = tone === "ready" ? C.green : tone === "pending" ? C.amber : tone === "error" ? C.red : C.muted;
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

/** The single per-screen disclosure. Every screen gets at most one. */
export function Disclosure({ children }: { children: string }) {
  const [open, setOpen] = React.useState(false);
  return <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={children} onPress={() => setOpen((v) => !v)} style={styles.disclosure}>
    <AppIcon name="info" color={C.quiet} size={16} />
    <Text numberOfLines={open ? undefined : 1} style={styles.disclosureText}>{children}</Text>
  </Pressable>;
}

export function BottomSheet({ children }: { children: React.ReactNode }) {
  return <View style={styles.bottomSheet}>{children}</View>;
}

export function ActionButton({ label, onPress, disabled = false, busy = false, icon, variant = "primary" }: {
  variant?: "primary" | "secondary";
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
      style={({ pressed }) => [styles.action, variant === "secondary" && styles.actionSecondary, disabled && styles.actionDisabled, pressed && !disabled && styles.actionPressed]}
    >
      {icon ? <AppIcon name={icon} color={disabled ? C.quiet : variant === "secondary" ? C.ink : C.actionText} size={19} /> : null}
      <Text style={[styles.actionText, variant === "secondary" && styles.actionTextSecondary, disabled && styles.actionTextDisabled]}>{busy ? "Working…" : label}</Text>
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


/**
 * Payoff profile: the option's shape in one glance. A 0 → 2× threshold rainfall scale,
 * the payout zone in gold, the strike marked. Pure Views (no SVG dependency).
 */
export function PayoffProfile({ thresholdMm, below = false }: { thresholdMm: number; below?: boolean }) {
  const max = Math.max(thresholdMm * 2, 1);
  const strikePct = Math.min(100, (thresholdMm / max) * 100);
  const fmt = (mm: number) => `${Number.isInteger(mm) ? mm : mm.toFixed(1)} mm`;
  return <View accessible accessibilityLabel={`Pays out if rainfall is ${below ? "below" : "at or above"} ${fmt(thresholdMm)}`} style={styles.payoff}>
    <View style={styles.payoffTrack}>
      <View style={[styles.payoffZone, below ? { left: 0, width: `${strikePct}%` } : { left: `${strikePct}%`, right: 0 }]} />
      <View style={[styles.payoffStrike, { left: `${strikePct}%` }]} />
    </View>
    <View style={styles.payoffAxis}>
      <Text style={styles.payoffTick}>0 mm</Text>
      <Text style={[styles.payoffTick, styles.payoffStrikeLabel]}>Strike {fmt(thresholdMm)}</Text>
      <Text style={styles.payoffTick}>{fmt(max)}</Text>
    </View>
    <View style={styles.payoffLegend}><View style={styles.payoffSwatch} /><Text style={styles.payoffTick}>{below ? "Payout if it stays dry" : "Payout zone"}</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  payoff: { marginTop: 14, gap: 8 },
  payoffTrack: { height: 10, borderRadius: 5, backgroundColor: C.mutedSurface, overflow: "hidden" },
  payoffZone: { position: "absolute", top: 0, bottom: 0, backgroundColor: C.payout },
  payoffStrike: { position: "absolute", top: -2, bottom: -2, width: 2, marginLeft: -1, backgroundColor: C.ink },
  payoffAxis: { flexDirection: "row", justifyContent: "space-between" },
  payoffTick: { color: C.quiet, fontFamily: F.bodyMedium, fontSize: 12, fontVariant: ["tabular-nums"] },
  payoffStrikeLabel: { color: C.ink, fontFamily: F.bodySemi },
  payoffLegend: { flexDirection: "row", alignItems: "center", gap: 6 },
  payoffSwatch: { width: 10, height: 10, borderRadius: 2, backgroundColor: C.payout },
  pill: { minHeight: 32, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 7, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontFamily: F.bodySemi, fontSize: 12, letterSpacing: 0.3 },
  action: { minHeight: 48, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", borderRadius: radius.md, paddingHorizontal: 18, backgroundColor: C.rain, overflow: "hidden" },
  actionSecondary: { backgroundColor: C.surfaceRaised, borderWidth: 1, borderColor: glass.border, boxShadow: "none" },
  actionTextSecondary: { color: C.ink },
  actionDisabled: { backgroundColor: C.surfaceRaised, borderWidth: 1, borderColor: C.border, boxShadow: "none" },
  actionPressed: { opacity: 0.84 },
  actionText: { color: C.actionText, fontFamily: F.bodyBold, fontSize: 16, letterSpacing: 0.2 },
  actionTextDisabled: { color: C.quiet },
  screenHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 20 },
  screenHeaderCopy: { flex: 1 },
  screenHeaderAction: { paddingTop: 4 },
  eyebrow: { color: C.muted, fontFamily: F.bodySemi, fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 },
  screenTitle: { color: C.ink, fontFamily: F.headingBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.8 },
  screenDetail: { color: C.muted, fontFamily: F.body, fontSize: 14, lineHeight: 21, marginTop: 8 },
  sectionHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 24, marginBottom: 11 },
  sectionTitle: { color: C.ink, fontFamily: F.heading, fontSize: 19 },
  sectionDetail: { color: C.quiet, fontFamily: F.body, fontSize: 12 },
  insetSurface: { backgroundColor: C.surface, borderColor: C.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16 },
  timeline: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 6 },
  timelineRule: { flex: 1, minWidth: 8, height: StyleSheet.hairlineWidth, backgroundColor: C.border },
  timelineStep: { alignItems: "center", gap: 5 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.quiet },
  timelineDotReady: { backgroundColor: C.mint },
  timelineText: { color: C.quiet, fontFamily: F.bodyMedium, fontSize: 12 },
  timelineTextReady: { color: C.mint },
  disclosure: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14, marginTop: 24 },
  disclosureText: { flex: 1, color: C.quiet, fontFamily: F.body, fontSize: 12, lineHeight: 18 },
  bottomSheet: { backgroundColor: C.surfaceRaised, borderTopColor: C.border, borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18 },
});
