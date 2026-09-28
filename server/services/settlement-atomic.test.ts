import { expect } from "chai";
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { submitObservationAndSettlementAtomically } from "./settlement";

describe("atomic oracle settlement submission", () => {
  it("confirms observation and deterministic settlement together in one finalized transaction", async () => {
    const authority = Keypair.generate();
    const programId = new PublicKey("11111111111111111111111111111111");
    const observation = new TransactionInstruction({ programId, keys: [], data: Buffer.from([1]) });
    const settlement = new TransactionInstruction({ programId, keys: [], data: Buffer.from([2]) });
    let sent: Transaction | null = null;
    let signers: Keypair[] = [];
    let options: { commitment?: string; preflightCommitment?: string } | undefined;

    const signature = await submitObservationAndSettlementAtomically({
      sendAndConfirm: async (transaction, transactionSigners, transactionOptions) => {
        sent = transaction as Transaction;
        signers = transactionSigners as Keypair[];
        options = transactionOptions;
        return "finalized-signature";
      },
    }, observation, settlement, authority);

    expect(signature).to.equal("finalized-signature");
    expect(sent?.instructions.map((instruction) => [...instruction.data])).to.deep.equal([[1], [2]]);
    expect(signers.map((signer) => signer.publicKey.toBase58())).to.deep.equal([authority.publicKey.toBase58()]);
    expect(options).to.include({ commitment: "finalized", preflightCommitment: "confirmed" });
  });
});
