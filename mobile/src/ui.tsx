import React, { useEffect, useRef } from "react";
import Feather from "@expo/vector-icons/Feather";
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text as NativeText, type TextProps, View } from "react-native";
import { C, F } from "./theme";

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

export function ActionButton({ label, onPress, disabled = false, busy = false, icon }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  icon?: AppIconName;
}) {
  return (
    <Pressable
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
    </Pressable>
  );
}

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
});
