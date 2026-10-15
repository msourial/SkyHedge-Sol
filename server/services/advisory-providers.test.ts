import { expect } from "chai";
import { AdvisoryNotConfiguredError, DEFAULT_OPENROUTER_MODEL, extractProtectionIntent } from "./advisory";

const intent = { place: "Des Moines", useCase: "farming", hazard: "rainfall", direction: "above", date: null, amount: null, amountUnit: null, requestedThresholdMm: null };
const realFetch = globalThis.fetch;
const saved = { ...process.env };
type Call = { url: string; init: RequestInit };

function mockFetch(handler: (url: string) => Response | Promise<Response>, calls: Call[]) {
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => { calls.push({ url: String(url), init: init ?? {} }); return handler(String(url)); }) as typeof fetch;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("advisory providers", () => {
  beforeEach(() => { delete process.env.OPENROUTER_API_KEY; delete process.env.OPENROUTER_MODEL; delete process.env.ANTHROPIC_API_KEY; });
  afterEach(() => { globalThis.fetch = realFetch; process.env = { ...saved }; });

  it("uses OpenRouter first with the documented headers and default model", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-test"; process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const calls: Call[] = [];
    mockFetch(() => json({ choices: [{ message: { content: "```json\n" + JSON.stringify(intent) + "\n```" } }] }), calls);
    expect(await extractProtectionIntent("Des Moines farm, too much rain")).to.deep.equal(intent);
    expect(calls).to.have.length(1);
    expect(calls[0].url).to.equal("https://openrouter.ai/api/v1/chat/completions");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.authorization).to.equal("Bearer sk-or-v1-test");
    expect(headers["HTTP-Referer"]).to.equal("https://skyhedge.app");
    expect(headers["X-Title"]).to.equal("SkyHedge");
    expect(JSON.parse(String(calls[0].init.body)).model).to.equal(DEFAULT_OPENROUTER_MODEL);
  });

  it("honours OPENROUTER_MODEL", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-test"; process.env.OPENROUTER_MODEL = "anthropic/claude-sonnet-4.5";
    const calls: Call[] = [];
    mockFetch(() => json({ choices: [{ message: { content: JSON.stringify(intent) } }] }), calls);
    await extractProtectionIntent("Des Moines rain");
    expect(JSON.parse(String(calls[0].init.body)).model).to.equal("anthropic/claude-sonnet-4.5");
  });

  it("falls back to Anthropic when OpenRouter fails", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-test"; process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const calls: Call[] = [];
    mockFetch((url) => url.includes("openrouter") ? json({ error: "x" }, 500) : json({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(intent) }] }), calls);
    expect(await extractProtectionIntent("Des Moines rain")).to.deep.equal(intent);
    expect(calls.map((c) => c.url)).to.deep.equal(["https://openrouter.ai/api/v1/chat/completions", "https://api.anthropic.com/v1/messages"]);
  });

  it("rejects invalid model output and reports not-configured with no keys", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-test";
    mockFetch(() => json({ choices: [{ message: { content: "{\"place\":\"x\",\"quote\":1}" } }] }), []);
    let failed = false;
    try { await extractProtectionIntent("rain"); } catch { failed = true; }
    expect(failed).to.equal(true);
    delete process.env.OPENROUTER_API_KEY;
    let err: unknown;
    try { await extractProtectionIntent("rain"); } catch (e) { err = e; }
    expect(err).to.be.instanceOf(AdvisoryNotConfiguredError);
  });
});
