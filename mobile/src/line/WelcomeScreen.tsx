import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowRight, Wallet } from "phosphor-react-native";
import * as copy from "../../../shared/ui-copy.ts";
import { lineTokens as C } from "../../../shared/ui-tokens.ts";
import { BrandMark } from "../BrandMark.tsx";
import { F } from "../theme.ts";

export function AboutButton({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={copy.WELCOME_ABOUT} onPress={onPress} style={({ pressed }) => [s.about, pressed && s.pressed]}><Text style={s.aboutText}>{copy.WELCOME_ABOUT_SHORT}</Text></Pressable>;
}

/** Scrolls with the app container so larger accessibility text never gets clipped. */
export function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
  const split = copy.WELCOME_SLOGAN.lastIndexOf("Get paid.");
  return <View style={s.screen}>
    <View style={s.brand}><BrandMark size={48}/><Text style={s.brandName}>{copy.WELCOME_BRAND}</Text></View>
    <View style={s.hero}>
      <Text style={s.eyebrow}>{copy.LANDING_TITLE}</Text>
      <Text accessibilityRole="header" style={s.slogan}>{copy.WELCOME_SLOGAN.slice(0, split)}<Text style={s.emphasis}>{copy.WELCOME_SLOGAN.slice(split)}</Text></Text>
      <Text style={s.audience}>{copy.WELCOME_AUDIENCE}</Text>
    </View>
    <Text accessibilityRole="header" style={s.sectionTitle}>{copy.WELCOME_STEPS_TITLE}</Text>
    <View style={s.steps}>{copy.WELCOME_STEPS.map((step, index) => <View key={step.title} style={[s.step, index > 0 && s.divider]}>
      <View style={s.numberTile}><Text style={s.number}>{index + 1}</Text></View>
      <View style={s.stepCopy}><Text style={s.stepTitle}>{step.title}</Text><Text style={s.body}>{step.body}</Text></View>
    </View>)}</View>
    <View style={s.wallet}><Wallet size={22} color={C.glacier}/><Text style={s.walletText}>{copy.WELCOME_WALLET}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel={copy.WELCOME_CTA} onPress={onGetStarted} style={({ pressed }) => [s.cta, pressed && s.pressed]}><Text style={s.ctaText}>{copy.WELCOME_CTA}</Text><ArrowRight size={22} weight="bold" color={C.bg}/></Pressable>
  </View>;
}
const s = StyleSheet.create({
  screen: { paddingTop: 12, paddingBottom: 8 },
  brand: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandName: { fontFamily: F.bodyBold, fontSize: 23, color: C.fg, letterSpacing: -.7 },
  hero: { marginTop: 32, marginBottom: 26 },
  eyebrow: { fontFamily: F.bodySemi, fontSize: 14, lineHeight: 21, color: C.glacier },
  slogan: { fontFamily: F.bodyBold, fontSize: 42, lineHeight: 47, letterSpacing: -1.6, color: C.fg, marginTop: 12 },
  emphasis: { color: C.slicker },
  audience: { fontFamily: F.body, fontSize: 15, lineHeight: 23, color: C.fg2, marginTop: 16 },
  sectionTitle: { fontFamily: F.bodySemi, fontSize: 17, lineHeight: 24, color: C.fg, marginBottom: 12 },
  steps: { borderRadius: 24, backgroundColor: C.surface1, paddingHorizontal: 16 },
  step: { flexDirection: "row", gap: 14, paddingVertical: 18 },
  divider: { borderTopWidth: 1, borderTopColor: C.divider },
  numberTile: { width: 30, height: 30, borderRadius: 10, backgroundColor: C.surface2, alignItems: "center", justifyContent: "center" },
  number: { fontFamily: F.bodySemi, fontSize: 15, color: C.fg2 },
  stepCopy: { flex: 1 },
  stepTitle: { fontFamily: F.bodySemi, fontSize: 16, lineHeight: 23, color: C.fg },
  body: { fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.fg2, marginTop: 4 },
  wallet: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 22, paddingHorizontal: 4 },
  walletText: { flex: 1, fontFamily: F.body, fontSize: 13, lineHeight: 20, color: C.fg2 },
  cta: { minHeight: 60, borderRadius: 999, backgroundColor: C.glacier, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, padding: 16 },
  ctaText: { fontFamily: F.bodyBold, fontSize: 18, color: C.bg },
  about: { minHeight: 48, minWidth: 48, paddingHorizontal: 8, justifyContent: "center", alignItems: "center" },
  aboutText: { fontFamily: F.bodySemi, fontSize: 13, color: C.glacier },
  pressed: { opacity: .75 },
});
