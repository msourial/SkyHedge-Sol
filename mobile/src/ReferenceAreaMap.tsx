import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native";
import { Camera, Map, ViewAnnotation } from "@maplibre/maplibre-react-native";
import { C, F } from "./theme";
import { AppIcon, Text } from "./ui";
import { mapTilerStyleUrl, openStreetMapUrl, type ReferencePoint } from "./reference-map";

type MapState = "loading" | "ready" | "unavailable";

export function ReferenceAreaMap({ point, location, evidenceLabel }: { point: ReferencePoint | null; location: string; evidenceLabel: string }) {
  const styleUrl = mapTilerStyleUrl(process.env.EXPO_PUBLIC_MAPTILER_KEY);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<MapState>("loading");
  const [linkError, setLinkError] = useState(false);

  useEffect(() => {
    setState("loading");
    setLinkError(false);
  }, [point?.slug, attempt]);

  useEffect(() => {
    if (!point || !styleUrl || state !== "loading") return;
    const timeout = setTimeout(() => setState("unavailable"), 15_000);
    return () => clearTimeout(timeout);
  }, [point, styleUrl, state, attempt]);

  const openLarger = () => {
    if (!point) return;
    setLinkError(false);
    void Linking.openURL(openStreetMapUrl(point)).catch(() => setLinkError(true));
  };

  const reason = !point ? "Reference coordinates are not verified for this place."
    : !styleUrl ? "Map provider not configured on this build."
      : "Map tiles could not be loaded. The exact place remains available below.";
  const showMap = !!point && !!styleUrl && state !== "unavailable";

  return <View style={styles.wrap}>
    <View style={[styles.mapFrame, !showMap && styles.mapFrameFallback]}>
      {showMap && point ? <Map
        key={`${point.slug}:${attempt}`}
        mapStyle={styleUrl}
        style={styles.map}
        logo={false}
        attribution={false}
        onDidFinishRenderingMapFully={() => setState("ready")}
        onDidFailLoadingMap={() => setState("unavailable")}
      >
        <Camera initialViewState={{ center: [point.longitude, point.latitude], zoom: point.zoom }} />
        <ViewAnnotation id={`reference-${point.slug}`} lngLat={[point.longitude, point.latitude]} title={point.location}>
          <View accessible accessibilityLabel={`${point.location}, index reference point only`} style={styles.marker}><View style={styles.markerCore} /></View>
        </ViewAnnotation>
      </Map> : <View style={styles.fallback}>
        <AppIcon name="map-pin" color={C.amber} size={25} />
        <Text style={styles.fallbackTitle}>Map unavailable</Text>
        <Text style={styles.fallbackReason}>{location}. {reason}</Text>
      </View>}
      {showMap && state === "loading" ? <View pointerEvents="none" style={styles.loading}>
        <ActivityIndicator color={C.blue} />
        <Text style={styles.loadingText}>Loading geographic context…</Text>
      </View> : null}
      <View style={styles.mapLabel}><Text style={styles.mapLabelText}>Reference point only</Text></View>
    </View>
    <View style={styles.details}>
      <View style={styles.placeRow}>
        <Text style={styles.place}>{location}</Text>
        <Text style={styles.evidence}>{evidenceLabel}</Text>
      </View>
      <Text style={styles.note}>{point ? `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)} · ` : ""}Not an insured boundary or a NOAA station marker.</Text>
      <Text style={styles.note}>WeatherXM is context only—not used for settlement.</Text>
      <View style={styles.actions}>
        {state === "unavailable" && point && styleUrl ? <Pressable accessibilityRole="button" accessibilityLabel="Retry map loading" onPress={() => setAttempt((value) => value + 1)} style={styles.action}><Text style={styles.actionText}>Retry map</Text></Pressable> : null}
        {point ? <Pressable accessibilityRole="link" accessibilityLabel={`Open larger map for ${point.location}`} onPress={openLarger} style={styles.action}><Text style={styles.actionText}>Open larger map</Text><AppIcon name="arrow-up-right" color={C.blue} size={16} /></Pressable> : null}
      </View>
      {linkError ? <Text accessibilityRole="alert" style={styles.linkError}>The larger map could not open. The exact location is shown above.</Text> : null}
      {showMap ? <View style={styles.attribution}>
        <Pressable accessibilityRole="link" accessibilityLabel="MapTiler attribution" onPress={() => { void Linking.openURL("https://www.maptiler.com/"); }}><Text style={styles.attributionText}>© MapTiler</Text></Pressable>
        <Pressable accessibilityRole="link" accessibilityLabel="OpenStreetMap attribution" onPress={() => { void Linking.openURL("https://www.openstreetmap.org/copyright"); }}><Text style={styles.attributionText}>© OpenStreetMap contributors</Text></Pressable>
      </View> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18, backgroundColor: C.surface, borderRadius: 14, overflow: "hidden" },
  mapFrame: { height: 214, backgroundColor: C.surfaceRaised },
  mapFrameFallback: { height: 132 },
  map: { flex: 1 },
  loading: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.surfaceRaised },
  loadingText: { color: C.muted, fontFamily: F.bodyMedium, fontSize: 13 },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, gap: 6 },
  fallbackTitle: { color: C.ink, fontFamily: F.bodySemi, fontSize: 15 },
  fallbackReason: { color: C.muted, fontFamily: F.body, fontSize: 13, textAlign: "center", lineHeight: 19 },
  mapLabel: { position: "absolute", top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.canvas, borderRadius: 5 },
  mapLabelText: { color: C.ink, fontFamily: F.bodySemi, fontSize: 11 },
  marker: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.canvas, borderColor: C.green, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  markerCore: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.green },
  details: { paddingHorizontal: 14, paddingVertical: 12 },
  placeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  place: { flex: 1, color: C.ink, fontFamily: F.bodySemi, fontSize: 14, lineHeight: 20 },
  evidence: { maxWidth: "40%", color: C.amber, fontFamily: F.bodyMedium, fontSize: 11, lineHeight: 16, textAlign: "right" },
  note: { color: C.muted, fontFamily: F.body, fontSize: 12, lineHeight: 18, marginTop: 5 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 },
  action: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 5, paddingRight: 10 },
  actionText: { color: C.blue, fontFamily: F.bodySemi, fontSize: 13 },
  linkError: { color: C.red, fontFamily: F.body, fontSize: 12, lineHeight: 18 },
  attribution: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 4 },
  attributionText: { color: C.muted, fontFamily: F.body, fontSize: 11, textDecorationLine: "underline" },
});
