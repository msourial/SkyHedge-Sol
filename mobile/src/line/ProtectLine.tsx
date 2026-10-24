import { Pressable, StyleSheet, Text, View, Vibration } from "react-native";
import Svg, { Path } from "react-native-svg";
import { PERILS, perilOpen } from "../../../shared/peril-registry.ts";
import {
  APPROVE_WALLET, CHANCE, DEVNET_TAG, DONE, DRY_WINDOW, GETTING_QUOTE, MAX_GAIN, MAX_LOSS, MONTH, NOT_OPEN_WORD, PAID_OUT,
  SO_FAR, TRIGGER, TRY_AGAIN, VIEW_WALLET, WAITING_WALLET, WEEK, gainCaption, infoSheetTitle, lossCaption,
} from "../../../shared/ui-copy.ts";
import { lineGlyphs } from "../../../shared/ui-glyphs.ts";
import { instrumentArt } from "../../../shared/ui-instrument.ts";
import { lineTokens } from "../../../shared/ui-tokens.ts";
import type { LineController } from "./use-line.ts";
import { LineArt } from "./art.tsx";
import { F } from "../theme.ts";

const C = lineTokens;

export function ProtectBody(props: {
  line: LineController;
  onCity: (cityId: string) => void;
  onWallet: () => void;
  onRetry: () => void;
}) {
  const { line } = props;
  const model = line.model;
  const art = instrumentArt({ peril: model.peril, rungs: model.rungs, selected: model.selected, reading: model.reading, state: model.instrument, size: "stage", unit: model.unit });
  const box = Number(art.viewBox.split(" ")[3]) || 1;
  const lineY = art.anchorY == null ? null : (art.anchorY / box) * 248;
  return (
    <View>
      <Text style={styles.status}>{DEVNET_TAG}</Text>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" onPress={() => line.setSheet("city")} style={styles.city}>
          <Text style={styles.title}>{model.cityName}</Text>
        </Pressable>
        <View style={styles.tenor}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: model.tenor === "weekly" }} onPress={() => line.setTenor("weekly")} style={[styles.tenorBtn, model.tenor === "weekly" && styles.tenorOn]}><Text style={styles.tenorText}>{WEEK}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: model.tenor === "monthly" }} onPress={() => line.setTenor("monthly")} style={[styles.tenorBtn, model.tenor === "monthly" && styles.tenorOn]}><Text style={styles.tenorText}>{MONTH}</Text></Pressable>
        </View>
      </View>
      {model.subline ? <Text style={styles.sub}>{model.subline}</Text> : null}
      <View style={styles.switcher} accessibilityRole="tablist">
        {PERILS.map((peril) => {
          const open = perilOpen({ cityId: line.cityId, peril: peril.id, windowStart: line.windowStart, tenor: model.tenor });
          const on = model.peril === peril.id;
          return (
            <Pressable key={peril.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => line.setPeril(peril.id)} style={[styles.seg, on && styles.segOn]}>
              <Glyph name={peril.id} color={open ? C.fg : C.dryText} />
              <Text style={[styles.segText, !open && { color: C.dryText }]}>{peril.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.stage}>
        {lineY != null ? <View style={[styles.rule, { top: lineY }, model.instrument === "paid" && { height: 6 }]} /> : null}
        <LineArt ops={art.ops} viewBox={art.viewBox} width={art.width} height={art.height} label={art.label} />
        <View style={styles.readout}>
          {model.ticket ? <Text style={styles.label}>{CHANCE}</Text> : null}
          {model.ticket ? <Text style={styles.figM}>{model.ticket.chance}</Text> : null}
          {model.selected != null ? <Text style={styles.label}>{TRIGGER}</Text> : null}
          {model.selected != null ? <Text style={styles.figXl}>{model.selected}<Text style={styles.unit}> {model.unit}</Text></Text> : null}
          <Text style={styles.label}>{SO_FAR}</Text>
          <Text style={styles.figM}>{model.soFarValue}</Text>
        </View>
      </View>
      {model.odds ? <Text style={styles.odds}>{model.odds}</Text> : null}
      {model.showChain ? (
        <View accessibilityLabel="Trigger chain">
          {model.rows.map((row) => (
            <Pressable key={row.trigger} disabled={row.inert} accessibilityRole={row.inert ? "text" : "radio"} accessibilityState={{ selected: row.selected, disabled: row.inert }} accessibilityLabel={row.name} onPress={() => { Vibration.vibrate(10); line.setSelectedTrigger(row.trigger); }} style={[styles.row, row.selected && styles.rowOn]}>
              <Text style={[styles.rowText, !row.open && styles.dry]}>{row.triggerLabel}</Text>
              <Text style={[styles.rowText, !row.open && styles.dry]}>{row.chance}</Text>
              <Text style={[styles.rowText, !row.open && styles.dry]}>{row.multiple}</Text>
              <Text style={[styles.rowText, !row.open && styles.dry]}>{row.maxLoss ?? NOT_OPEN_WORD}</Text>
            </Pressable>
          ))}
          {model.footnote ? <Text style={styles.note}>{model.footnote}</Text> : null}
        </View>
      ) : null}
      {model.blocked ? <Text style={styles.note}>{model.blocked}</Text> : null}
      {model.ticket ? (
        <View>
          <View style={styles.chips}>
            {model.chips.map((chip) => (
              <Pressable key={chip.cover} disabled={chip.disabled} accessibilityState={{ selected: chip.selected }} onPress={() => line.setCover(chip.cover)} style={[styles.chip, chip.selected && styles.chipOn]}>
                <Text style={styles.chipText}>{chip.cover}</Text>
              </Pressable>
            ))}
            <Pressable accessibilityLabel={infoSheetTitle()} onPress={() => line.setSheet("info")} style={styles.info}><Text style={styles.note}>i</Text></Pressable>
          </View>
          {model.capMessage ? <Text style={styles.note}>{model.capMessage}</Text> : null}
          <View style={styles.cells}>
            <View style={styles.cell}><Text style={styles.label}>{lossCaption()}</Text><Text style={styles.figL}>{model.ticket.loss.sign}{model.ticket.loss.whole}<Text style={styles.minor}>.{model.ticket.loss.fraction} SKYT</Text></Text></View>
            <View style={styles.cell}><Text style={styles.label}>{gainCaption()}</Text><Text style={styles.figL}>{model.ticket.gain.sign}{model.ticket.gain.whole}<Text style={styles.minor}>.{model.ticket.gain.fraction} SKYT</Text></Text></View>
          </View>
          <Text style={styles.body}>{model.ticket.sentence}</Text>
          {model.ticket.note ? <Text style={styles.note}>{model.ticket.note}</Text> : null}
        </View>
      ) : null}
      {line.sheet === "city" ? (
        <View style={styles.sheet}>
          {line.cities.map((city) => (
            <Pressable key={city.id} onPress={() => { props.onCity(city.id); line.setSheet(null); }} style={styles.cityRow}><Text style={styles.body}>{city.name}</Text></Pressable>
          ))}
        </View>
      ) : null}
      {line.sheet === "info" && model.ticket?.sheet ? (
        <View style={styles.sheet}>
          <Text style={styles.title}>{infoSheetTitle()}</Text>
          <Text style={styles.body}>{model.ticket.sheet}</Text>
          <Pressable onPress={() => line.setSheet(null)}><Text style={styles.link}>{DONE}</Text></Pressable>
        </View>
      ) : null}
      {line.sheet === "sign" && model.ticket ? (
        <View style={styles.sheet}>
          <Text style={styles.title}>{APPROVE_WALLET}</Text>
          {model.ticket.signRows.map((row) => <Text key={row.label} style={styles.body}>{row.label} {row.value}</Text>)}
        </View>
      ) : null}
    </View>
  );
}

export function LinePay(props: { line: LineController; onConnect: () => void; onApprove: () => void; onWallet: () => void; onRetry: () => void; onCity: (cityId: string) => void }) {
  const panel = props.line.model.panel;
  if (panel.kind === "loading") return <View style={styles.pay}><Pressable disabled style={styles.ctaDim}><Text style={styles.ctaTextDim}>{GETTING_QUOTE}</Text></Pressable></View>;
  if (panel.kind === "error") return <View style={styles.pay}><Text style={styles.body}>{panel.message}</Text><Pressable onPress={props.onRetry}><Text style={styles.link}>{TRY_AGAIN}</Text></Pressable></View>;
  if (panel.kind === "not-open") return <View style={styles.pay}><Text style={styles.body}>{panel.line}</Text>{panel.go ? <Pressable onPress={() => props.onCity(panel.go!.cityId)}><Text style={styles.link}>{panel.go.label}</Text></Pressable> : null}</View>;
  if (panel.kind === "closed") return <View style={styles.pay}><Text style={styles.body}>{panel.line}</Text></View>;
  if (panel.kind === "paid") return <View style={styles.pay}><Text style={styles.paid}>{panel.result}</Text><Text style={styles.stamp}>{PAID_OUT}</Text></View>;
  if (panel.kind === "dry") return <View style={styles.pay}><Text style={styles.figM}>{panel.result}</Text><Text style={styles.dryStamp}>{DRY_WINDOW}</Text></View>;
  if (panel.kind === "covered") return <View style={styles.pay}><Text style={styles.label}>{panel.title}</Text><PayFigs loss={panel.loss} gain={panel.gain} /><Text style={styles.link} onPress={props.onWallet}>{VIEW_WALLET}</Text></View>;
  if (panel.kind === "connect" || panel.kind === "ready" || panel.kind === "signing") {
    const press = panel.kind === "connect" ? props.onConnect : panel.kind === "signing" ? undefined : () => { Vibration.vibrate(10); props.line.setSheet("sign"); };
    return (
      <View style={styles.pay}>
        <PayFigs loss={panel.loss} gain={panel.gain} />
        <Pressable disabled={panel.kind === "signing"} onPress={press} style={panel.kind === "signing" ? styles.ctaDim : styles.cta}>
          <Text style={panel.kind === "signing" ? styles.ctaTextDim : styles.ctaText}>{panel.kind === "signing" ? WAITING_WALLET : panel.cta}</Text>
        </Pressable>
        {props.line.sheet === "sign" ? <Pressable onPress={() => { Vibration.vibrate(10); props.onApprove(); }} style={styles.cta}><Text style={styles.ctaText}>{APPROVE_WALLET}</Text></Pressable> : null}
      </View>
    );
  }
  return null;
}

export function TabGlyph({ name, color }: { name: "markets" | "protect" | "wallet"; color: string }) {
  return <Glyph name={name} color={color} />;
}

function PayFigs({ loss, gain }: { loss: { sign: string; whole: string; fraction: string }; gain: { sign: string; whole: string; fraction: string } }) {
  return (
    <View style={styles.payFigs}>
      <View style={styles.paySide}><Text style={styles.label}>{MAX_LOSS}</Text><Text style={styles.figM}>{loss.sign}{loss.whole}.{loss.fraction}</Text></View>
      <View style={styles.paySide}><Text style={styles.label}>{MAX_GAIN}</Text><Text style={styles.figM}>{gain.sign}{gain.whole}.{gain.fraction}</Text></View>
      <Text style={styles.minor}>SKYT</Text>
    </View>
  );
}

function Glyph({ name, color }: { name: keyof typeof lineGlyphs; color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {lineGlyphs[name].map((d) => <Path key={d} d={d} stroke={color} fill="none" strokeWidth={1.75} strokeLinecap="round" />)}
    </Svg>
  );
}

const styles = StyleSheet.create({
  status: { height: 24, textAlign: "right", color: C.fg2, fontFamily: F.bodyMedium, fontSize: 13 },
  head: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  city: { minHeight: 44, justifyContent: "center" },
  title: { color: C.fg, fontFamily: F.heading, fontSize: 32, lineHeight: 34 },
  tenor: { flexDirection: "row", backgroundColor: C.surface2, borderRadius: 999, padding: 3 },
  tenorBtn: { minHeight: 36, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center" },
  tenorOn: { backgroundColor: C.bgRaised },
  tenorText: { color: C.fg, fontFamily: F.bodyMedium, fontSize: 13 },
  sub: { color: C.fg2, fontFamily: F.bodyMedium, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  switcher: { height: 64, borderRadius: 999, backgroundColor: C.surface2, flexDirection: "row", padding: 4, marginBottom: 12 },
  seg: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  segOn: { backgroundColor: C.bgRaised },
  segText: { color: C.fg, fontFamily: F.bodyMedium, fontSize: 13 },
  stage: { height: 256, flexDirection: "row", alignItems: "center" },
  rule: { position: "absolute", left: -18, right: -18, height: 2, backgroundColor: C.slicker },
  readout: { flex: 1, alignItems: "flex-end" },
  label: { color: C.fg2, fontFamily: F.bodyMedium, fontSize: 13, lineHeight: 18 },
  figXl: { color: C.slicker, fontFamily: F.mono, fontSize: 44, lineHeight: 44 },
  figL: { color: C.fg, fontFamily: F.mono, fontSize: 28, lineHeight: 32 },
  figM: { color: C.fg, fontFamily: F.mono, fontSize: 17, lineHeight: 24 },
  minor: { color: C.fg2, fontFamily: F.mono, fontSize: 13 },
  unit: { color: C.fg2, fontFamily: F.mono, fontSize: 13 },
  odds: { minHeight: 40, color: C.fg, fontFamily: F.body, fontSize: 15, lineHeight: 22 },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowOn: { backgroundColor: C.bgRaised },
  rowText: { color: C.fg, fontFamily: F.mono, fontSize: 15, flex: 1 },
  dry: { color: C.dryText },
  note: { color: C.fg2, fontFamily: F.body, fontSize: 13, lineHeight: 18, marginVertical: 8 },
  body: { color: C.fg, fontFamily: F.body, fontSize: 15, lineHeight: 22 },
  chips: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  chip: { minWidth: 64, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: C.bgRaised },
  chipText: { color: C.fg, fontFamily: F.bodySemi, fontSize: 15 },
  info: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  cells: { flexDirection: "row", gap: 16, marginTop: 12 },
  cell: { flex: 1, minHeight: 88, borderRadius: 14, backgroundColor: C.bgRaised, padding: 12 },
  link: { color: C.glacier, fontFamily: F.bodySemi, fontSize: 15, minHeight: 44 },
  sheet: { marginTop: 12, backgroundColor: C.surface1, borderRadius: 20, padding: 16 },
  cityRow: { minHeight: 56, justifyContent: "center" },
  pay: { backgroundColor: C.bgRaised, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 8, minHeight: 120 },
  payFigs: { flexDirection: "row", alignItems: "baseline", gap: 12 },
  paySide: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  cta: { height: 56, borderRadius: 999, backgroundColor: C.glacier, alignItems: "center", justifyContent: "center" },
  ctaDim: { height: 56, borderRadius: 999, backgroundColor: C.surface2, alignItems: "center", justifyContent: "center" },
  ctaText: { color: C.onGlacier, fontFamily: F.bodySemi, fontSize: 15 },
  ctaTextDim: { color: C.dryText, fontFamily: F.bodySemi, fontSize: 15 },
  paid: { color: C.slicker, fontFamily: F.mono, fontSize: 17 },
  stamp: { color: C.slicker, fontFamily: F.heading, fontSize: 20 },
  dryStamp: { color: C.dryText, fontFamily: F.heading, fontSize: 20 },
});
