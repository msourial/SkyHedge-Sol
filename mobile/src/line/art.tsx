import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useReducedMotion } from "../liquid-glass.tsx";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { DrawOp } from "../../../shared/ui-instrument.ts";
import { lineTokens } from "../../../shared/ui-tokens.ts";
import { F } from "../theme.ts";

const FILLS = new Set<string>([lineTokens.rain, lineTokens.snow, lineTokens.wind, lineTokens.heat, lineTokens.cold]);

export function LineArt({ ops, viewBox, width, height, label }: { ops: DrawOp[]; viewBox: string; width: number; height: number; label: string }) {
  const reduced = useReducedMotion();
  const trigger = ops.find((op) => op.op === "line" && op.stroke === lineTokens.slicker);
  const selected = trigger?.op === "line" ? trigger : null;
  const cap = ops.find((op) => op.op === "rect" && op.fill === lineTokens.slicker);
  const radial = viewBox.startsWith("-16");
  const naturalHeight = Number(viewBox.split(" ")[3]);
  const scale = height / naturalHeight;
  // Wind rotates around its real dial centre (44,68); all other perils slide.
  const target = selected ? radial ? Math.atan2(selected.y2 - 68, selected.x2 - 44) * 180 / Math.PI : selected.y1 * scale : 0;
  const movement = useRef(new Animated.Value(target)).current;
  const fill = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.timing(movement, { toValue: target, duration: reduced ? 0 : 240, easing: Easing.bezier(.23, 1, .32, 1), useNativeDriver: true });
    a.start(); return () => a.stop();
  }, [target, reduced, movement]);
  const fills = ops.filter((op) => (op.op === "rect" || op.op === "circle") && op.fill && FILLS.has(op.fill));
  const fillKey = JSON.stringify(fills);
  useEffect(() => {
    fill.setValue(reduced ? 1 : 0);
    const a = Animated.timing(fill, { toValue: 1, duration: reduced ? 0 : 640, easing: Easing.bezier(.23, 1, .32, 1), useNativeDriver: true });
    a.start(); return () => a.stop();
  }, [fillKey, reduced, fill]);
  return <View style={{ width, height }} accessible accessibilityRole="image" accessibilityLabel={label}>
    {fills.length ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ translateY: 133 * scale - height / 2 }, { scaleY: fill }, { translateY: -(133 * scale - height / 2) }] }]}><Svg viewBox={viewBox} width={width} height={height}>{fills.map(draw)}</Svg></Animated.View> : null}
    <Svg viewBox={viewBox} width={width} height={height}>{ops.filter((op) => op !== trigger && op !== cap && !fills.includes(op)).map(draw)}</Svg>
    {selected ? radial ? <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, width, height: 136 * scale, transform: [{ rotate: movement.interpolate({ inputRange: [-360, 360], outputRange: ["-360deg", "360deg"] }) }] }}><Svg viewBox="-16 0 120 136" width={width} height={136 * scale}><Line x1={82} y1={68} x2={94} y2={68} stroke={selected.stroke} strokeWidth={selected.sw} /></Svg></Animated.View> : <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ translateY: movement }] }]}>
      <View style={{ position: "absolute", left: selected.x1 * scale, top: -selected.sw * scale / 2, width: (selected.x2 - selected.x1) * scale, height: selected.sw * scale, backgroundColor: selected.stroke }} />
      {cap?.op === "rect" ? <View style={{ position: "absolute", left: cap.x * scale, top: -3 * scale, width: cap.w * scale, height: cap.h * scale, backgroundColor: cap.fill }} /> : null}
    </Animated.View> : null}
  </View>;
}
function draw(op: DrawOp, index: number) {
  if (op.op === "path") return <Path key={index} d={op.d} stroke={op.stroke} fill={op.fill ?? "none"} strokeWidth={op.sw} strokeLinecap={op.cap} />;
  if (op.op === "rect") return <Rect key={index} x={op.x} y={op.y} width={op.w} height={op.h} rx={op.rx} fill={op.fill ?? "none"} stroke={op.stroke} strokeWidth={op.sw} />;
  if (op.op === "circle") return <Circle key={index} cx={op.cx} cy={op.cy} r={op.r} fill={op.fill ?? "none"} stroke={op.stroke} strokeWidth={op.sw} />;
  if (op.op === "line") return <Line key={index} x1={op.x1} y1={op.y1} x2={op.x2} y2={op.y2} stroke={op.stroke} strokeWidth={op.sw} strokeLinecap={op.cap} />;
  return <SvgText key={index} x={op.x} y={op.y} fill={op.fill} fontFamily={F.bodyMedium} fontSize={op.size} textAnchor={op.anchor}>{op.text}</SvgText>;
}
