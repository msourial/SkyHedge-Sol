import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "./liquid-glass";
import { motion } from "./theme";

/**
 * Pressable with a calm spring press-down (scale to motion.pressScale) and an optional
 * selection "pop" when `selected` flips on. Reduce-motion: no scaling at all.
 */
export function SpringPress({ style, outerStyle, selected, children, ...rest }: Omit<PressableProps, "style" | "children"> & { style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>); outerStyle?: StyleProp<ViewStyle>; selected?: boolean; children?: React.ReactNode }) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  const [pressed, setPressed] = useState(false);
  const to = (v: number) => { if (reduced) return; Animated.spring(scale, { toValue: v, ...motion.spring, useNativeDriver: true }).start(); };
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!selected || reduced) return;
    scale.setValue(0.94);
    Animated.spring(scale, { toValue: 1, damping: 12, stiffness: 300, mass: 0.8, useNativeDriver: true }).start();
  }, [selected, reduced, scale]);
  return <Pressable {...rest} style={outerStyle} onPressIn={(e) => { setPressed(true); to(motion.pressScale); rest.onPressIn?.(e); }} onPressOut={(e) => { setPressed(false); to(1); rest.onPressOut?.(e); }}>
    <Animated.View style={[typeof style === "function" ? style({ pressed }) : style, { transform: [{ scale }] }]}>{children}</Animated.View>
  </Pressable>;
}

/** Fade + short rise on mount, staggered by `index`. Reduce-motion: rendered in place immediately. */
export function Enter({ index = 0, children, style }: { index?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { v.setValue(1); return; }
    const a = Animated.timing(v, { toValue: 1, duration: motion.slow, delay: index * motion.stagger, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [reduced, index, v]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [motion.enterOffset, 0] }) }] }]}>{children}</Animated.View>;
}

/** Progress rail that eases its fill to `progress` (0–1). Reduce-motion: jumps to the value. */
export function ProgressRail({ progress, color, track, height = 4 }: { progress: number; color: string; track: string; height?: number }) {
  const reduced = useReducedMotion();
  const p = Math.max(0, Math.min(1, progress));
  const v = useRef(new Animated.Value(reduced ? p : 0)).current;
  useEffect(() => {
    if (reduced) { v.setValue(p); return; }
    const a = Animated.timing(v, { toValue: p, duration: motion.progress, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [p, reduced, v]);
  return <Animated.View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: "hidden" }}>
    <Animated.View style={{ height, borderRadius: height / 2, backgroundColor: color, width: v.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
  </Animated.View>;
}
