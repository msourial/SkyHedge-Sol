import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "bn.js";
import * as fs from "node:fs";
import * as path from "node:path";

const PROGRAM_ID = process.env.SKYHEDGE_PROGRAM_ID ?? "7thTyPBaVCEBL2z28ojTxfmrbNMydXV3EAgbYgrz7GKr";
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export type TxAction = "fund_pool" | "withdraw_liquidity" | "open_position" | "claim_payout" | "claim_premium_refund" | "redeem_closed_liquidity";

export interface UnsignedTxResult { action: TxAction; market: string; wallet: string; base64: string; description: string; programId: string; network: string; }

export class UnsignedTransactionBuilder {
  private readonly connection = new Connection(RPC_URL, "confirmed");
  private readonly program: Program;
  private readonly programId = new PublicKey(PROGRAM_ID);
  private mint: PublicKey | null = null;

  constructor() {
    const idl = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "shared/idl/skyhedge_protection.json"), "utf8")) as Idl;
    const wallet = { publicKey: KeypairFake().publicKey, signTransaction: async (tx: VersionedTransaction) => tx, signAllTransactions: async (txs: VersionedTransaction[]) => txs } as never;
    const provider = new AnchorProvider(this.connection, wallet, { commitment: "confirmed" });
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

function KeypairFake() {
  return { publicKey: PublicKey.unique() };
}