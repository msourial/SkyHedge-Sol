import React, { createContext, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, type PressableProps, type StyleProp, type ViewStyle, type View } from "react-native";

export const GlassTargetContext = createContext<React.RefObject<View | null> | null>(null);

export function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion).catch(() => setReducedMotion(false));
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => subscription.remove();
  }, []);
  return reducedMotion;
}

export function TactilePressable({ children, containerStyle, onPressIn, onPressOut, ...props }: PressableProps & { containerStyle?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const animateScale = (toValue: number) => {
    if (reducedMotion) return;
    Animated.spring(scale, { toValue, tension: 120, friction: 14, useNativeDriver: true }).start();
  };
  return <Animated.View style={[{ transform: [{ scale }] }, containerStyle]}>
    <Pressable
      {...props}
      onPressIn={(event) => { onPressIn?.(event); animateScale(0.985); }}
      onPressOut={(event) => { onPressOut?.(event); animateScale(1); }}
    >
      {children}
    </Pressable>
  </Animated.View>;
}

export function ScreenTransition({ transitionKey, children }: { transitionKey: string; children: React.ReactNode }) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    opacity.stopAnimation();
    translateY.stopAnimation();
    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    opacity.setValue(0);
    translateY.setValue(10);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [opacity, reducedMotion, transitionKey, translateY]);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

