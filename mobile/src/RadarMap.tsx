import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Stop, Text as SvgText } from "react-native-svg";
import { GLOBAL_GRATICULE, GLOBAL_LAND, REGION_GRATICULE, REGION_LAKES, REGION_LAND } from "./geo-paths";
import { clusterConcepts, globalWindow, inWin, isKey, labelBox, placeLabels, regionWindow } from "./map-layout";
export { placeLabels } from "./map-layout";
import { MARKETS, type CatalogMarket } from "./markets-catalog";
import { C, F, space as S, type as T } from "./theme";
import { Text } from "./ui";
import { useReducedMotion } from "./liquid-glass";

export type MapScope = "region" | "global";

const tone = (m: CatalogMarket) => (m.status === "live" ? C.mint : m.status === "soon" ? C.amber : C.rain);

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
  const [widthDp, setWidthDp] = useState(340);
  const win = useMemo(() => (isRegion ? regionWindow(MARKETS, focus) : globalWindow(MARKETS)), [isRegion, focus]);
  const k = win.w / widthDp; // map units per dp, so strokes and 12dp labels render at true size
  const pins = useMemo(() => MARKETS.filter((m) => (isRegion ? m.group === "North America" && inWin(m.regionXY, win) : true)), [isRegion, win]);
  const { singles, clusters } = useMemo(() => (isRegion ? { singles: pins.filter((m) => m.status === "concept"), clusters: [] } : clusterConcepts(pins, false, k)), [pins, isRegion, k]);
  const drawn = useMemo(() => [...pins.filter((m) => m.status !== "concept" || props.highlight.has(m.code)), ...singles.filter((m) => !props.highlight.has(m.code))], [pins, singles, props.highlight]);
  const labels = useMemo(() => placeLabels(drawn, isRegion, props.highlight, k, win, { obstacles: clusters.map((c) => { const r = 9 * k; return [c.x - r, c.y - r, c.x + r, c.y + r] as [number, number, number, number]; }) }), [drawn, isRegion, props.highlight, k, win, clusters]);
  // Concept pins sitting under a key-city label are hidden so the label stays readable.
  const keyBoxes = [...labels.values()].filter((L) => { const m = MARKETS.find((x) => x.code === L.code); return !!m && (isKey(m) || props.highlight.has(m.code)); }).map(labelBox);
  const visible = drawn.filter((m) => { if (isKey(m) || props.highlight.has(m.code)) return true; const [x, y] = isRegion ? m.regionXY : m.globalXY; return !keyBoxes.some((b) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]); });
  const [fx, fy] = isRegion ? focus.regionXY : focus.globalXY;
  const focusOn = inWin([fx, fy], win);
  const fPct = { left: ((fx - win.x) / win.w) * 100, top: ((fy - win.y) / win.h) * 100 };
  const pulseS = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 3] });
  const pulseO = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] });
  const rotate = sweep.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const fc = tone(focus);
  const ring = isRegion ? k : k * 0.5;
  const hidden = isRegion ? MARKETS.filter((m) => m.group === "North America").length - pins.length : 0;

  return <View style={s.wrap}>
    <View style={s.head}>
      <Text style={s.proj}>{isRegion ? "LCC · 35°/55° N" : "Equal Earth"}{hidden ? ` · +${hidden} more in North America` : ""}</Text>
      <View style={s.toggle} accessibilityRole="tablist">
        {(["region", "global"] as const).map((v) => <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: props.scope === v }} onPress={() => props.onScope(v)} style={[s.toggleBtn, props.scope === v && s.toggleOn]} hitSlop={6}>
          <Text style={[s.toggleText, props.scope === v && { color: C.rain }]}>{v === "region" ? "Region" : "Global"}</Text>
        </Pressable>)}
      </View>
    </View>
    <View onLayout={(e) => { const w = Math.round(e.nativeEvent.layout.width); if (w > 0 && w !== widthDp) setWidthDp(w); }} style={[s.map, { aspectRatio: win.w / win.h }]} accessible accessibilityLabel={`${isRegion ? "Regional" : "Global"} radar map${focusOn ? ` centred on ${focus.name}` : ""}. ${pins.length} markets shown${clusters.length ? `, ${clusters.reduce((n, c) => n + c.count, 0)} concept markets grouped` : ""}.`}>
      <View style={StyleSheet.absoluteFill} renderToHardwareTextureAndroid needsOffscreenAlphaCompositing={false}>
      <Svg width="100%" height="100%" viewBox={`${win.x} ${win.y} ${win.w} ${win.h}`}>
        <Defs>
          <LinearGradient id="land" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.rain} stopOpacity="0.12" />
            <Stop offset="1" stopColor={C.rain} stopOpacity="0.04" />
          </LinearGradient>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={fc} stopOpacity="0.28" />
            <Stop offset="1" stopColor={fc} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Path d={isRegion ? REGION_GRATICULE : GLOBAL_GRATICULE} stroke="rgba(255,255,255,0.06)" strokeWidth={1 * k} strokeDasharray={`${3 * k} ${4 * k}`} fill="none" />
        <Path d={isRegion ? REGION_LAND : GLOBAL_LAND} fill="none" stroke="rgba(94,200,255,0.10)" strokeWidth={4 * k} strokeLinejoin="round" />
        <Path d={isRegion ? REGION_LAND : GLOBAL_LAND} fill="url(#land)" stroke="rgba(120,210,255,0.55)" strokeWidth={1 * k} strokeLinejoin="round" />
        {isRegion ? <Path d={REGION_LAKES} fill={C.canvas} stroke="rgba(94,200,255,0.22)" strokeWidth={0.8 * k} /> : null}
        {focusOn ? <>
          <Circle cx={fx} cy={fy} r={60 * ring} fill="url(#glow)" />
          {[22, 44, 66].map((r) => <Circle key={r} cx={fx} cy={fy} r={r * ring} fill="none" stroke={fc} strokeOpacity={0.18} strokeWidth={1 * k} />)}
        </> : null}
        {clusters.map((c) => <G key={c.codes.join("-")}>
          <Circle cx={c.x} cy={c.y} r={9 * k} fill={C.canvas} stroke={C.rain} strokeOpacity={0.7} strokeWidth={1.2 * k} />
          <SvgText x={c.x} y={c.y + 4 * k} textAnchor="middle" fill={C.muted} fontSize={11 * k} fontWeight="700" fontFamily={F.mono}>{c.count}</SvgText>
        </G>)}
        {visible.map((m) => {
          const [x, y] = isRegion ? m.regionXY : m.globalXY;
          const hit = props.highlight.has(m.code);
          const col = tone(m);
          const main = isKey(m);
          const r = (main ? 5 : hit ? 4.2 : 3.2) * k;
          return <G key={m.code} onPress={() => props.onSelect(m)}>
            <Circle cx={x} cy={y} r={14 * k} fill="transparent" />
            {hit ? <Circle cx={x} cy={y} r={8 * k} fill={col} fillOpacity={0.18} stroke={col} strokeOpacity={0.6} strokeWidth={k} /> : null}
            <Circle cx={x} cy={y} r={r} fill={m.status === "concept" ? C.canvas : col} stroke={col} strokeWidth={(m.status === "concept" ? 1.6 : 1) * k} />
          </G>;
        })}
        {[...labels.values()].map((L) => { const m = MARKETS.find((x) => x.code === L.code)!; const strong = isKey(m) || props.highlight.has(m.code);
          return <React.Fragment key={`l-${L.code}`}>{L.leader ? <Line x1={L.leader.x1} y1={L.leader.y1} x2={L.leader.x2} y2={L.leader.y2} stroke={strong ? C.muted : C.quiet} strokeOpacity={0.8} strokeWidth={1 * k} /> : null}<SvgText x={L.x} y={L.y} textAnchor={L.anchor} fill="none" stroke={C.canvas} strokeWidth={3 * k} strokeOpacity={0.85} strokeLinejoin="round" fontSize={L.size} fontWeight={strong ? "700" : "500"} fontFamily={F.mono}>{L.text}</SvgText><SvgText x={L.x} y={L.y} textAnchor={L.anchor} fill={strong ? C.ink : C.muted} fontSize={L.size} fontWeight={strong ? "700" : "500"} fontFamily={F.mono} onPress={() => props.onSelect(m)}>{L.text}</SvgText></React.Fragment>; })}
      </Svg>
      </View>
      {focusOn ? <View pointerEvents="none" style={[s.sweepHost, { left: `${fPct.left}%`, top: `${fPct.top}%` }]}>
        <Animated.View renderToHardwareTextureAndroid style={[s.pulse, { borderColor: fc, opacity: pulseO, transform: [{ scale: pulseS }] }]} />
        <Animated.View renderToHardwareTextureAndroid style={[s.sweep, { transform: [{ scale: isRegion ? 0.8 : 0.45 }, { rotate }] }]}>
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
      </View> : null}
    </View>
    <View style={s.legend} pointerEvents="none">
      <View style={[s.lDot, { backgroundColor: C.mint }]} /><Text style={s.lText}>Live</Text>
      <View style={[s.lDot, { backgroundColor: C.rain }]} /><Text style={s.lText}>Ready</Text>
      <View style={[s.lDot, { backgroundColor: C.amber }]} /><Text style={s.lText}>Soon</Text>
      <View style={[s.lDot, s.lHollow]} /><Text style={s.lText}>Concept</Text>
      {clusters.length ? <><View style={[s.lDot, s.lCluster]} /><Text style={s.lText}>Grouped</Text></> : null}
    </View>
  </View>;
}

