/** Approved Protect v2 geometry at 393dp, excluding status and navigation. */
export const protectLayout = {
  margin: 16, header: 56, subline: 12, tabs: 56, tabsGap: 10,
  heroGap: 10, hero: 296, chainGap: 10, chainHeader: 32, chainRow: 52,
  chainBottom: 4, bar: 99, columns: [1.25, 1.15, .8, 1],
} as const;
export function protectChainRowBottom(rowCount: number): number {
  const p = protectLayout;
  return p.header + p.subline + p.tabsGap + p.tabs + p.heroGap + p.hero + p.chainGap + p.chainHeader + rowCount * p.chainRow + p.chainBottom;
}
