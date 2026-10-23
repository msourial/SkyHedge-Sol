import { View, type StyleProp, type ViewStyle } from "react-native";
import { canvasFadeColor, fadeBandAlphas, SCROLL_FADE_HEIGHT } from "./scroll-fade";

/**
 * Native Android fade. Each band is a real view with its own background alpha,
 * drawn above the scroll view. A transparent gradient shader stayed under the
 * scroll content on the Seeker, so the card met a hard edge.
 */
export function ScrollEdgeFade({ style }: { style?: StyleProp<ViewStyle> }) {
  const alphas = fadeBandAlphas();
  const bandHeight = SCROLL_FADE_HEIGHT / alphas.length;
  return (
    <View pointerEvents="none" collapsable={false} testID="protect-scroll-fade-bands" style={[{ height: SCROLL_FADE_HEIGHT }, style]}>
      {alphas.map((alpha, index) => (
        <View key={index} style={{ height: bandHeight, backgroundColor: canvasFadeColor(alpha) }} />
      ))}
    </View>
  );
}
