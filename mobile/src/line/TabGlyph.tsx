import Svg, { Path, Rect } from "react-native-svg";
import { lineTokens } from "../../../shared/ui-tokens.ts";
/** Filled navigation silhouettes from the approved mock. */
export function TabGlyph({ name, color, size = 24 }: { size?: number; name: "markets" | "protect" | "wallet"; color: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
    {name === "markets" ? <><Rect x={4} y={11} width={4} height={9} rx={2} fill={color}/><Rect x={10} y={5} width={4} height={15} rx={2} fill={color}/><Rect x={16} y={8} width={4} height={12} rx={2} fill={color}/></> : name === "protect" ? <Path d="M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6z" fill={color}/> : <><Rect x={3} y={6} width={18} height={14} rx={4} fill={color}/><Rect x={14} y={11} width={7} height={4} rx={2} fill={lineTokens.bg}/></>}
  </Svg>;
}
