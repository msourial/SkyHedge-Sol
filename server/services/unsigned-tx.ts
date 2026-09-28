import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "bn.js";
import committedIdl from "../../shared/idl/skyhedge_protection.json";

const PROGRAM_ID = process.env.SKYHEDGE_PROGRAM_ID ?? "5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx";
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export type TxAction = "fund_pool" | "withdraw_liquidity" | "open_position" | "claim_payout" | "claim_premium_refund" | "redeem_closed_liquidity";

export interface UnsignedTxResult { action: TxAction; market: string; wallet: string; base64: string; description: string; programId: string; network: string; }
export type ClaimState = "no_position" | "pending" | "claimable" | "not_claimable" | "claimed" | "expired";
export type ClaimReadiness = {
  market: string;
  wallet: string;
  state: ClaimState;
  action: "claim_payout" | "claim_premium_refund" | null;
  result: string;
  amount: string | null;
  claimDeadline: number | null;
  finalizedSlot: number;
  reason: string;
  observationSignature: string | null;
  resolutionSignature: string | null;
  observation: null | { authority: string; stationIdHash: string; methodologyHash: string; sourceHash: string; rainfallMmX100: string; windowStart: number; windowEnd: number };
};

type ClaimSnapshot = { marketStatus: string; result: string; claimDeadline: number; chainNow: number; payoutClaimed: boolean; refundClaimed: boolean };

export function evaluateClaimReadiness(snapshot: ClaimSnapshot): Pick<ClaimReadiness, "state" | "action" | "reason"> {
  const status = snapshot.marketStatus.toLowerCase();
  const result = snapshot.result.toLowerCase();
  if (snapshot.chainNow > snapshot.claimDeadline) return { state: "expired", action: null, reason: "The on-chain claim deadline has passed." };
  if (status === "settled" && result === "triggered") {
    return snapshot.payoutClaimed
      ? { state: "claimed", action: null, reason: "This position’s payout has already been claimed." }
      : { state: "claimable", action: "claim_payout", reason: "Finalized on-chain settlement confirms this position can claim its fixed payout." };
  }
  if (status === "dataunavailable" && result === "dataunavailable") {
    return snapshot.refundClaimed
      ? { state: "claimed", action: null, reason: "This position’s premium refund has already been claimed." }
      : { state: "claimable", action: "claim_premium_refund", reason: "Finalized on-chain state allows this position to claim its premium refund." };
  }
  if (status === "settled" && result === "nottriggered") return { state: "not_claimable", action: null, reason: "Finalized settlement did not meet the rainfall trigger; no payout is due." };
  return { state: "pending", action: null, reason: "A finalized oracle settlement is not available yet." };
}

export class ClaimUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = "ClaimUnavailableError"; }
}

export class UnsignedTransactionBuilder {
  private readonly connection = new Connection(RPC_URL, "finalized");
  private readonly program: Program;
  private readonly programId = new PublicKey(PROGRAM_ID);
  private mint: PublicKey | null = null;

  constructor() {
    const idl = committedIdl as unknown as Idl;
    const wallet = { publicKey: KeypairFake().publicKey, signTransaction: async (tx: VersionedTransaction) => tx, signAllTransactions: async (txs: VersionedTransaction[]) => txs } as never;
    const provider = new AnchorProvider(this.connection, wallet, { commitment: "finalized", preflightCommitment: "confirmed" });
    this.program = new Program(idl, provider);
  }

