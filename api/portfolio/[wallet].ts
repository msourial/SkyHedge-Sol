import type { IncomingMessage, ServerResponse } from "node:http";
import { PublicKey } from "@solana/web3.js";

type ApiRequest = IncomingMessage & { query?: Record<string, string | string[]> };
type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

export function createPortfolioHandler() {
  return function portfolioHandler(req: ApiRequest, res: ApiResponse) {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED", message: "Use GET for portfolio status." });
    }
    const value = req.query?.wallet;
    const wallet = Array.isArray(value) ? value[0] : value;
    let canonicalWallet: string;
    try {
      if (!wallet) throw new Error("Missing wallet");
      canonicalWallet = new PublicKey(wallet).toBase58();
    } catch {
      return res.status(400).json({ error: "INVALID_WALLET", message: "A valid Solana wallet address is required." });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      wallet: canonicalWallet,
      source: "not-indexed",
      indexed: false,
      protections: [],
      liquidity: [],
      message: "Finalized portfolio positions are not indexed on this deployment yet. An empty list is not proof that the wallet has no on-chain positions.",
    });
  };
}

export default createPortfolioHandler();
