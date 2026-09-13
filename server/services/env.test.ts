import { expect } from "chai";
import { loadEnv } from "../env";

describe("server environment", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSkytMint = process.env.SKYT_MINT;
  const originalSettlementKeypair = process.env.SETTLEMENT_AUTHORITY_KEYPAIR;

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalSkytMint === undefined) delete process.env.SKYT_MINT;
    else process.env.SKYT_MINT = originalSkytMint;
    if (originalSettlementKeypair === undefined) delete process.env.SETTLEMENT_AUTHORITY_KEYPAIR;
    else process.env.SETTLEMENT_AUTHORITY_KEYPAIR = originalSettlementKeypair;
  });

  it("does not require PostgreSQL for the Devnet V1 launch path", () => {
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = "development";
    const env = loadEnv();
    expect(env.databaseUrl).to.equal(null);
    expect(env.network).to.equal("devnet");
  });

  it("keeps public production startup truthful when worker-only env is absent", () => {
    delete process.env.DATABASE_URL;
    delete process.env.SKYT_MINT;
    delete process.env.SETTLEMENT_AUTHORITY_KEYPAIR;
    process.env.NODE_ENV = "production";
    const env = loadEnv();
    expect(env.databaseUrl).to.equal(null);
    expect(env.skytMint).to.equal(null);
    expect(env.settlementKeypairPath).to.equal(null);
  });
});