/* Controls live outside the map (header + legend rows), so they can never cover pins or labels. */
const s = StyleSheet.create({
  wrap: { borderRadius: 20, borderWidth: 1, borderColor: "rgba(94,200,255,0.22)", backgroundColor: "#0A1119", overflow: "hidden", marginBottom: S.lg, boxShadow: "0px 0px 30px rgba(94,200,255,0.10), 0px 10px 28px rgba(0,0,0,0.5)" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: S.sm, paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: S.sm },
  map: { width: "100%", overflow: "hidden" },
  sweepHost: { position: "absolute", width: 0, height: 0 },
  pulse: { position: "absolute", left: -12, top: -12, width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  sweep: { position: "absolute", left: -130, top: -130, width: 260, height: 260 },
  toggle: { flexDirection: "row", backgroundColor: "rgba(17,22,29,0.85)", borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: S.xxs },
  toggleBtn: { minHeight: 32, justifyContent: "center", paddingHorizontal: S.md, borderRadius: 10 },
  toggleOn: { backgroundColor: "rgba(94,200,255,0.18)", boxShadow: "0px 0px 10px rgba(94,200,255,0.35)" },
  toggleText: { ...T.label, fontSize: 12, lineHeight: 16, color: C.muted },
  proj: { ...T.caption, flex: 1, color: C.quiet, fontFamily: F.mono },
  legend: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: S.xs, paddingHorizontal: S.md, paddingVertical: S.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  lDot: { width: 8, height: 8, borderRadius: 4, marginLeft: S.xs },
  lHollow: { borderWidth: 1.5, borderColor: C.rain, backgroundColor: "transparent" },
  lCluster: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.2, borderColor: C.rain, backgroundColor: C.canvas },
  lText: { ...T.caption, color: C.muted, marginRight: S.xs },
});
