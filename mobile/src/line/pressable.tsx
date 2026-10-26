import { useRef, useState } from "react";
import { Animated, Easing, Pressable, type PressableProps } from "react-native";
import { useReducedMotion } from "../liquid-glass.tsx";
const NativePressable = Animated.createAnimatedComponent(Pressable);
export function LinePressable({ style, onPressIn, onPressOut, ...props }: PressableProps) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (value: number) => Animated.timing(scale, { toValue: value, duration: reduced ? 0 : 150, easing: Easing.bezier(.23, 1, .32, 1), useNativeDriver: true }).start();
  return <NativePressable {...props} style={[typeof style === "function" ? style({ pressed }) : style, { transform: [{ scale }] }]}
    onPressIn={(event) => { setPressed(true); animate(props.accessibilityRole === "radio" ? .98 : .96); onPressIn?.(event); }}
    onPressOut={(event) => { setPressed(false); animate(1); onPressOut?.(event); }} />;
}
