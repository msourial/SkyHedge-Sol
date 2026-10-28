import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, Vibration, useWindowDimensions } from "react-native";
import Svg, { Line, Path, Text as SvgText } from "react-native-svg";
import { PERILS, perilOpen } from "../../../shared/peril-registry.ts";
import { GETTING_QUOTE, MAX_GAIN, MAX_LOSS, TRY_AGAIN, WAITING_WALLET, infoSheetTitle } from "../../../shared/ui-copy.ts";
import { lineGlyphs } from "../../../shared/ui-glyphs.ts";
import { instrumentArt } from "../../../shared/ui-instrument.ts";
import { lineTokens } from "../../../shared/ui-tokens.ts";
import type { MoneyFigure, PayoffModel, TicketModel } from "../../../shared/ui-view.ts";
import type { LineController } from "./use-line.ts";
import { LineArt } from "./art.tsx";
import { protectLayout as L } from "./layout.ts";
import { F } from "../theme.ts";
import { useReducedMotion } from "../liquid-glass.tsx";

import { LinePressable } from "./pressable.tsx";

const C = lineTokens;

export function ProtectBody(props: { line: LineController; onCity: (cityId: string) => void; onWallet: () => void; onRetry: () => void }) {
  const { line } = props;
  const model = line.model;
  const reduced = useReducedMotion();
  const tabX = useRef(new Animated.Value(PERILS.findIndex((p) => p.id === model.peril))).current;
  useEffect(() => {
    const animation = Animated.timing(tabX, { toValue: PERILS.findIndex((p) => p.id === model.peril), duration: reduced ? 0 : 240, easing: Easing.bezier(.23, 1, .32, 1), useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [model.peril, reduced, tabX]);
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 640) - 32;
  const art = model.hero ? instrumentArt({ peril: model.peril, rungs: model.rungs, selected: model.selected, reading: model.reading, state: model.instrument, size: "hero", unit: model.unit }) : null;
  return <View>
    <View style={styles.head}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Choose city, ${model.cityName}`} onPress={() => line.setSheet("city")} style={styles.city}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.8} style={styles.title}>{model.cityName}</Text><Text style={styles.chevron}>⌄</Text><Text style={styles.label}>Devnet</Text>
      </Pressable>
      <View style={styles.tenor}>
        {([ ["weekly", "Week"], ["monthly", "Month"] ] as const).map(([tenor, label]) => <Pressable key={tenor} accessibilityRole="button" accessibilityState={{ selected: model.tenor === tenor }} onPress={() => line.setTenor(tenor)} style={[styles.tenorBtn, model.tenor === tenor && styles.tenorOn]}><Text style={[styles.label, { color: line.tenorOpen[tenor] ? C.fg : C.dryText }]}>{label}</Text></Pressable>)}
      </View>
    </View>
    <Text numberOfLines={1} ellipsizeMode="tail" style={styles.sub}>{model.subline}</Text>
    <View style={styles.switcher} accessibilityRole="tablist">
      {PERILS.map((peril) => {
        const open = perilOpen({ cityId: line.cityId, peril: peril.id, windowStart: line.windowStart, tenor: model.tenor });
        const selected = model.peril === peril.id;
        const color = open ? selected ? C.fg : C.fg2 : C.dryText;
        return <LinePressable key={peril.id} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => line.setPeril(peril.id)} style={styles.seg}>
          <Glyph name={peril.id} color={color} /><Text style={[styles.label, { color }]}>{peril.label}</Text>
        </LinePressable>;
      })}
      <Animated.View pointerEvents="none" style={[styles.underline, { width: contentWidth / PERILS.length, transform: [{ translateX: Animated.multiply(tabX, contentWidth / PERILS.length) }] }]} />
    </View>
    {model.panel.kind === "not-open" ? <NotOpen line={line} onCity={props.onCity} /> : null}
    {model.hero && art ? <View style={styles.hero}>
      <View style={styles.instrument}><LineArt {...art} /></View>
      <View style={styles.readout}>
        <Text style={styles.label}>{model.hero.label}</Text>
        <View style={styles.numeralRow}><FigureSwap value={model.hero.numeral} /><Text style={styles.unit}>{model.hero.unit}</Text></View>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.label}>Chance</Text><Text style={styles.figM}>{model.hero.chance}</Text></View>
          <View style={styles.stat}><Text style={styles.label}>Multiple</Text><Text style={styles.figM}>{model.hero.multiple}</Text></View>
        </View>
        {model.hero.soFar ? <Text style={styles.reading}>{model.hero.soFar.label}  {model.hero.soFar.value}</Text> : null}
      </View>
    </View> : null}
    {model.showChain ? <View accessibilityLabel="Trigger chain" style={styles.chain}>
      <View style={styles.chainHead}>{model.header.map((label, index) => <Text key={label} numberOfLines={1} style={[styles.label, column(index), index > 0 && styles.right]}>{label}</Text>)}</View>
      {model.rows.map((row) => <LinePressable key={row.trigger} disabled={row.inert} accessibilityRole={row.inert ? "text" : "radio"} accessibilityState={{ selected: row.selected, disabled: row.inert }} accessibilityLabel={`${row.name}${row.tag ? `. ${row.tag}` : ""}`} onPress={() => { Vibration.vibrate(10); line.setSelectedTrigger(row.trigger); }} style={[styles.row, row.selected && styles.rowOn]}>
        {row.selected ? <View style={styles.rowTick} /> : null}
        <View style={column(0)}><View style={styles.triggerRow}>{row.selected ? <View style={styles.triggerMark} /> : null}<Text numberOfLines={1} style={[styles.figM, !row.open && styles.dry, !row.open && styles.dryTrigger]}>{row.triggerLabel}</Text>{row.tag ? <Text numberOfLines={1} style={styles.rowTag}>{row.tag}</Text> : null}</View>{row.topTag ? <Text numberOfLines={1} ellipsizeMode="clip" style={styles.label}>{row.topTag}</Text> : null}</View>
        {[row.chance, row.multiple, row.maxLoss].map((value, index) => <Text key={index} style={[styles.rowText, column(index + 1), styles.right, !row.open && styles.dry]}>{value}</Text>)}
      </LinePressable>)}
    </View> : null}
    {model.footnotes.filter((note) => !model.readOnly || note !== model.optionAFootnote).map((note) => <Text key={note} style={[styles.note, note === model.footnote && styles.footnote]}>{note}</Text>)}
    {model.ticket ? <View>
      {model.coveredRow ? <View style={styles.coveredRow}><Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M5 12.5l4.2 4.2L19 7" stroke={C.glacier} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg><Text style={styles.coveredLabel}>{model.coveredRow.label}</Text><Pressable accessibilityRole="button" onPress={props.onWallet} style={styles.coveredAction}><Text style={styles.coveredActionText}>{model.coveredRow.action}</Text></Pressable></View> : null}
      {!model.readOnly ? <View style={styles.chips}>
        {model.chips.map((chip) => <LinePressable key={chip.cover} disabled={chip.disabled} accessibilityRole="button" accessibilityLabel={`${chip.cover} SKYT cover`} accessibilityState={{ selected: chip.selected, disabled: chip.disabled }} onPress={() => line.setCover(chip.cover)} style={[styles.chip, chip.selected && styles.chipOn]}><Text style={[styles.chipText, chip.disabled && styles.dry]}>{chip.cover}</Text></LinePressable>)}
        <Pressable accessibilityRole="button" accessibilityLabel={infoSheetTitle()} onPress={() => line.setSheet("info")} style={styles.info}><Text style={styles.label}>ⓘ</Text></Pressable>
      </View> : null}
      {model.capMessage ? <Text style={styles.note}>{model.capMessage}</Text> : null}
      <MoneyCells ticket={model.ticket} />
      <Payoff diagram={model.ticket.payoff} width={contentWidth} />
      {model.ticket.signRows.slice(3).map((row) => <TicketRow key={row.label} {...row} />)}
      <Text style={[styles.body, styles.sentence]}>{model.ticket.sentence}</Text>
      <Text style={styles.note}>{model.ticket.salesClose}</Text>
      <Text style={styles.note}>{model.ticket.refund}</Text>
      {model.ticket.honesty ? <Text style={styles.note}>{model.ticket.honesty}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={infoSheetTitle()} onPress={() => line.setSheet("info")} style={styles.textButton}><Text style={styles.label}>ⓘ {infoSheetTitle()}</Text></Pressable>
    </View> : null}
    {line.sheet === "city" ? <View style={styles.sheet}>{line.cities.map((city) => <Pressable key={city.id} onPress={() => { props.onCity(city.id); line.setSheet(null); }} style={styles.cityRow}><Text style={styles.body}>{city.name}</Text></Pressable>)}</View> : null}
    {line.sheet === "info" && model.ticket?.sheet ? <View style={styles.sheet}><Text style={styles.title}>{infoSheetTitle()}</Text><Text style={styles.body}>{model.ticket.sheet}</Text><Pressable onPress={() => line.setSheet(null)} style={styles.textButton}><Text style={styles.link}>Done</Text></Pressable></View> : null}
  </View>;
}

function FigureSwap({ value }: { value: string }) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => { opacity.setValue(reduced ? 1 : 0); const a = Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }); a.start(); return () => a.stop(); }, [value, reduced, opacity]);
  return <Animated.Text style={[styles.numeral, { opacity }]}>{value}</Animated.Text>;
}

function NotOpen({ line, onCity }: { line: LineController; onCity: (cityId: string) => void }) {
  const panel = line.model.panel;
  if (panel.kind !== "not-open") return null;
  return <View style={styles.notOpen}><Text style={styles.body}>{panel.line}</Text>{panel.go ? <Pressable style={styles.textButton} onPress={() => { onCity(panel.go!.cityId); if (panel.go!.tenor) line.setTenor(panel.go!.tenor); }}><Text style={[styles.link, { color: C.glacier }]}>{panel.go.label}</Text></Pressable> : null}</View>;
}

export function LinePay(props: { line: LineController; onConnect: () => void; onReview: () => void; onWallet: () => void; onRetry: () => void; onCity: (cityId: string) => void; sheetOpen?: boolean }) {
  const panel = props.line.model.panel;
  const { fontScale } = useWindowDimensions();
  if (panel.kind === "not-open") return null;
  if (panel.kind === "error") return <View style={styles.payMessage}><Text style={styles.body}>{panel.message}</Text><Pressable style={styles.textButton} onPress={props.onRetry}><Text style={styles.link}>{TRY_AGAIN}</Text></Pressable></View>;
  if (panel.kind === "closed") return <View style={styles.payMessage}><Text style={styles.body}>{panel.line}</Text></View>;
  if (panel.kind === "paid" || panel.kind === "dry") return <View style={styles.payMessage}><Text style={styles.figM}>{panel.result}</Text><Text style={styles.label}>{panel.kind === "paid" ? "Paid out" : "Dry window"}</Text></View>;
  if (panel.kind === "covered") return null;
  const loading = panel.kind === "loading";
  const signing = panel.kind === "signing";
  let label = loading ? GETTING_QUOTE : signing ? WAITING_WALLET : panel.cta;
  if (fontScale > 1.15 && panel.kind === "ready") label = label.replace("Protect for ", "Protect\n");
  return <View style={styles.pay} pointerEvents={props.sheetOpen ? "none" : "auto"} accessibilityElementsHidden={props.sheetOpen} importantForAccessibility={props.sheetOpen ? "no-hide-descendants" : "auto"}>
    <PayFigs loss={loading ? null : panel.loss} gain={loading ? null : panel.gain} />
    <LinePressable accessibilityRole="button" disabled={loading || signing || props.sheetOpen || (panel.kind === "ready" && !props.line.approveTarget)} onPress={panel.kind === "connect" ? props.onConnect : props.onReview} style={[styles.cta, (loading || signing) && styles.ctaDim]}><Text style={[(loading || signing) ? styles.ctaTextDim : styles.ctaText, styles.center]}>{label}</Text></LinePressable>
  </View>;
}

export function MoneyCells({ ticket }: { ticket: Pick<TicketModel, "loss" | "gain"> }) {
  return <View style={styles.cells}>{([[MAX_LOSS, ticket.loss], [MAX_GAIN, ticket.gain]] as const).map(([label, fig]) => <View key={label} style={styles.cell}><Text style={styles.label}>{label}</Text><Text adjustsFontSizeToFit minimumFontScale={.75} numberOfLines={1} style={styles.figL}>{figure(fig)}<Text style={styles.moneyUnit}> SKYT</Text></Text></View>)}</View>;
}
export function TicketRow({ label, value, payout }: { label: string; value: string; payout?: boolean }) {
  return <View style={styles.ticketRow}><Text style={styles.rowLabel}>{label}</Text><Text style={[styles.figM, styles.ticketValue, payout && { color: C.slicker }]}>{value}</Text></View>;
}
function Payoff({ diagram: d, width }: { diagram: PayoffModel; width: number }) {
  const x = 16 + d.step * (width - 32), zero = 60, gainY = zero - d.gainPx, lossY = zero + d.lossPx;
  return <Svg width={width} height={112} accessibilityRole="image" accessibilityLabel={d.description}>
    <Line x1={16} y1={zero} x2={width - 16} y2={zero} stroke={C.tick} strokeWidth={1} />
    <Path d={`M16 ${lossY} H${x}`} stroke={C.fg2} strokeWidth={3} fill="none" />
    <Line x1={x} y1={lossY} x2={x} y2={gainY} stroke={C.slicker} strokeWidth={2} />
    <Path d={`M${x} ${gainY} H${width - 16}`} stroke={C.fg} strokeWidth={3} fill="none" />
    <SvgText x={16} y={Math.min(96, lossY + 18)} fill={C.fg2} fontFamily={F.mono} fontSize={13}>{d.lossLabel}</SvgText>
    <SvgText x={width - 16} y={Math.max(15, gainY - 8)} textAnchor="end" fill={C.fg} fontFamily={F.mono} fontSize={13}>{d.gainLabel}</SvgText>
    <SvgText x={Math.max(48, Math.min(width - 48, x))} y={110} textAnchor="middle" fill={C.fg2} fontFamily={F.mono} fontSize={13}>{d.triggerLabel}</SvgText>
  </Svg>;
}
export function TabGlyph({ name, color }: { name: "markets" | "protect" | "wallet"; color: string }) { return <Glyph name={name} color={color} />; }
function Glyph({ name, color }: { name: keyof typeof lineGlyphs; color: string }) { return <Svg width={24} height={24} viewBox="0 0 24 24">{lineGlyphs[name].map((d) => <Path key={d} d={d} stroke={color} fill="none" strokeWidth={1.75} strokeLinecap="round" />)}</Svg>; }
function figure(fig: MoneyFigure) { return `${fig.sign}${fig.whole}.${fig.fraction}`; }
function PayFigs({ loss, gain }: { loss: MoneyFigure | null; gain: MoneyFigure | null }) { return <View style={styles.payFigs}>{([[MAX_LOSS, loss], [MAX_GAIN, gain]] as const).map(([label, fig], index) => <View key={label} style={styles.paySide}><Text style={styles.label}>{label} </Text><Text style={[styles.figM, !fig && styles.dry]}>{fig ? figure(fig) : "…"}</Text>{index === 1 ? <Text style={styles.label}> SKYT</Text> : null}</View>)}</View>; }
function column(index: number) { return { width: `${L.columns[index] / 361 * 100}%` as `${number}%` }; }

const styles = StyleSheet.create({
  head: { height: L.header, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 },
  city: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 4 },
  title: { color: C.fg, fontFamily: F.heading, fontSize: 32, lineHeight: 34, flexShrink: 1 },
  chevron: { color: C.fg2, fontSize: 24, width: 24 },
  tenor: { flexDirection: "row", borderRadius: 999, backgroundColor: C.surface2 },
  tenorBtn: { height: 48, paddingHorizontal: 10, borderRadius: 999, justifyContent: "center" }, tenorOn: { backgroundColor: C.bgRaised },
  sub: { height: L.subline, color: C.fg2, fontFamily: F.bodyMedium, fontSize: 13, lineHeight: 18 },
  switcher: { height: L.tabs, flexDirection: "row" }, seg: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  underline: { position: "absolute", left: 0, bottom: 0, height: 3, backgroundColor: C.glacier },
  hero: { height: L.hero, marginTop: L.heroGap }, instrument: { position: "absolute", left: -16, top: 0 },
  readout: { marginLeft: L.readoutX - L.margin, flex: 1 }, numeralRow: { flexDirection: "row", alignItems: "baseline", gap: 8, height: 60 },
  numeral: { color: C.slicker, fontFamily: F.heading, fontSize: 64, lineHeight: 60, includeFontPadding: false },
  unit: { color: C.fg2, fontFamily: F.mono, fontSize: 17, lineHeight: 24 },
  stats: { flexDirection: "row", marginTop: 16 }, stat: { flex: 1 }, reading: { color: C.fg2, fontFamily: F.mono, fontSize: 13, lineHeight: 18 },
  label: { color: C.fg2, fontFamily: F.bodyMedium, fontSize: 13, lineHeight: 18 },
  figL: { color: C.fg, fontFamily: F.mono, fontSize: 28, lineHeight: 32 }, figM: { color: C.fg, fontFamily: F.mono, fontSize: 17, lineHeight: 24 },
  moneyUnit: { color: C.fg2, fontFamily: F.bodyMedium, fontSize: 13 },
  chain: { marginTop: L.chainGap }, chainHead: { height: L.chainHeader, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: C.tick },
  row: { height: L.chainRow, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: C.tick }, rowOn: { backgroundColor: C.bgRaised }, rowTag: { color: C.fg2, fontFamily: F.bodyMedium, fontSize: 13, lineHeight: 18, marginLeft: "auto" }, dryTrigger: { fontSize: 15, lineHeight: 20 },
  rowTick: { position: "absolute", left: 0, height: 40, width: 4, backgroundColor: C.glacier }, triggerRow: { flexDirection: "row", alignItems: "center", paddingLeft: 8 }, triggerMark: { width: 12, height: 2, backgroundColor: C.slicker, marginRight: 4 },
  rowText: { color: C.fg, fontFamily: F.mono, fontSize: 15, lineHeight: 20 }, right: { textAlign: "right" }, dry: { color: C.dryText },
  note: { color: C.fg2, fontFamily: F.body, fontSize: 13, lineHeight: 18, marginTop: 8 }, footnote: { marginTop: 12, marginBottom: 16 }, body: { color: C.fg, fontFamily: F.body, fontSize: 15, lineHeight: 22 }, sentence: { marginTop: 16 },
  chips: { flexDirection: "row", gap: 8, marginTop: 16 }, chip: { flex: 1, height: 48, borderRadius: 999, alignItems: "center", justifyContent: "center" }, chipOn: { backgroundColor: C.bgRaised }, chipText: { color: C.fg, fontFamily: F.bodySemi, fontSize: 15 }, info: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  cells: { flexDirection: "row", gap: 16, marginVertical: 16 }, cell: { flex: 1, height: 88, borderRadius: 14, backgroundColor: C.bgRaised, padding: 12, justifyContent: "center" }, coveredRow: { height: 56, flexDirection: "row", alignItems: "center", gap: 12 }, coveredLabel: { color: C.fg, fontFamily: F.bodySemi, fontSize: 17, flex: 1 }, coveredAction: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }, coveredActionText: { color: C.glacier, fontFamily: F.bodySemi, fontSize: 13 },
  ticketRow: { minHeight: 48, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: C.tick }, rowLabel: { color: C.fg2, fontFamily: F.body, fontSize: 15, lineHeight: 22 }, ticketValue: { flexShrink: 1, textAlign: "right" },
  sheet: { marginTop: 16, backgroundColor: C.surface1, borderRadius: 20, padding: 16 }, cityRow: { minHeight: 56, justifyContent: "center" }, notOpen: { minHeight: 120, marginTop: 8, backgroundColor: C.surface1, borderRadius: 14, padding: 16 },
  textButton: { minHeight: 48, justifyContent: "center" }, link: { color: C.fg2, fontFamily: F.bodySemi, fontSize: 15 },
  pay: { height: L.bar, backgroundColor: C.bgRaised, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderTopColor: C.tick, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  payMessage: { minHeight: 88, padding: 16, backgroundColor: C.bgRaised }, receipt: { height: 104, paddingHorizontal: 16, paddingTop: 8, backgroundColor: C.bgRaised, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderTopColor: C.tick }, payRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  payFigs: { flex: 1 }, paySide: { height: 24, flexDirection: "row", alignItems: "baseline" },
  cta: { width: 168, height: 56, borderRadius: 999, backgroundColor: C.glacier, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }, ctaDim: { backgroundColor: C.surface2 },
  ctaText: { color: C.onGlacier, fontFamily: F.bodySemi, fontSize: 15, lineHeight: 20 }, ctaTextDim: { color: C.dryText, fontFamily: F.bodySemi, fontSize: 15, lineHeight: 20 }, center: { textAlign: "center" },
});
