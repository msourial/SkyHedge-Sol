import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { useReducedMotion } from "../liquid-glass.tsx";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { DrawOp } from "../../../shared/ui-instrument.ts";
import { lineTokens } from "../../../shared/ui-tokens.ts";

const FILLS = new Set<string>([lineTokens.rain, lineTokens.snow, lineTokens.wind, lineTokens.heat, lineTokens.cold]);

export function LineArt({ ops, viewBox, width, height, label }: { ops: DrawOp[]; viewBox: string; width: number; height: number; label: string }) {
  const reduced = useReducedMotion();
  const trigger = ops.find((op) => op.op === "line" && op.stroke === lineTokens.slicker);
  const selected = trigger?.op === "line" ? trigger : null;
  const naturalHeight = Number(viewBox.split(" ")[3]);
  const horizontal = Number(viewBox.split(" ")[2]) !== naturalHeight;
  const target = selected ? horizontal ? selected.y1 * height / naturalHeight : Math.atan2(selected.y2 - selected.y1, selected.x2 - selected.x1) * 180 / Math.PI : 0;
  const movement = useRef(new Animated.Value(target)).current;
  useEffect(() => {
    movement.stopAnimation();
    if (reduced) { movement.setValue(target); return; }
    const animation = Animated.timing(movement, { toValue: target, duration: 240, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [target, reduced, movement]);
  const boxWidth = Number(viewBox.split(" ")[2]);
  const center = { x: boxWidth / 2, y: naturalHeight / 2 };
  const radius = selected ? Math.hypot(selected.x1 - center.x, selected.y1 - center.y) : 0;
  const length = selected ? Math.hypot(selected.x2 - selected.x1, selected.y2 - selected.y1) : 0;
  return (
    <View style={{ width, height }} accessible accessibilityRole="image" accessibilityLabel={label}>
    <Svg viewBox={viewBox} width={width} height={height} accessibilityLabel={label}>
      {ops.map((op, index) => {
        if (op === trigger) return null;
        if (op.op === "path") return <Path key={index} d={op.d} stroke={op.stroke} fill={op.fill ?? "none"} strokeWidth={op.sw} strokeLinecap={op.cap} />;
        if (op.op === "rect") return <Rect key={index} x={op.x} y={op.y} width={op.w} height={op.h} rx={op.rx} fill={op.fill && FILLS.has(op.fill) ? op.fill : op.fill ?? "none"} stroke={op.stroke} strokeWidth={op.sw} />;
        if (op.op === "circle") return <Circle key={index} cx={op.cx} cy={op.cy} r={op.r} fill={op.fill ?? "none"} stroke={op.stroke} strokeWidth={op.sw} />;
        if (op.op === "line") return <Line key={index} x1={op.x1} y1={op.y1} x2={op.x2} y2={op.y2} stroke={op.stroke} strokeWidth={op.sw} strokeLinecap={op.cap} />;
        return <SvgText key={index} x={op.x} y={op.y} fill={op.fill} fontSize={op.size} textAnchor={op.anchor}>{op.text}</SvgText>;
      })}
    </Svg>
    {selected ? <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, width, height, transform: horizontal ? [{ translateY: movement }] : [{ rotate: movement.interpolate({ inputRange: [-360, 360], outputRange: ["-360deg", "360deg"] }) }] }}>
      <Svg viewBox={viewBox} width={width} height={height}><Line x1={horizontal ? selected.x1 : center.x + radius} y1={horizontal ? 0 : center.y} x2={horizontal ? selected.x2 : center.x + radius + length} y2={horizontal ? 0 : center.y} stroke={selected.stroke} strokeWidth={selected.sw} strokeLinecap={selected.cap}/></Svg>
    </Animated.View> : null}
    </View>
  );
}
