import { View, type StyleProp, type ViewStyle } from "react-native";
import { canvasFadeColor, fadeBandAlphas, SCROLL_FADE_HEIGHT } from "./scroll-fade";

/**
 * Native Android fade. Each band is a real view with its own background alpha.
 * The parent pins this view so its bottom edge is the pay panel's top.
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
