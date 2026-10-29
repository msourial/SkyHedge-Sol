/** Filled payout graphics. Values are SKYT from quote/position economics. */
export const payoffPlot = { width: 329, height: 132, band: 30, inset: 8 } as const;
export type PayoffDomain = { loss: number; gain: number };
export function sqrtMeasure(value: number, maximum: number, width = payoffPlot.width): number {
  return Math.sqrt(Math.max(0, Math.min(1, maximum > 0 ? value / maximum : 0))) * width;
}
export function payoffDomain(values: readonly PayoffDomain[]): PayoffDomain {
  return { loss: Math.max(0, ...values.map(v => v.loss)), gain: Math.max(0, ...values.map(v => v.gain)) };
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
/** Label boxes use a conservative Inter 13sp tabular width, in plot coordinates. */
export function payoffLabelBoxes(trigger: number, maximum: number, others: readonly number[], unit: string, highLabel: string) {
  const box = (center: number, label: string) => ({ label, left: center - label.length * 3.7, right: center + label.length * 3.7 });
  const selected = box(sqrtMeasure(trigger, maximum), `${trigger} ${unit}`);
  const high = { label: highLabel, left: 329 - highLabel.length * 6.8, right: 329 };
  const ticks = others.map(t => box(sqrtMeasure(t, maximum), String(t))).filter(b => b.right + 8 < high.left && (b.right + 8 < selected.left || b.left > selected.right + 8));
  // Long units and extreme strikes may share the right label band; move the selected label up.
  return { selected: { ...selected, left: Math.max(0, selected.left), right: Math.min(329, selected.right), y: selected.right + 8 > high.left ? 143 : 156 }, high: { ...high, y: 156 }, ticks: ticks.map(b => ({ ...b, y: 156 })) };
}
