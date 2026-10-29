import { useRef, useState } from "react";
import { Animated, Easing, Pressable, type PressableProps } from "react-native";
import { lineMotion } from "../../../shared/ui-tokens.ts";
import { useReducedMotion } from "../liquid-glass.tsx";
const NativePressable = Animated.createAnimatedComponent(Pressable);
export function LinePressable({ style, onPressIn, onPressOut, accessibilityRole = "button", ...props }: PressableProps) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (value: number) => {
    scale.stopAnimation();
    if (reduced) { scale.setValue(1); return; }
    if (value === 1) Animated.spring(scale, { toValue: 1, damping: lineMotion.springDamping, stiffness: lineMotion.springStiffness, useNativeDriver: true }).start();
    else Animated.timing(scale, { toValue: value, duration: lineMotion.pressMs, easing: Easing.bezier(.23, 1, .32, 1), useNativeDriver: true }).start();
  };
  return <NativePressable {...props} accessibilityRole={accessibilityRole} style={[typeof style === "function" ? style({ pressed }) : style, { transform: [{ scale }] }]}
    onPressIn={(event) => { setPressed(true); animate(lineMotion.pressScale); onPressIn?.(event); }}
    onPressOut={(event) => { setPressed(false); animate(1); onPressOut?.(event); }} />;
}
