import React from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

/** V1 isometric umbrella (source: assets/brand/icon-v1.svg), drawn natively so it stays crisp at any size. */
export function BrandMark({ size = 34, tile = true }: { size?: number; tile?: boolean }) {
  const glyph = <Svg width={tile ? size * 0.8 : size} height={tile ? size * 0.8 : size} viewBox="236 190 552 590">
    <Path d="M512 230 L262 520 L387 490Z" fill="#7BC3F0" />
    <Path d="M512 230 L387 490 L512 520Z" fill="#9FD5F5" />
    <Path d="M512 230 L512 520 L637 490Z" fill="#4F96D6" />
    <Path d="M512 230 L637 490 L762 520Z" fill="#3A78B5" />
    <Path d="M512 520 L512 720 Q512 760 472 760" fill="none" stroke="#7BC3F0" strokeWidth={40} strokeLinecap="round" />
    <Circle cx={512} cy={225} r={24} fill="#F5B342" />
  </Svg>;
  if (!tile) return glyph;
  return <View accessibilityLabel="SkyHedge" style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: "#12151A", borderWidth: 1, borderColor: "rgba(123,195,240,0.35)", alignItems: "center", justifyContent: "center", boxShadow: "0px 0px 14px rgba(94,200,255,0.35)" }}>{glyph}</View>;
}
