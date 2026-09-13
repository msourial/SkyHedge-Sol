import { expect } from "chai";
import { WeatherXmProvider } from "./weatherxm";

describe("WeatherXM Agent API context", () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.WEATHERXM_AGENT_BASE_URL;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.WEATHERXM_AGENT_BASE_URL;
    else process.env.WEATHERXM_AGENT_BASE_URL = originalBaseUrl;
  });

  it("uses only the free health endpoint for supplemental context", async () => {
    const calls: string[] = [];
    process.env.WEATHERXM_AGENT_BASE_URL = "https://agent.weatherxm.test";
    globalThis.fetch = (async (input: string | URL | Request) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    const context = await new WeatherXmProvider().context("des-moines");

    expect(calls).to.deep.equal(["https://agent.weatherxm.test/api/health"]);
    expect(context.settlementEligible).to.equal(false);
    expect(context.agent.freeEndpoint).to.equal("/api/health");
    expect(context.agent.paidEndpoints).to.deep.equal(["/api/current", "/api/forecast", "/api/history"]);
    expect(context.status).to.equal("AGENT_HEALTH_OK_OBSERVATIONS_PAID");
  });
});
