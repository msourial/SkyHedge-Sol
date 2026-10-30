import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import { lineMotion, lineTokens as C } from "../../../shared/ui-tokens.ts";
import { payoffPlot, payoffChartMaximum, payoffAnnotationBoxes, payoffGeometry, payoffLabelBoxes, sparkHeights, splitProportion, type PayoffDomain } from "../../../shared/ui-payoff.ts";
import type { PayoffModel } from "../../../shared/ui-view.ts";
import type { PerilId } from "../../../shared/ui-types.ts";
import { useReducedMotion } from "../liquid-glass.tsx";

// SVG exposes OpenType features natively; its web renderer requires the CSS form.
const features = '"tnum" 1, "cv11" 1';
const svgType: ViewStyle & { fontFeatureSettings?: string } = Platform.OS === "web" ? { fontFeatureSettings: features } : {};

/** One clock drives geometry and count-up labels, including interrupted transitions. */
export function usePayoutTween(target: number[], pressDelay = 150, duration = lineMotion.fillMs as number) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const current = useRef(target);
  const [frame, setFrame] = useState(target);
  const [previous, setPrevious] = useState<number[] | null>(null);
  const key = target.join("/");
  useEffect(() => {
    const from = current.current;
    if (from.every((v, i) => v === target[i])) return;
    progress.stopAnimation(); opacity.stopAnimation();
    if (reduced) {
      setPrevious(from); current.current = target; setFrame(target); opacity.setValue(0);
      const fade = Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }); fade.start(({ finished }) => { if (finished) setPrevious(null); }); return () => fade.stop();
    }
    setPrevious(null); opacity.setValue(1); progress.setValue(0);
    const listener = progress.addListener(({ value }) => { const next = target.map((v, i) => from[i] + (v - from[i]) * value); current.current = next; setFrame(next); });
    const animation = Animated.timing(progress, { toValue: 1, delay: pressDelay, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => { animation.stop(); progress.removeListener(listener); };
  // A numeric key prevents unrelated renders from restarting the shared clock.
  }, [key, reduced, progress, opacity, pressDelay, duration]);
  return { frame, previous, opacity };
}
export function PayoffChart({ diagram: d, trigger, unit, peril, highLabel, dim = false }: { diagram: PayoffModel; trigger: number; unit: string; peril: PerilId; highLabel: string; dim?: boolean }) {
  const maximum = payoffChartMaximum(trigger, d.maximum, d.openTriggers);
  const geometry = payoffGeometry(trigger, maximum, Number(d.lossBase) / 1e6, Number(d.gainBase) / 1e6, d.domain);
  const { frame, previous, opacity } = usePayoutTween([geometry.x, geometry.zero, geometry.lossY, geometry.gainY, Number(d.lossBase) / 1e6, Number(d.gainBase) / 1e6, trigger]);
  const label = (title: string, amount: string, box: ReturnType<typeof payoffAnnotationBoxes>["gain"], color: string) => <View style={{ position: "absolute", top: box.top, left: `${box.left / 329 * 100}%`, width: `${(box.right - box.left) / 329 * 100}%`, height: box.bottom - box.top }}><Text numberOfLines={1} style={{ fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 16, color: C.fg2, textAlign: "right" }}>{title}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.5} style={{ fontFamily: "Inter_650", fontVariant: ["tabular-nums"], fontSize: 15, lineHeight: 20, color, textAlign: "right" }}>{amount}</Text></View>;
  const draw = ([x, zero, lossY, gainY, loss, gain]: number[], hidden = false) => {
    // Use the displayed trigger for deduplication while its line animates between strikes.
    const labels = payoffLabelBoxes(trigger, maximum, d.openTriggers, unit, highLabel, d.maximum);
    const annotations = payoffAnnotationBoxes();
    // A single native Text run avoids Android SVG positioning each JSX text child separately.
    const selectedLabel = labels.selected.label;
    return <View><Svg style={[svgType, { marginTop: payoffPlot.annotationHeight }]} width="100%" height={180} viewBox="0 0 329 180" preserveAspectRatio="none" accessible={!hidden} accessibilityRole="image" accessibilityLabel={hidden ? undefined : `${d.description}. Square-root horizontal scale, 0 to ${maximum} ${unit}. Vertical scale fixed across open strikes for this cover size.`}>
    <Rect x={0} y={zero} width={x} height={Math.max(0, lossY - zero)} fill={C.avatarFill.heat} opacity={dim ? .5 : 1}/>
    <Rect x={x} y={gainY} width={329 - x} height={Math.max(0, zero - gainY)} fill={C.avatarFill[peril]} opacity={dim ? .5 : 1}/>
    <Rect x={0} y={lossY - 3} width={x} height={3} fill={C.heat} opacity={dim ? .5 : 1}/>
    <Rect x={x} y={gainY} width={329 - x} height={3} fill={C[peril]} opacity={dim ? .5 : 1}/>
    <Rect x={0} y={zero - .5} width={329} height={1} fill={C.fg2} opacity={.35}/>
    {[...new Set(d.openTriggers)].filter(t => t !== trigger).map(t => <Rect key={t} x={Math.sqrt(Math.max(0, Math.min(1, t / maximum))) * 329 - 1} y={124} width={2} height={12} rx={1} fill={C.fg2}/>)}
    <Rect x={x - 1.5} y={2} width={3} height={134} rx={1.5} fill={C.slicker}/>
    {labels.ticks.map(t => <SvgText fontFeatureSettings={features} key={t.label} x={(t.left + t.right) / 2} y={t.y} textAnchor="middle" fontFamily="Inter_400Regular" fontSize={13} fill={C.dryText}>{t.label}</SvgText>)}
    {labels.high.label ? <SvgText fontFeatureSettings={features} x={labels.high.right} y={labels.high.y} textAnchor="end" fontFamily="Inter_400Regular" fontSize={13} fill={C.dryText}>{labels.high.label}</SvgText> : null}
  </Svg>{label("Max gain", `+${gain.toFixed(2)}`, annotations.gain, C.glacier)}{label("Max loss", `−${loss.toFixed(2)}`, annotations.loss, C.heat)}<Text numberOfLines={1} style={{ position: "absolute", top: payoffPlot.annotationHeight + labels.selected.top, left: `${labels.selected.left / 329 * 100}%`, width: `${(labels.selected.right - labels.selected.left) / 329 * 100}%`, fontFamily: "Inter_650", fontVariant: ["tabular-nums"], fontSize: 13, lineHeight: 18, color: C.fg, textAlign: "center" }}>{selectedLabel}</Text></View>;
  };
  return <View style={{ marginTop: 10 }}><Animated.View style={{ opacity }}>{draw(frame)}</Animated.View>{previous ? <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { opacity: opacity.interpolate({ inputRange: [0,1], outputRange: [1,0] }) }]}>{draw(previous, true)}</Animated.View> : null}</View>;
}
export function SplitBar({ loss, gain }: PayoffDomain) {
  const { frame: [fraction], previous, opacity } = usePayoutTween([splitProportion(loss, gain)], 0);
  const draw = (f: number) => <View style={{ height: 12, flexDirection: "row", gap: f > 0 && f < 1 ? 3 : 0 }}><View style={{ width: `${f * 100}%`, borderRadius: 6, backgroundColor: C.heat }}/><View style={{ flex: 1, borderRadius: 6, backgroundColor: C.glacier }}/></View>;
  return <View accessibilityRole="image" accessibilityLabel={`Max loss ${loss.toFixed(2)}, max gain ${gain.toFixed(2)} SKYT`} style={{ marginTop: 18 }}><Animated.View style={{ opacity }}>{draw(fraction)}</Animated.View>{previous ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: opacity.interpolate({ inputRange: [0,1], outputRange: [1,0] }) }]}>{draw(previous[0])}</Animated.View> : null}</View>;
}
export function CoverSparkline({ loss, gain, domain, peril, state = "open", available = true }: PayoffDomain & { domain: PayoffDomain; peril: PerilId; state?: string; available?: boolean }) {
  if (!available) return <Svg width={56} height={24} accessible={false}/>;
  const h = sparkHeights(loss, gain, domain);
  const settled = state !== "open" && state !== "pending";
  return <Svg width={56} height={24} viewBox="0 0 56 24" accessible={false}>{!settled ? <><Rect x={0} y={14} width={20} height={h.loss} fill={C.heat} opacity={.38}/><Rect x={0} y={14 + h.loss - 2} width={20} height={2} fill={C.heat}/><Rect x={20} y={14 - h.gain} width={36} height={h.gain} fill={C[peril]} opacity={.3}/><Rect x={20} y={14 - h.gain} width={36} height={2} fill={C[peril]}/><Rect x={19} y={0} width={2.5} height={24} rx={1.25} fill={C.slicker}/></> : state === "refunded" ? <Rect x={0} y={13} width={56} height={2} fill={C.fg2}/> : state === "unknown" ? null : <><Rect x={0} y={state === "paid" ? 14 - h.gain : 14} width={56} height={state === "paid" ? h.gain : h.loss} fill={state === "paid" ? C[peril] : C.heat} opacity={.38}/><Rect x={0} y={state === "paid" ? 14 - h.gain : 12 + h.loss} width={56} height={2} fill={state === "paid" ? C[peril] : C.heat}/></>}</Svg>;
}
