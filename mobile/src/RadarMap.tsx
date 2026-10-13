import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Stop, Text as SvgText } from "react-native-svg";
import { GLOBAL_GRATICULE, GLOBAL_LAND, GLOBAL_VIEW, REGION_GRATICULE, REGION_LAKES, REGION_LAND, REGION_VIEW } from "./geo-paths";
import { MARKETS, type CatalogMarket } from "./markets-catalog";
import { C, F } from "./theme";
import { Text } from "./ui";
import { useReducedMotion } from "./liquid-glass";

export type MapScope = "region" | "global";

const tone = (m: CatalogMarket) => (m.status === "live" ? C.mint : m.status === "soon" ? C.amber : C.rain);

/** Crop of the region projection centred on a focus market, kept inside the projected extent. */
function regionWindow(focus: CatalogMarket | undefined) {
  const w = 600, h = 400;
  const [fx, fy] = focus && focus.group === "North America" ? focus.regionXY : [560, 300];
  const x = Math.min(REGION_VIEW.width - w, Math.max(0, fx - w / 2));
  const y = Math.min(REGION_VIEW.height - h, Math.max(0, fy - h / 2));
  return { x, y, w, h };
}

type Label = { x: number; y: number; anchor: "start" | "end"; size: number; text: string };
/** Greedy label placement: important markets first; each label tries 4 slots around its pin and is dropped (concepts only) if all collide or leave the map. */
export function placeLabels(pins: readonly CatalogMarket[], isRegion: boolean, highlight: ReadonlySet<string>, k: number, win: { x: number; y: number; w: number; h: number }): Map<string, Label> {
  const pri = (m: CatalogMarket) => (m.status === "live" ? 0 : highlight.has(m.code) ? 1 : m.status === "soon" ? 2 : m.status === "ready" ? 3 : 4);
  const boxes: Array<[number, number, number, number]> = pins.map((m) => { const [x, y] = isRegion ? m.regionXY : m.globalXY; const r = 5 * k; return [x - r, y - r, x + r, y + r]; });
  const out = new Map<string, Label>();
  for (const m of [...pins].sort((a, b) => pri(a) - pri(b))) {
    const main = m.status !== "concept";
    const hit = highlight.has(m.code);
    if (!(isRegion || hit || m.status === "live")) continue;
    const text = isRegion ? (main ? m.short : m.code) : (main || hit ? m.short : m.code);
    const size = (main ? 10 : 8.5) * k;
    const w = text.length * size * 0.62, h = size;
    const [px, py] = isRegion ? m.regionXY : m.globalXY;
    const g = 6 * k;
    const slots: Array<[number, number, "start" | "end"]> = [[px + g, py - 5 * k, "start"], [px + g, py + h + 2 * k, "start"], [px - g, py - 5 * k, "end"], [px - g, py + h + 2 * k, "end"]];
    let placed = false;
    for (const [x, y, anchor] of slots) {
      const x0 = anchor === "start" ? x : x - w, b: [number, number, number, number] = [x0, y - h, x0 + w, y + 2 * k];
      if (b[0] < win.x + 2 || b[2] > win.x + win.w - 2 || b[1] < win.y + 2 || b[3] > win.y + win.h - 2) continue;
      if (boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue;
      boxes.push(b); out.set(m.code, { x, y, anchor, size, text }); placed = true; break;
    }
    if (!placed && main) { const [x, y, anchor] = slots[0]; out.set(m.code, { x, y, anchor, size, text }); }
  }
  return out;
}

export function RadarMap(props: {
  scope: MapScope;
  onScope: (scope: MapScope) => void;
  focusCode: string;
  highlight: ReadonlySet<string>;
  onSelect: (m: CatalogMarket) => void;
}) {
  const reduced = useReducedMotion();
  const sweep = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) { sweep.setValue(0.12); pulse.setValue(0.5); return; }
    const a = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 4200, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
    const b = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true, isInteraction: false }));
    a.start(); b.start();
    return () => { a.stop(); b.stop(); };
  }, [reduced, sweep, pulse]);

  const focus = MARKETS.find((m) => m.code === props.focusCode) ?? MARKETS[0];
  const isRegion = props.scope === "region";
  const win = isRegion ? regionWindow(focus) : { x: 90, y: 40, w: 840, h: 400 };
  const k = win.w / 360; // ≈1 unit per dp on a phone-width map, so strokes/labels stay legible
  const pins = useMemo(() => MARKETS.filter((m) => {
    if (!isRegion) return true;
    const [x, y] = m.regionXY;
    return m.group === "North America" && x >= win.x - 10 && x <= win.x + win.w + 10 && y >= win.y - 10 && y <= win.y + win.h + 10;
  }), [isRegion, win.x, win.y, win.w, win.h]);
  const [fx, fy] = isRegion ? focus.regionXY : focus.globalXY;
  const fPct = { left: ((fx - win.x) / win.w) * 100, top: ((fy - win.y) / win.h) * 100 };
  const pulseS = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 3] });
  const pulseO = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] });
  const rotate = sweep.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const fc = tone(focus);
  const ring = isRegion ? k : k * 0.45; // world view: tighter radar so it does not swamp the continent
  const hidden = MARKETS.length - pins.length;
  const labels = useMemo(() => placeLabels(pins, isRegion, props.highlight, k, win), [pins, isRegion, props.highlight, k, win.x, win.y, win.w, win.h]);

  return <View style={s.wrap}>
    <View style={[s.map, { aspectRatio: win.w / win.h }]} accessible accessibilityLabel={`${isRegion ? "Regional" : "Global"} radar map centred on ${focus.name}. ${pins.length} markets shown.`}>
      <View style={StyleSheet.absoluteFill} renderToHardwareTextureAndroid needsOffscreenAlphaCompositing={false}>
      <Svg width="100%" height="100%" viewBox={`${win.x} ${win.y} ${win.w} ${win.h}`}>
        <Defs>
          <LinearGradient id="land" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#5EC8FF" stopOpacity="0.12" />
            <Stop offset="1" stopColor="#5EC8FF" stopOpacity="0.04" />
          </LinearGradient>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={fc} stopOpacity="0.28" />
            <Stop offset="1" stopColor={fc} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Path d={isRegion ? REGION_GRATICULE : GLOBAL_GRATICULE} stroke="rgba(255,255,255,0.06)" strokeWidth={1 * k} strokeDasharray={`${3 * k} ${4 * k}`} fill="none" />
        <Path d={isRegion ? REGION_LAND : GLOBAL_LAND} fill="none" stroke="rgba(94,200,255,0.10)" strokeWidth={5 * k} strokeLinejoin="round" />
        <Path d={isRegion ? REGION_LAND : GLOBAL_LAND} fill="url(#land)" stroke="rgba(120,210,255,0.55)" strokeWidth={1 * k} strokeLinejoin="round" />
        {isRegion ? <Path d={REGION_LAKES} fill="#0B0F14" stroke="rgba(94,200,255,0.22)" strokeWidth={0.8 * k} /> : null}
        <Circle cx={fx} cy={fy} r={60 * ring} fill="url(#glow)" />
        {[22, 44, 66].map((r) => <Circle key={r} cx={fx} cy={fy} r={r * ring} fill="none" stroke={fc} strokeOpacity={0.18} strokeWidth={1 * k} />)}
        <Line x1={fx - 75 * ring} y1={fy} x2={fx + 75 * ring} y2={fy} stroke={fc} strokeOpacity={0.12} strokeWidth={k} />
        <Line x1={fx} y1={fy - 75 * ring} x2={fx} y2={fy + 75 * ring} stroke={fc} strokeOpacity={0.12} strokeWidth={k} />
        {pins.map((m) => {
          const [x, y] = isRegion ? m.regionXY : m.globalXY;
          const hit = props.highlight.has(m.code);
          const col = tone(m);
          const main = m.status === "live" || m.status === "soon" || m.status === "ready";
          const r = (main ? 4.5 : hit ? 3.8 : 2.8) * k;
          return <G key={m.code} onPress={() => props.onSelect(m)}>
            <Circle cx={x} cy={y} r={12 * k} fill="transparent" />
            {hit ? <Circle cx={x} cy={y} r={7 * k} fill={col} fillOpacity={0.18} stroke={col} strokeOpacity={0.6} strokeWidth={k} /> : null}
            <Circle cx={x} cy={y} r={r} fill={m.status === "concept" ? C.canvas : col} stroke={col} strokeWidth={(m.status === "concept" ? 1.6 : 1) * k} />
            {labels.has(m.code) ? (() => { const L = labels.get(m.code)!; return <SvgText x={L.x} y={L.y} textAnchor={L.anchor} fill={main || hit ? C.ink : "rgba(200,220,235,0.7)"} fontSize={L.size} fontWeight={main || hit ? "700" : "500"} fontFamily={F.mono}>{L.text}</SvgText>; })() : null}
          </G>;
        })}
      </Svg>
      </View>
      <View pointerEvents="none" style={[s.sweepHost, { left: `${fPct.left}%`, top: `${fPct.top}%` }]}>
        <Animated.View renderToHardwareTextureAndroid style={[s.pulse, { borderColor: fc, opacity: pulseO, transform: [{ scale: pulseS }] }]} />
        <Animated.View renderToHardwareTextureAndroid style={[s.sweep, { transform: [{ scale: isRegion ? 1 : 0.5 }, { rotate }] }]}>
          <Svg width={260} height={260} viewBox="-130 -130 260 260">
            <Defs>
              <RadialGradient id="sw" cx="0" cy="0" r="130" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={fc} stopOpacity="0.5" />
                <Stop offset="1" stopColor={fc} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Path d="M0,0 L130,0 A130,130 0 0,0 112.6,-65 Z" fill="url(#sw)" />
            <Line x1={0} y1={0} x2={130} y2={0} stroke={fc} strokeOpacity={0.9} strokeWidth={1.5} />
          </Svg>
        </Animated.View>
      </View>
      <View style={s.toggle} accessibilityRole="tablist">
        {(["region", "global"] as const).map((v) => <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: props.scope === v }} onPress={() => props.onScope(v)} style={[s.toggleBtn, props.scope === v && s.toggleOn]} hitSlop={6}>
          <Text style={[s.toggleText, props.scope === v && { color: C.rain }]}>{v === "region" ? "Region" : "Global"}</Text>
        </Pressable>)}
      </View>
      <Text style={s.proj}>{isRegion ? "LCC · 35°/55° N" : "Equal Earth"}{hidden && isRegion ? ` · +${hidden} off-map` : ""}</Text>
      <View style={s.legend} pointerEvents="none">
        <View style={[s.lDot, { backgroundColor: C.mint }]} /><Text style={s.lText}>Live</Text>
        <View style={[s.lDot, { backgroundColor: C.rain }]} /><Text style={s.lText}>Ready</Text>
        <View style={[s.lDot, { backgroundColor: C.amber }]} /><Text style={s.lText}>Soon</Text>
        <View style={[s.lDot, s.lHollow]} /><Text style={s.lText}>Concept</Text>
      </View>
    </View>
  </View>;
}