  async build(action: TxAction, marketAddress: string, walletAddress: string, amount?: string): Promise<UnsignedTxResult> {
    const market = new PublicKey(marketAddress);
    const wallet = new PublicKey(walletAddress);
    const protocolAddress = PublicKey.findProgramAddressSync([Buffer.from("protocol")], this.programId)[0];
    const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], this.programId);
    const accounts = this.program.account as unknown as Record<string, { fetch: (address: PublicKey) => Promise<Record<string, unknown>> }>;
    const protocol = (await accounts["protocolConfig"].fetch(protocolAddress)) as unknown as { collateralMint: PublicKey };
    this.mint = new PublicKey(protocol.collateralMint);
    const tokenProgram = TOKEN_PROGRAM_ID;

    const common = { market, vault, collateralMint: this.mint, tokenProgram };
    let tx: Transaction;

    switch (action) {
      case "fund_pool":
      case "withdraw_liquidity": {
        const providerTokenAccount = await getAssociatedTokenAddress(this.mint, wallet);
        const [liquidityPosition] = PublicKey.findProgramAddressSync([Buffer.from("liquidity"), market.toBuffer(), wallet.toBuffer()], this.programId);
        const amountBn = requireAmount(action, amount);
        tx = action === "fund_pool"
          ? await this.program.methods.fundPool(amountBn).accounts({ provider: wallet, protocol: protocolAddress, market, vault, providerTokenAccount, liquidityPosition, collateralMint: this.mint, tokenProgram }).transaction()
          : await this.program.methods.withdrawLiquidity(amountBn).accounts({ provider: wallet, protocol: protocolAddress, market, vault, providerTokenAccount, liquidityPosition, collateralMint: this.mint, tokenProgram }).transaction();
        return this.finalize(action, marketAddress, walletAddress, tx, `${action === "fund_pool" ? "Fund" : "Withdraw"} ${amount} SKYT ${action === "fund_pool" ? "into" : "from"} the market pool`);
      }
      case "open_position": {
        const ownerTokenAccount = await getAssociatedTokenAddress(this.mint, wallet);
        const [position] = PublicKey.findProgramAddressSync([Buffer.from("position"), market.toBuffer(), wallet.toBuffer()], this.programId);
        const protectedAmount = requireAmount(action, amount);
        tx = await this.program.methods.openPosition(protectedAmount).accounts({ owner: wallet, protocol: protocolAddress, market, vault, ownerTokenAccount, position, collateralMint: this.mint, tokenProgram }).transaction();
        return this.finalize(action, marketAddress, walletAddress, tx, `Buy ${amount} SKYT of rainfall coverage (fixed payout)`);
      }
      case "claim_payout":
      case "claim_premium_refund": {
        const readiness = await this.readClaimReadiness(marketAddress, walletAddress);
        if (readiness.state !== "claimable" || readiness.action !== action) throw new ClaimUnavailableError(readiness.reason);
        const ownerTokenAccount = await getAssociatedTokenAddress(this.mint, wallet);
        const [position] = PublicKey.findProgramAddressSync([Buffer.from("position"), market.toBuffer(), wallet.toBuffer()], this.programId);
        tx = action === "claim_payout"
          ? await this.program.methods.claimPayout().accounts({ owner: wallet, protocol: protocolAddress, market, vault, position, ownerTokenAccount, collateralMint: this.mint, tokenProgram }).transaction()
          : await this.program.methods.claimPremiumRefund().accounts({ owner: wallet, protocol: protocolAddress, market, vault, position, ownerTokenAccount, collateralMint: this.mint, tokenProgram }).transaction();
        return this.finalize(action, marketAddress, walletAddress, tx, action === "claim_payout" ? "Claim triggered-market payout" : "Claim premium refund (DATA_UNAVAILABLE market)");
      }
      case "redeem_closed_liquidity": {
        const providerTokenAccount = await getAssociatedTokenAddress(this.mint, wallet);
        const [liquidityPosition] = PublicKey.findProgramAddressSync([Buffer.from("liquidity"), market.toBuffer(), wallet.toBuffer()], this.programId);
        tx = await this.program.methods.redeemClosedLiquidity().accounts({ provider: wallet, protocol: protocolAddress, market, vault, liquidityPosition, providerTokenAccount, collateralMint: this.mint, tokenProgram }).transaction();
        return this.finalize(action, marketAddress, walletAddress, tx, "Redeem closed-market liquidity");
      }
    }
  }

  async readClaimReadiness(marketAddress: string, walletAddress: string): Promise<ClaimReadiness> {
    const market = new PublicKey(marketAddress);
    const wallet = new PublicKey(walletAddress);
    const finalizedSlot = await this.connection.getSlot("finalized");
    const accounts = this.program.account as unknown as Record<string, {
      fetch: (address: PublicKey) => Promise<Record<string, unknown>>;
      fetchNullable: (address: PublicKey) => Promise<Record<string, unknown> | null>;
    }>;
    const marketState = await accounts.market.fetch(market) as unknown as {
      status: unknown; result: unknown; claimDeadline: BNInstance;
    };
    const [positionAddress] = PublicKey.findProgramAddressSync([Buffer.from("position"), market.toBuffer(), wallet.toBuffer()], this.programId);
    const position = await accounts.protectionPosition.fetchNullable(positionAddress) as unknown as {
      owner: PublicKey; payoutClaimed: boolean; refundClaimed: boolean; potentialPayout: BNInstance; premiumPaid: BNInstance;
    } | null;
    const result = enumTag(marketState.result);
    const marketStatus = enumTag(marketState.status);
    const deadline = marketState.claimDeadline.toNumber();
    const chainNow = await this.connection.getBlockTime(finalizedSlot);
    const observationAddress = PublicKey.findProgramAddressSync([Buffer.from("settlement"), market.toBuffer()], this.programId)[0];
    const observationRaw = await accounts.settlementObservation.fetchNullable(observationAddress) as unknown as {
      authority: PublicKey; stationIdHash: number[]; methodologyHash: number[]; sourceHash: number[];
      cumulativeRainfallMmX100: BNInstance; observationWindowStart: BNInstance; observationWindowEnd: BNInstance;
    } | null;
    const observation = observationRaw ? {
      authority: observationRaw.authority.toBase58(),
      stationIdHash: Buffer.from(observationRaw.stationIdHash).toString("hex"),
      methodologyHash: Buffer.from(observationRaw.methodologyHash).toString("hex"),
      sourceHash: Buffer.from(observationRaw.sourceHash).toString("hex"),
      rainfallMmX100: observationRaw.cumulativeRainfallMmX100.toString(),
      windowStart: observationRaw.observationWindowStart.toNumber(),
      windowEnd: observationRaw.observationWindowEnd.toNumber(),
    } : null;
    const observationSignatures = observationRaw
      ? await this.connection.getSignaturesForAddress(observationAddress, { limit: 5 }, "finalized")
      : [];
    const expectedResolutionInstruction = marketStatus === "settled" ? "SettleMarket" : marketStatus === "dataunavailable" ? "MarkDataUnavailable" : null;
    const marketSignatures = expectedResolutionInstruction
      ? await this.connection.getSignaturesForAddress(market, { limit: 25 }, "finalized")
      : [];
    let resolutionSignature: string | null = null;
    for (const info of marketSignatures) {
      if (info.err) continue;
      const transaction = await this.connection.getTransaction(info.signature, { commitment: "finalized", maxSupportedTransactionVersion: 0 });
      if (hasInstructionLog(transaction?.meta?.logMessages, expectedResolutionInstruction!)) {
        resolutionSignature = info.signature;
        break;
      }
    }
    const observationSignature = observationSignatures.find((info) => !info.err)?.signature ?? null;
    if (!position) return {
      market: market.toBase58(), wallet: wallet.toBase58(), state: "no_position", action: null, result,
      amount: null, claimDeadline: deadline, finalizedSlot,
      reason: "No finalized protection position exists for this wallet and market.", observation,
      observationSignature, resolutionSignature,
    };
    if (!position.owner.equals(wallet)) throw new ClaimUnavailableError("The finalized position owner does not match the connected wallet.");
    if (chainNow === null) return {
      market: market.toBase58(), wallet: wallet.toBase58(), state: "pending", action: null, result,
      amount: null, claimDeadline: deadline, finalizedSlot,
      reason: "The finalized RPC did not provide a chain timestamp; claim readiness cannot be confirmed.", observation,
      observationSignature, resolutionSignature,
    };
    const evaluated = evaluateClaimReadiness({ marketStatus, result, claimDeadline: deadline, chainNow, payoutClaimed: position.payoutClaimed, refundClaimed: position.refundClaimed });
    return {
      market: market.toBase58(), wallet: wallet.toBase58(), ...evaluated, result,
      amount: evaluated.action === "claim_payout" ? position.potentialPayout.toString() : evaluated.action === "claim_premium_refund" ? position.premiumPaid.toString() : null,
      claimDeadline: deadline, finalizedSlot, observation,
      observationSignature, resolutionSignature,
    };
  }

  private async finalize(action: TxAction, market: string, wallet: string, tx: Transaction, description: string): Promise<UnsignedTxResult> {
    tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    tx.feePayer = new PublicKey(wallet);
    const message = tx.compileMessage();
    const versioned = new VersionedTransaction(message);
    return { action, market, wallet, base64: Buffer.from(versioned.serialize()).toString("base64"), description, programId: PROGRAM_ID, network: process.env.SOLANA_NETWORK ?? "devnet" };
  }
}

