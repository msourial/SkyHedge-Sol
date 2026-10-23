import { LinearGradient } from "expo-linear-gradient";
import type { StyleProp, ViewStyle } from "react-native";
import { canvasFadeColor, fadeBandAlphas, SCROLL_FADE_HEIGHT } from "./scroll-fade";

/** iOS native gradient and web CSS gradient. Android uses scroll-edge-fade.android.tsx. */
export function ScrollEdgeFade({ style }: { style?: StyleProp<ViewStyle> }) {
  const alphas = fadeBandAlphas();
  const colors = alphas.map((alpha) => canvasFadeColor(alpha)) as unknown as readonly [string, string, ...string[]];
  const locations = alphas.map((_, index) => index / (alphas.length - 1)) as unknown as readonly [number, number, ...number[]];
  return (
    <LinearGradient
      pointerEvents="none"
      testID="protect-scroll-fade-gradient"
      colors={colors}
      locations={locations}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[{ height: SCROLL_FADE_HEIGHT }, style]}
    />
  );
}
