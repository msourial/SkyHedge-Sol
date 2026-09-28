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

export type ClaimReadiness = {
  market: string;
  wallet: string;
  state: "no_position" | "pending" | "claimable" | "not_claimable" | "claimed" | "expired";
  action: "claim_payout" | "claim_premium_refund" | null;
  result: string;
  amount: string | null;
  claimDeadline: number | null;
  finalizedSlot: number;
  reason: string;
  observationSignature: string | null;
  resolutionSignature: string | null;
  observation: null | {
    authority: string;
    stationIdHash: string;
    methodologyHash: string;
    sourceHash: string;
    rainfallMmX100: string;
    windowStart: number;
    windowEnd: number;
  };
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

export type DevnetStatus = {
  network: string;
  program: { address: string; status: "ready" | "pending" | "unavailable" | "error"; executable: boolean; explorerUrl: string };
  idl: { status: "ready" | "pending" | "unavailable" | "error"; source: string; instructionCount: number; accountCount: number };
  protocol: { address: string; status: "ready" | "pending" | "unavailable" | "error"; initialized: boolean; admin: string | null; settlementAuthority: string | null; collateralMint: string | null; nextMarketId: string | null };
  feeVault: { address: string; status: "ready" | "pending" | "unavailable" | "error"; exists: boolean; balance: string | null };
  skytMint: { address: string; status: "ready" | "pending" | "unavailable" | "error"; exists: boolean; decimals: number | null; supply: string | null; mintAuthority: string | null };
  desMoinesMarket: { status: "ready" | "pending" | "unavailable" | "error"; address: string | null; marketId: string | null; vault: string | null; vaultBalance: string | null; onchainStatus: string | null; salesCloseAt: number | null; observationStart: number | null; observationEnd: number | null; thresholdMmX100: string | null; operator: "gt" | "gte" | "lt" | "lte" | null; quoteProbabilityBps: number | null; premiumRateBps: number | null; quoteInputsHash: string | null; evidenceStatus: "researching_evidence" | "validated"; targetCityHash: string };
  noaaEvidence: { status: "ready" | "pending" | "unavailable"; settlementSource: "NOAA"; message: string; package: { stationId: string; seedSchedule: { salesCloseAt: number; observationStart: number; observationEnd: number }; quoteTerms: null | { probabilityBps: number; premiumRateBps: number; inputsHash: string }; evidence: { sourceHash: string; cumulativeMm: number | null; windowStart: string; windowEnd: string } } | null };
  generatedAt: string;
};

export type HealthResponse = {
  status: "ok" | "degraded";
  network?: string;
  checks?: {
    settlement?: {
      status: "configured" | "manual-or-missing";
      scheduler: "vercel-cron";
      signerConfigured: boolean;
      noaaConfigured: boolean;
      cronAuthConfigured: boolean;
    };
  };
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
