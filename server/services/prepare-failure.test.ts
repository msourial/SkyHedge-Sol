import { expect } from "chai";
import { prepareRpcUrls } from "./rpc-failover";
import { prepareFailure } from "../../shared/prepare-failure";
import { committedWindowLabel } from "../../shared/window-chain";

const WEEKLY = {
  address: "4MVypmwGhpNTvLhpEUTPu6AHEXL5aRzuprkPWT9o6ygq",
  observationStart: Date.parse("2026-10-26T00:00:00Z") / 1000,
  observationEnd: Date.parse("2026-11-02T00:00:00Z") / 1000,
  thresholdMmX100: "6900",
};

describe("unsigned prepare", () => {
  it("names a busy Devnet and keeps the RPC error as detail", () => {
    expect(prepareFailure(new Error("429 Too Many Requests"))).to.deep.equal({
      message: "Devnet is busy, try again",
      detail: "429 Too Many Requests",
    });
    expect(prepareFailure(new Error("That city window’s sales window is closed.")).message).to.equal("This window just closed");
  });

  it("tries the official Devnet RPC before a configured endpoint", () => {
    expect(prepareRpcUrls("https://solana-devnet.api.onfinality.io/public")[0]).to.equal("https://api.devnet.solana.com");
    expect(prepareRpcUrls("https://solana-devnet.api.onfinality.io/public")).to.have.length(2);
  });

  it("tries a private Devnet RPC first so a rate-limited public endpoint cannot block prepare", () => {
    expect(prepareRpcUrls("https://devnet.helius-rpc.com/?api-key=test")).to.deep.equal(["https://devnet.helius-rpc.com/?api-key=test", "https://api.devnet.solana.com", "https://solana-devnet.api.onfinality.io/public"]);
    expect(prepareRpcUrls(undefined)[0]).to.equal("https://api.devnet.solana.com");
  });

  it("uses the selling New York weekly account dates for the quote and the sheet", () => {
    expect(committedWindowLabel(WEEKLY)).to.equal("Oct 26 – Nov 2");
    expect(new Date(WEEKLY.observationStart * 1000).toISOString().slice(0, 10)).to.equal("2026-10-26");
    expect(new Date(WEEKLY.observationEnd * 1000).toISOString().slice(0, 10)).to.equal("2026-11-02");
    expect(Number(WEEKLY.thresholdMmX100) / 100).to.equal(69);
    expect(WEEKLY.address).to.equal("4MVypmwGhpNTvLhpEUTPu6AHEXL5aRzuprkPWT9o6ygq");
  });
});