type BNInstance = InstanceType<typeof BN>;

function requireAmount(action: TxAction, amount: string | undefined): BNInstance {
  if (!amount) throw new Error(`${action} requires an amount in SKYT base units`);
  if (!/^\d+$/.test(amount)) throw new Error(`${action} amount must be a positive integer`);
  const value = new BN(amount);
  if (value.isZero()) throw new Error(`${action} amount must be greater than zero`);
  if (value.gt(new BN("1000000000000000000"))) throw new Error(`${action} amount exceeds the maximum supported size`);
  return value;
}

function enumTag(value: unknown): string {
  if (typeof value === "string") return value.replaceAll(/[_-]/g, "").toLowerCase();
  if (value && typeof value === "object") return Object.keys(value)[0]?.replaceAll(/[_-]/g, "").toLowerCase() ?? "unknown";
  return "unknown";
}

/** Anchor versions emit instruction names as snake_case or CamelCase in logs. */
export function hasInstructionLog(logs: string[] | null | undefined, instruction: string): boolean {
  const expected = normalizeInstructionName(instruction);
  return Boolean(expected) && Boolean(logs?.some((line) => normalizeInstructionName(line).includes(expected)));
}

function normalizeInstructionName(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

function KeypairFake() {
  return { publicKey: PublicKey.unique() };
}
