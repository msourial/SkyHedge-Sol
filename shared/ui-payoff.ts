/** Filled payout graphics. Values are SKYT from quote/position economics. */
export const payoffPlot = { width: 329, height: 132, band: 30, inset: 8, annotationHeight: 44 } as const;
export type PayoffDomain = { loss: number; gain: number };
export function sqrtMeasure(value: number, maximum: number, width = payoffPlot.width): number {
  return Math.sqrt(Math.max(0, Math.min(1, maximum > 0 ? value / maximum : 0))) * width;
}
export function payoffDomain(values: readonly PayoffDomain[]): PayoffDomain {
  return { loss: Math.max(0, ...values.map(v => v.loss)), gain: Math.max(0, ...values.map(v => v.gain)) };
}
/** Reserve at least a third of the square-root plot after every selectable trigger. */
export function payoffChartMaximum(trigger: number, maximum: number, others: readonly number[] = []): number {
  return Math.max(1, maximum, Math.max(0, trigger, ...others) * 2.25);
}
export function payoffGeometry(trigger: number, maximum: number, loss: number, gain: number, domain: PayoffDomain) {
  const y = (value: number) => 8 + (domain.gain - value) / (domain.loss + domain.gain || 1) * 116;
  return { x: sqrtMeasure(trigger, maximum), zero: y(0), lossY: y(-loss), gainY: y(gain) };
}
export function chanceBarWidth(chance: number): number { return Math.max(2, Math.min(1, Math.max(0, chance)) * 64); }
export function splitProportion(loss: number, gain: number): number { return loss + gain > 0 ? loss / (loss + gain) : 0; }
export function sparkHeights(loss: number, gain: number, domain: PayoffDomain) {
  return { loss: Math.max(2, Math.min(8, domain.loss > 0 ? loss / domain.loss * 8 : 0)), gain: Math.max(2, Math.min(13, domain.gain > 0 ? gain / domain.gain * 13 : 0)) };
}
/** Values have their own row above the plot, independent of all band/trigger geometry. */
export function payoffAnnotationBoxes() {
  const box = (left: number, right: number) => ({ left, right, top: 0, bottom: 36 });
  return { loss: box(8, 160), gain: box(169, 321) };
}

/** The selected trigger owns a row below the plot; secondary ticks get a separate row. */
export function payoffLabelBoxes(trigger: number, maximum: number, others: readonly number[], unit: string, highLabel: string, highValue = maximum) {
  const box = (center: number, label: string) => {
    const width = Math.min(329, Math.max(64, label.length * 10));
    const left = Math.max(0, Math.min(329 - width, center - width / 2));
    return { label, left, right: left + width };
  };
  const selected = box(sqrtMeasure(trigger, maximum), `${trigger} ${unit}`);
  // At the maximum the selected trigger already supplies the number/unit. Keep only its tag.
  const highText = trigger === highValue && (highLabel === selected.label || highLabel.startsWith(`${selected.label} ·`)) ? highLabel.slice(selected.label.length).replace(/^\s*·\s*/, "") : highLabel;
  const highBox = box(sqrtMeasure(highValue, maximum), highText);
  const high = { ...highBox, y: 174, top: 160, bottom: 178 };
  const ticks: Array<ReturnType<typeof box> & { y: number; top: number; bottom: number }> = [];
  for (const t of [...new Set(others)].filter(t => t !== trigger).sort((a,b) => a-b)) {
    const candidate = box(sqrtMeasure(t, maximum), String(t));
    if (candidate.right + 8 < high.left && (!ticks.length || ticks[ticks.length - 1].right + 8 < candidate.left)) ticks.push({ ...candidate, y: 174, top: 160, bottom: 178 });
  }
  return { selected: { ...selected, y: 150, top: 136, bottom: 154 }, high, ticks };
}
