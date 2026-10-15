import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { brandMark } from "../../shared/storm-glass.ts";

/** V1 isometric umbrella — shared geometry/colors with web BrandMark and favicon assets. */
export function BrandMark({ size = 34, tile = true }: { size?: number; tile?: boolean }) {
  const glyph = (
    <Svg width={tile ? size * 0.8 : size} height={tile ? size * 0.8 : size} viewBox={brandMark.viewBox}>
      <Path d="M512 230 L262 520 L387 490Z" fill={brandMark.panel1} />
      <Path d="M512 230 L387 490 L512 520Z" fill={brandMark.panel2} />
      <Path d="M512 230 L512 520 L637 490Z" fill={brandMark.panel3} />
      <Path d="M512 230 L637 490 L762 520Z" fill={brandMark.panel4} />
      <Path d="M512 520 L512 720 Q512 760 472 760" fill="none" stroke={brandMark.handle} strokeWidth={40} strokeLinecap="round" />
      <Circle cx={512} cy={225} r={24} fill={brandMark.tip} />
    </Svg>
  );
  if (!tile) return glyph;
  return (
    <View
      accessibilityLabel="SkyHedge"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: brandMark.tile,
        borderWidth: 1,
        borderColor: brandMark.tileBorder,
        alignItems: "center",
        justifyContent: "center",
        boxShadow: brandMark.tileGlow,
      }}
    >
      {glyph}
    </View>
  );
}
