import { randomUUID } from "node:crypto";

export interface GovernanceProposal {
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
}

export interface GovernanceVoteInput {
  proposalId: string;
  support: boolean;
}

const SEED: Array<{ poolId: string; title: string; description: string; yes: number; no: number; deadlineDays: number }> = [
  { poolId: "mumbai-call", title: "Raise max liquidity on the Mumbai monsoon call chain", description: "The 111.5mm strike reached its exposure cap mid-window. Increase maxLiquidity by 25% for the next monsoon cycle so hedgers are never priced out.", yes: 184, no: 31, deadlineDays: 4 },
  { poolId: "new-york-call", title: "Add a 120mm deep-out-of-the-money strike to the NYC chain", description: "Requested by logistics operators hedging event washouts. New strike at 120mm, same premium model, no change to existing contracts.", yes: 96, no: 58, deadlineDays: 7 },
  { poolId: "generic", title: "Publish settlement evidence on-chain before the observation close", description: "Currently evidence is committed after close. Moving evidence publication 24h earlier reduces dispute risk without changing the final value rule.", yes: 221, no: 12, deadlineDays: 2 },
];

export class GovernanceStore {
  private proposals: GovernanceProposal[] = SEED.map((s, i) => ({
    id: String(i + 1),
    poolId: s.poolId,
    title: s.title,
    description: s.description,
    yes: s.yes,
    no: s.no,
    votes: s.yes + s.no,
    status: "active",
    deadlineMs: Date.now() + s.deadlineDays * 86_400_000,
    createdAt: new Date(Date.now() - (s.deadlineDays + 2) * 86_400_000).toISOString(),
  }));

  list(): GovernanceProposal[] {
    const now = Date.now();
    return this.proposals
      .map((p) => (p.status === "active" && p.deadlineMs < now ? { ...p, status: (p.yes > p.no ? "passed" : "failed") as GovernanceProposal["status"] } : p))
      .sort((a, b) => b.deadlineMs - a.deadlineMs);
  }

  create(poolId: string, title: string, description: string): GovernanceProposal {
    const proposal: GovernanceProposal = {
      id: randomUUID().slice(0, 8),
      poolId,
      title,
      description,
      yes: 0,
      no: 0,
      votes: 0,
      status: "active",
      deadlineMs: Date.now() + 7 * 86_400_000,
      createdAt: new Date().toISOString(),
    };
    this.proposals.push(proposal);
    return proposal;
  }

  vote(input: GovernanceVoteInput): GovernanceProposal | null {
    const p = this.proposals.find((x) => x.id === input.proposalId);
    if (!p || p.status !== "active") return null;
    if (input.support) p.yes += 1;
    else p.no += 1;
    p.votes += 1;
    return p;
  }
}