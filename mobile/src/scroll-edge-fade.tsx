import { LinearGradient } from "expo-linear-gradient";
import type { StyleProp, ViewStyle } from "react-native";
import { canvasFadeColor, SCROLL_FADE_HEIGHT } from "./scroll-fade";
import { C } from "../../shared/storm-glass.ts";

/** iOS native gradient and web CSS gradient. Android uses scroll-edge-fade.android.tsx. */
export function ScrollEdgeFade({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient
      pointerEvents="none"
      testID="protect-scroll-fade-gradient"
      colors={[canvasFadeColor(0), C.canvas]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[{ height: SCROLL_FADE_HEIGHT }, style]}
    />
  );
}
