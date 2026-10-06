import React, { useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, TextInput, View } from "react-native";
import type { AdvisoryResponse } from "./api";
import { guideActionLabel, guideEvidenceLabel } from "./guide";
import { C, F } from "./theme";
import { AppIcon, Text } from "./ui";

export type GuideTurn = { id: number; customer: string; result: AdvisoryResponse | null; error: string | null };

const prompts = [
  "I farm near Saskatoon and worry about too little rain.",
  "I'm planning a Toronto event and worry about rain.",
] as const;

export function GuidePanel({ turns, busy, onSend, onViewMatch }: {
  turns: GuideTurn[];
  busy: boolean;
  onSend: (message: string) => void;
  onViewMatch: (result: AdvisoryResponse) => void;
}) {
  const [draft, setDraft] = useState("");
  const [mapError, setMapError] = useState<string | null>(null);
  const send = () => {
    const message = draft.trim();
    if (!message || busy) return;
    setDraft("");
    onSend(message);
  };
  return <View style={styles.panel}>
    <View style={styles.headingRow}>
      <View style={styles.icon}><AppIcon name="message-circle" color={C.green} size={22} /></View>
      <View style={styles.headingCopy}>
        <Text style={styles.title}>Describe what’s at risk</Text>
        <Text style={styles.subtitle}>Check existing protection and research areas. The guide cannot create a contract or move funds.</Text>
      </View>
    </View>
    {turns.length === 0 ? <View style={styles.promptList}>
      {prompts.map((prompt) => <Pressable key={prompt} accessibilityRole="button" accessibilityLabel={`Ask guide: ${prompt}`} onPress={() => onSend(prompt)} disabled={busy} style={styles.prompt}><Text style={styles.promptText}>{prompt}</Text><AppIcon name="arrow-up-right" color={C.blue} size={18} /></Pressable>)}
    </View> : null}
    {turns.map((turn) => <View key={turn.id} style={styles.turn}>
      <Text style={styles.turnLabel}>You</Text>
      <Text style={styles.turnCustomer}>{turn.customer}</Text>
      {turn.result ? <View style={styles.reply} accessibilityLiveRegion="polite">
        <Text style={styles.turnLabel}>SkyHedge guide · advisory only</Text>
        <Text style={styles.replyText}>{turn.result.message}</Text>
        {turn.result.match ? <View style={styles.match}>
          <Text style={styles.matchPlace}>{turn.result.match.location}</Text>
          <Text style={styles.matchMeta}>Rainfall · {guideEvidenceLabel(turn.result)}</Text>
          {turn.result.unavailableReason ? <Text style={styles.blocker}>{turn.result.unavailableReason}</Text> : null}
          <Pressable accessibilityRole="link" accessibilityLabel={`Open map for ${turn.result.match.location}; reference place only`} onPress={() => { setMapError(null); void Linking.openURL(`https://www.openstreetmap.org/search?query=${encodeURIComponent(turn.result!.match!.location)}`).catch(() => setMapError("The map could not be opened. The exact place is shown above.")); }} style={styles.mapLink}><AppIcon name="map-pin" color={C.blue} size={17} /><Text style={styles.mapLinkText}>View reference place</Text></Pressable>
          {mapError ? <Text accessibilityRole="alert" style={styles.blocker}>{mapError}</Text> : null}
          <Text style={styles.mapNote}>Place reference only—not an insured boundary or NOAA station pin.</Text>
        </View> : null}
        {turn.result.status === "matched" || turn.result.status === "quote_ready" ? <View style={styles.explanation}>
          <Text style={styles.explanationText}>{turn.result.costExplanation}</Text>
          <Text style={styles.explanationText}>{turn.result.payoutExplanation}</Text>
        </View> : null}
        {guideActionLabel(turn.result) ? <Pressable accessibilityRole="button" accessibilityLabel={`${guideActionLabel(turn.result)} for ${turn.result.match?.location}`} onPress={() => onViewMatch(turn.result!)} style={styles.reviewButton}><Text style={styles.reviewText}>{guideActionLabel(turn.result)}</Text><AppIcon name="arrow-right" color={C.actionText} size={18} /></Pressable> : null}
      </View> : turn.error ? <Text accessibilityRole="alert" style={styles.blocker}>{turn.error}</Text> : <View style={styles.waitRow}><ActivityIndicator size="small" color={C.blue} /><Text style={styles.waitText}>Checking your request against current contracts…</Text></View>}
    </View>)}
    <View style={styles.composer}>
      <TextInput
        accessibilityLabel="Describe your weather protection need"
        accessibilityHint="You can describe a location, weather risk, date, and amount in your own words"
        placeholder="e.g. My Toronto event is on Oct 22…"
        placeholderTextColor={C.quiet}
        value={draft}
        onChangeText={setDraft}
        multiline
        maxLength={800}
        style={styles.input}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Send request to SkyHedge guide" accessibilityState={{ disabled: busy || !draft.trim() }} disabled={busy || !draft.trim()} onPress={send} style={[styles.send, (busy || !draft.trim()) && styles.sendDisabled]}><AppIcon name="arrow-up" color={C.actionText} size={20} /></Pressable>
    </View>
    <Text style={styles.footnote}>Your description is sent to Anthropic to identify your request; avoid personal details. Devnet SKYT has no real-world value. AI is advisory; any transaction needs separate wallet approval.</Text>
  </View>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 16, gap: 14 },
  headingRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.greenSoft },
  headingCopy: { flex: 1, gap: 4 },
  title: { fontFamily: F.heading, color: C.ink, fontSize: 19 },
  subtitle: { fontFamily: F.body, color: C.muted, fontSize: 14, lineHeight: 21 },
  promptList: { gap: 8 },
  prompt: { minHeight: 48, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 8 },
  promptText: { flex: 1, color: C.ink, fontFamily: F.bodyMedium, fontSize: 14, lineHeight: 21 },
  turn: { gap: 8, borderTopWidth: 1, borderColor: C.border, paddingTop: 14 },
  turnLabel: { color: C.quiet, fontFamily: F.bodySemi, fontSize: 12 },
  turnCustomer: { color: C.ink, fontFamily: F.bodyMedium, fontSize: 15, lineHeight: 22 },
  reply: { backgroundColor: C.surfaceRaised, borderRadius: 12, padding: 12, gap: 9 },
  replyText: { color: C.ink, fontFamily: F.body, fontSize: 15, lineHeight: 22 },
  match: { borderLeftWidth: 2, borderLeftColor: C.blue, paddingLeft: 10, gap: 4 },
  matchPlace: { color: C.ink, fontFamily: F.bodySemi, fontSize: 15 },
  matchMeta: { color: C.blue, fontFamily: F.bodyMedium, fontSize: 13 },
  mapLink: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8 },
  mapLinkText: { color: C.blue, fontFamily: F.bodySemi, fontSize: 14, textDecorationLine: "underline" },
  mapNote: { color: C.quiet, fontFamily: F.body, fontSize: 12, lineHeight: 18 },
  blocker: { color: C.amber, fontFamily: F.bodyMedium, fontSize: 14, lineHeight: 21 },
  explanation: { gap: 7 },
  explanationText: { color: C.muted, fontFamily: F.body, fontSize: 14, lineHeight: 21 },
  reviewButton: { backgroundColor: C.green, borderRadius: 12, minHeight: 48, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reviewText: { color: C.actionText, fontFamily: F.bodyBold, fontSize: 14 },
  waitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  waitText: { flex: 1, color: C.muted, fontFamily: F.body, fontSize: 14 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: { flex: 1, minHeight: 48, maxHeight: 124, paddingHorizontal: 13, paddingVertical: 10, color: C.ink, backgroundColor: C.canvas, borderWidth: 1, borderColor: C.border, borderRadius: 12, fontFamily: F.body, fontSize: 16 },
  send: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: C.green },
  sendDisabled: { opacity: 0.45 },
  footnote: { color: C.quiet, fontFamily: F.body, fontSize: 12, lineHeight: 18 },
});
