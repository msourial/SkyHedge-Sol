import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { BlurTargetView, BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewProps, type ViewStyle, View } from "react-native";
import { liquidGlassRecipe } from "./liquid-glass-config";

export const GlassTargetContext = createContext<React.RefObject<View | null> | null>(null);

export function GlassBackdrop({ children }: { children: React.ReactNode }) {
  const targetRef = useRef<View>(null);
  return <GlassTargetContext.Provider value={targetRef}>
    <BlurTargetView ref={targetRef} pointerEvents="none" style={styles.backdrop}>
      <LinearGradient colors={["#10192B", "#080B14", "#15122A"]} locations={[0, 0.48, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    </BlurTargetView>
    {children}
  </GlassTargetContext.Provider>;
}

export function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion).catch(() => setReducedMotion(false));
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => subscription.remove();
  }, []);
  return reducedMotion;
}

type LiquidGlassSurfaceProps = ViewProps & {
  blurRadius?: number;
  alpha?: number;
  strokeWidth?: number;
  radius?: number;
  contentStyle?: StyleProp<ViewStyle>;
};

export function LiquidGlassSurface({ children, style, contentStyle, blurRadius = 18, alpha = 0.4, strokeWidth = 1, radius = 18, ...props }: LiquidGlassSurfaceProps) {
  const { usesNativeBlur } = liquidGlassRecipe(Number(Platform.Version), false);
  const blurTarget = useContext(GlassTargetContext);
  return <View {...props} style={[styles.surface, { borderRadius: radius }, style]}>
    {usesNativeBlur && blurTarget ? <BlurView pointerEvents="none" blurTarget={blurTarget} tint="dark" intensity={Math.min(100, Math.max(1, Math.round(blurRadius * 3)))} blurReductionFactor={4} blurMethod="dimezisBlurViewSdk31Plus" style={StyleSheet.absoluteFill} /> : null}
    <LinearGradient pointerEvents="none" colors={["rgba(246,248,252,0.28)", "rgba(112,214,255,0.12)", "rgba(246,248,252,0.03)"]} locations={[0, 0.45, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radius }]} />
    <View style={[styles.content, { margin: strokeWidth, borderRadius: Math.max(0, radius - strokeWidth), backgroundColor: `rgba(16,20,29,${alpha})` }, contentStyle]}>{children}</View>
  </View>;
}

export function AmbientGlassAura({ style }: { style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotion();
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) {
      drift.stopAnimation();
      drift.setValue(0);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 7_500, useNativeDriver: true, isInteraction: false }),
      Animated.timing(drift, { toValue: 0, duration: 7_500, useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [drift, reducedMotion]);
  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [-16, 16] });
  return <View pointerEvents="none" style={[styles.aura, style]}>
    <Animated.View style={[styles.auraOrb, { transform: [{ translateX }] }]}><LinearGradient colors={["rgba(112,214,255,0.3)", "rgba(155,140,255,0.03)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /></Animated.View>
  </View>;
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

const styles = StyleSheet.create({
  backdrop: { position: "absolute", inset: 0 },
  surface: { overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.32, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  content: { overflow: "hidden" },
  aura: { overflow: "hidden" },
  auraOrb: { position: "absolute", width: 230, height: 140, right: -72, top: -56, borderRadius: 120, overflow: "hidden" },
});
