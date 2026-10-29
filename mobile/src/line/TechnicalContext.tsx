import { View, Text, StyleSheet } from "react-native";
import { CITIES } from "../../../shared/peril-registry.ts";
import { CONTRACT_LABEL, TECH_CONTEXT, REFERENCE_ONLY } from "../../../shared/ui-copy.ts";
import { lineTokens } from "../../../shared/ui-tokens.ts";
import { ReferenceAreaMap } from "../ReferenceAreaMap.tsx";
import { referencePointFor } from "../reference-map.ts";
import type { AgriculturalMarket } from "../api.ts";
import { F } from "../theme.ts";

export function TechnicalContext({ catalog, program }: { catalog: AgriculturalMarket[]; program: string }) {
  const market = catalog.find((item) => item.slug === "des-moines");
  return <View><Text selectable style={s.note}>{CONTRACT_LABEL} · {program}</Text>{CITIES.map((city) => <Text key={city.id} selectable style={s.note}>{city.name} · {city.stationId}</Text>)}<Text style={s.note}>{TECH_CONTEXT}</Text><ReferenceAreaMap point={referencePointFor(market)} location={market ? `${market.locality}, ${market.administrativeArea}, ${market.country}` : CITIES.find((c) => c.id === "des-moines")!.name} evidenceLabel={REFERENCE_ONLY}/></View>;
}
const s = StyleSheet.create({ note: { color: lineTokens.fg2, fontFamily: F.body, fontSize: 13, lineHeight: 18, marginVertical: 8 } });
