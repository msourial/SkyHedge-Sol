import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Stop, Text as SvgText } from "react-native-svg";
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

  return <View style={s.wrap}>
    <View style={[s.map, { aspectRatio: win.w / win.h }]} accessible accessibilityLabel={`${isRegion ? "Regional" : "Global"} radar map centred on ${focus.name}. ${pins.length} markets shown.`}>
      <View style={StyleSheet.absoluteFill} renderToHardwareTextureAndroid needsOffscreenAlphaCompositing={false}>
      <Svg width="100%" height="100%" viewBox={`${win.x} ${win.y} ${win.w} ${win.h}`}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={fc} stopOpacity="0.28" />
            <Stop offset="1" stopColor={fc} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Path d={isRegion ? REGION_GRATICULE : GLOBAL_GRATICULE} stroke="rgba(255,255,255,0.06)" strokeWidth={1 * k} strokeDasharray={`${3 * k} ${4 * k}`} fill="none" />
        <Path d={isRegion ? REGION_LAND : GLOBAL_LAND} fill="rgba(94,200,255,0.06)" stroke="rgba(94,200,255,0.32)" strokeWidth={1.1 * k} strokeLinejoin="round" />
        {isRegion ? <Path d={REGION_LAKES} fill="#0B0F14" stroke="rgba(94,200,255,0.22)" strokeWidth={0.8 * k} /> : null}
        <Circle cx={fx} cy={fy} r={60 * ring} fill="url(#glow)" />
        {[22, 44, 66].map((r) => <Circle key={r} cx={fx} cy={fy} r={r * ring} fill="none" stroke={fc} strokeOpacity={0.18} strokeWidth={1 * k} />)}
        <Line x1={fx - 75 * ring} y1={fy} x2={fx + 75 * ring} y2={fy} stroke={fc} strokeOpacity={0.12} strokeWidth={k} />
        <Line x1={fx} y1={fy - 75 * ring} x2={fx} y2={fy + 75 * ring} stroke={fc} strokeOpacity={0.12} strokeWidth={k} />
        {pins.map((m) => {
          const [x, y] = isRegion ? m.regionXY : m.globalXY;
          const hit = props.highlight.has(m.code);
          const col = tone(m);
          const main = m.status !== "concept";
          const r = (main ? 4.5 : hit ? 3.8 : 2.8) * k;
          return <G key={m.code} onPress={() => props.onSelect(m)}>
            <Circle cx={x} cy={y} r={12 * k} fill="transparent" />
            {hit ? <Circle cx={x} cy={y} r={7 * k} fill={col} fillOpacity={0.18} stroke={col} strokeOpacity={0.6} strokeWidth={k} /> : null}
            <Circle cx={x} cy={y} r={r} fill={m.status === "concept" ? C.canvas : col} stroke={col} strokeWidth={(m.status === "concept" ? 1.6 : 1) * k} />
            {isRegion || hit || m.status === "live" ? <SvgText x={x + 6 * k} y={y - 5 * k} fill={main || hit ? C.ink : "rgba(200,220,235,0.7)"} fontSize={(main ? 10 : 8.5) * k} fontWeight={main || hit ? "700" : "500"} fontFamily={F.mono}>{main ? (isRegion ? (m.code === "DSM" ? "Des Moines" : m.name.split(" ")[0]) : m.code) : m.code}</SvgText> : null}
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
                <Stop offset="0" stopColor={fc} stopOpacity="0.32" />
                <Stop offset="1" stopColor={fc} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Path d="M0,0 L130,0 A130,130 0 0,0 112.6,-65 Z" fill="url(#sw)" />
            <Line x1={0} y1={0} x2={130} y2={0} stroke={fc} strokeOpacity={0.5} strokeWidth={1} />
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
        <View style={[s.lDot, { backgroundColor: C.amber }]} /><Text style={s.lText}>Opens soon</Text>
        <View style={[s.lDot, s.lHollow]} /><Text style={s.lText}>Concept</Text>
      </View>
    </View>
  </View>;
}

const s = StyleSheet.create({
  wrap: { borderRadius: 20, borderWidth: 1, borderColor: "rgba(94,200,255,0.16)", backgroundColor: "#0D131A", overflow: "hidden", marginBottom: 12 },
  map: { width: "100%", overflow: "hidden" },
  sweepHost: { position: "absolute", width: 0, height: 0 },
  pulse: { position: "absolute", left: -12, top: -12, width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  sweep: { position: "absolute", left: -130, top: -130, width: 260, height: 260 },
  toggle: { position: "absolute", top: 10, right: 10, flexDirection: "row", backgroundColor: "rgba(17,22,29,0.85)", borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 3 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9 },
  toggleOn: { backgroundColor: "rgba(94,200,255,0.14)" },
  toggleText: { color: C.muted, fontFamily: F.bodySemi, fontSize: 12 },
  proj: { position: "absolute", left: 12, top: 14, color: C.quiet, fontFamily: F.mono, fontSize: 10 },
  legend: { position: "absolute", right: 10, bottom: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(11,15,20,0.8)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  lDot: { width: 7, height: 7, borderRadius: 4, marginLeft: 4 },
  lHollow: { borderWidth: 1.5, borderColor: C.rain, backgroundColor: "transparent" },
  lText: { color: C.muted, fontFamily: F.bodyMedium, fontSize: 10 },
});
