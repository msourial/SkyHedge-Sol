export type SettlementWorkerConfig = {
  signerConfigured: boolean;
  noaaConfigured: boolean;
  cronSecret?: string;
};

/** Public health summary; never returns secret values. */
export function settlementWorkerReadiness(config: SettlementWorkerConfig) {
  const cronAuthConfigured = Boolean(config.cronSecret && config.cronSecret.length >= 16);
  const configured = config.signerConfigured && config.noaaConfigured && cronAuthConfigured;
  return {
    status: configured ? "configured" as const : "manual-or-missing" as const,
    scheduler: "vercel-cron" as const,
    signerConfigured: config.signerConfigured,
    noaaConfigured: config.noaaConfigured,
    cronAuthConfigured,
  };
}
