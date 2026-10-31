import React from "react";
import { Linking, Pressable, View } from "react-native";
import { Text } from "./ui";
import { C } from "./theme";
import { openStreetMapUrl, type ReferencePoint } from "./reference-map";

export function ReferenceAreaMap({ point, location, evidenceLabel }: { point: ReferencePoint | null; location: string; evidenceLabel: string; onChangeLocation?: () => void }) {
  return <View style={{ padding: 16, gap: 8, backgroundColor: C.surfaceRaised, borderRadius: 16 }}>
    <Text style={{ color: C.ink }}>{location}</Text>
    <Text style={{ color: C.muted }}>{evidenceLabel}</Text>
    {point ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(openStreetMapUrl(point))} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: C.rain }}>View location on OpenStreetMap ↗</Text></Pressable> : null}
  </View>;
}
