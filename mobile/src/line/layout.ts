/** Protect geometry at the default font scale; shared with native layout checks. */
export const protectLayout = {
  margin: 16, header: 56, subline: 26, tabs: 56, heroGap: 8, hero: 144,
  chainGap: 16, chainHeader: 32, chainRow: 56, bar: 88,
  columns: [156, 66, 62, 77], readoutX: 104, lineEndX: 96,
} as const;
export function protectChainRowBottom(rowCount: number): number {
  const p = protectLayout;
  return p.header + p.subline + p.tabs + p.heroGap + p.hero + p.chainGap + p.chainHeader + rowCount * p.chainRow;
}
