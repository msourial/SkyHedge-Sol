import { View } from "react-native";
import { CloudRain, Snowflake, Wind, Sun, ThermometerSimple } from "phosphor-react-native";
import { lineTokens as C } from "../../../shared/ui-tokens.ts";
import type { PerilId } from "../../../shared/ui-types.ts";
const glyphs = { rain: CloudRain, snow: Snowflake, wind: Wind, heat: Sun, cold: ThermometerSimple };
const glyphSizes = { 24: 14, 32: 18, 36: 20, 40: 22, 44: 24 } as const;
export function PerilAvatar({ peril, size = 40 }: { peril: PerilId; size?: keyof typeof glyphSizes }) {
  const Glyph = glyphs[peril];
  return <View accessible={false} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.avatarFill[peril], alignItems: "center", justifyContent: "center" }}><Glyph size={glyphSizes[size]} color={C[peril]} weight="bold"/></View>;
}
