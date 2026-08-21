import { BaseWalletAdapter, WalletReadyState } from "@solana/wallet-adapter-base";
import { Keypair, PublicKey } from "@solana/web3.js";
import type { Transaction, TransactionVersion, VersionedTransaction } from "@solana/web3.js";
import type { WalletName } from "@solana/wallet-adapter-base";

/**
 * Dev-only wallet for the localnet demo. Inert unless VITE_DEMO_WALLET=1 and
 * VITE_DEMO_SECRET (JSON array of a keypair secret) are set at build/dev time.
 * The keypair only exists on localnet — it is never valid on devnet or mainnet.
 */
const enabled = import.meta.env.VITE_DEMO_WALLET === "1";
const secretRaw: string = import.meta.env.VITE_DEMO_SECRET ?? "";

function loadKeypair(): Keypair | null {
  if (!enabled || !secretRaw) return null;
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretRaw) as number[]));
  } catch {
    return null;
  }
}

export class DemoWalletAdapter extends BaseWalletAdapter {
  name = "SkyHedge Demo (Localnet)" as WalletName<"SkyHedge Demo (Localnet)">;
  url = "https://skyhedge.finance";
  icon = "";

  private _keypair: Keypair | null = loadKeypair();
  private _publicKey: PublicKey | null = this._keypair ? this._keypair.publicKey : null;

  get supportedTransactionVersions(): ReadonlySet<TransactionVersion> {
    return new Set(["legacy", 0]);
  }

  get publicKey(): PublicKey | null {
    return this._publicKey;
  }

  get readyState(): WalletReadyState {
    return this._keypair ? WalletReadyState.Installed : WalletReadyState.Unsupported;
  }

  get connecting(): boolean {
    return false;
  }

  get connected(): boolean {
    return this._publicKey !== null;
  }

  async connect(): Promise<void> {
    if (!this._keypair) throw new Error("Demo wallet is not configured for this build.");
    this._publicKey = this._keypair.publicKey;
    this.emit("connect", this._publicKey);
  }

  async disconnect(): Promise<void> {
    this._publicKey = null;
    this.emit("disconnect");
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    if (!this._keypair) throw new Error("Demo wallet is not configured for this build.");
    const versioned = transaction as VersionedTransaction;
    if (typeof versioned.sign === "function") {
      versioned.sign([this._keypair]);
    } else {
      (transaction as Transaction).partialSign(this._keypair);
    }
    return transaction;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> {
    for (const transaction of transactions) await this.signTransaction(transaction);
    return transactions;
  }

  async sendTransaction(transaction: Transaction, connection: unknown, options?: unknown): Promise<string> {
    const { sendAndConfirmTransaction } = await import("@solana/web3.js");
    if (!this._keypair) throw new Error("Demo wallet is not configured for this build.");
    return sendAndConfirmTransaction(connection as never, transaction, [this._keypair], options as never);
  }
}