const s = StyleSheet.create({
  wrap: { borderRadius: 20, borderWidth: 1, borderColor: "rgba(94,200,255,0.22)", backgroundColor: "#0A1119", overflow: "hidden", marginBottom: 14, boxShadow: "0px 0px 30px rgba(94,200,255,0.10), 0px 10px 28px rgba(0,0,0,0.5)" },
  map: { width: "100%", overflow: "hidden" },
  sweepHost: { position: "absolute", width: 0, height: 0 },
  pulse: { position: "absolute", left: -12, top: -12, width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  sweep: { position: "absolute", left: -130, top: -130, width: 260, height: 260 },
  toggle: { position: "absolute", top: 10, right: 10, flexDirection: "row", backgroundColor: "rgba(17,22,29,0.85)", borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 3 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9 },
  toggleOn: { backgroundColor: "rgba(94,200,255,0.18)", boxShadow: "0px 0px 10px rgba(94,200,255,0.35)" },
  toggleText: { color: C.muted, fontFamily: F.bodySemi, fontSize: 12 },
  proj: { position: "absolute", left: 12, top: 14, color: C.quiet, fontFamily: F.mono, fontSize: 10 },
  legend: { position: "absolute", right: 10, bottom: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(11,15,20,0.8)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  lDot: { width: 7, height: 7, borderRadius: 4, marginLeft: 4 },
  lHollow: { borderWidth: 1.5, borderColor: C.rain, backgroundColor: "transparent" },
  lText: { color: C.muted, fontFamily: F.bodyMedium, fontSize: 10 },
});
