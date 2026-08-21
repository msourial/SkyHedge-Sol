export type Market = {
  id: string;
  marketId?: string;
  city: string;
  state?: string;
  stationId: string;
  status: string;
  thresholdMmX100?: string;
  premiumRateBps?: number;
  totalShares?: string;
  salesCloseAt?: number;
  observationStart?: number;
  observationEnd?: number;
  maxLiquidity: string;
  maxExposure: string;
  perWalletMax: string;
  indexed?: boolean;
};

export type Quote = {
  probabilityBps: number;
  premiumRateBps: number;
  premium: string;
  protocolFee: string;
  protectedAmount: string;
  modelVersion: string;
  inputsHash: string;
};

export type WeatherResponse = {
  cumulativeMm: number;
  records: Array<{ date: string; millimeters: number }>;
  source: string;
  stationId: string;
};

export type Portfolio = {
  wallet: string;
  indexed: boolean;
  protections: Array<{ market: string; address: string; protectedAmount: string; premiumPaid: string }>;
  liquidity: Array<{ market: string; address: string; shares: string }>;
  message?: string;
};

export type UnsignedTx = {
  action: string;
  market: string;
  wallet: string;
  base64: string;
  description: string;
  programId: string;
  network: string;
};

export type EvidenceRow = {
  id: number;
  sourceHash: string;
  marketAddress: string | null;
  city: string;
  windowStart: string;
  windowEnd: string;
  verdict: string;
  noaaMm: string | null;
  wxmMm: string | null;
  deltaMm: string | null;
  toleranceMm: string | null;
  generatedAt: string;
};

export type CityIndexState = {
  slug: string;
  name: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  stationName: string;
  coverageTier: "A" | "B" | "C";
  metric: "cumulative_rainfall_mm";
  currentWindow: { start: string; end: string; daysElapsed: number; daysTotal: number; progressPct: number };
  cumulativeMm: number | null;
  observedThrough: string | null;
  windowNormalMm: number;
  probabilitySource: "noaa-10yr" | "climatology-prior" | "none";
  weeklyHistoryMm: Array<{ week: string; mm: number | null }> | null;
};

export type CitySearchResult = {
  slug: string;
  name: string;
  country: string;
  countryCode: string;
  stationId: string;
  score: number;
  match: string;
};

export type ChainCell = {
  side: "call" | "put";
  strikeMm: number;
  expiry: string;
  marketAddress: string | null;
  status: string | null;
  premiumRateBps: number | null;
  quoteProbabilityBps: number | null;
  totalShares: string | null;
  daysToExpiry: number | null;
  bidBps: number | null;
  askBps: number | null;
  thetaBps: number | null;
};

export type ChainGrid = {
  city: string;
  windows: Array<{ start: string; end: string; isLive: boolean; normalMm: number }>;
  strikes: number[];
  cells: ChainCell[];
  probabilitySource: "noaa-10yr" | "climatology-prior";
};

export type PortfolioStats = {
  wallet: string;
  totalValue: string;
  totalPnl: string;
  dayChange: string;
  openPositions: number;
  protectionsCount: number;
  liquidityCount: number;
  liquidityValue: string;
  protections: Array<{
    market: string;
    address: string;
    city: string | null;
    side: "call" | "put" | null;
    strikeMm: number | null;
    daysToExpiry: number | null;
    protectedAmount: string;
    premiumPaid: string;
    fairValue: string;
    pnl: string;
    dayChange: string;
    open: boolean;
  }>;
  liquidity: Array<{ market: string; address: string; shares: string; open: boolean }>;
};

export type StakingPool = {
  id: string;
  name: string;
  city: string | null;
  side: "call" | "put" | null;
  strikeMm: number | null;
  premiumRateBps: number | null;
  totalShares: string;
  tvl: string;
  apyPct: number;
  lockDays: number | null;
  minStake: string;
  status: "open" | "closed";
};

export type StakingUserState = {
  wallet: string;
  totalStaked: string;
  totalRewards: string;
  poolCount: number;
  stakes: Array<{
    market: string;
    address: string;
    name: string | null;
    city: string | null;
    side: "call" | "put" | null;
    strikeMm: number | null;
    shares: string;
    rewards: string;
    lockDays: number | null;
    lockEndMs: number | null;
    open: boolean;
  }>;
};

export type InsightFactor = {
  city: string;
  cityName: string;
  factor: "wet" | "dry" | "neutral";
  deviationPct: number;
  observedMm: number | null;
  normalMm: number;
  source: "noaa-observed" | "climatology-prior";
};

export type AiInsights = {
  generatedAt: string;
  factors: InsightFactor[];
  top: InsightFactor[];
};

export type AiAccuracy = {
  model: string;
  strategy: string;
  winRate: number;
  riskReward: number;
  sampleSize: number;
  lastUpdated: string;
  displayOnly: boolean;
  metrics: Array<{ label: string; value: string }>;
};

export type AdvisorPlan = {
  city: string;
  risk: "excess-rain" | "low-rain";
  thresholdMm: number;
  protectedAmount: string;
  reasoning: string;
  confidence: number;
};

export type ParseTradeResult = {
  source: "llm" | "rule";
  confidence: number;
  parameters: AdvisorPlan;
  recommendation: { slug: string; strikeMm: number; side: "call" | "put" } | null;
  response: string;
};

export type GovernanceProposal = {
  id: string;
  poolId: string;
  title: string;
  description: string;
  yes: number;
  no: number;
  votes: number;
  status: "active" | "passed" | "failed";
  deadlineMs: number;
  createdAt: string;
};