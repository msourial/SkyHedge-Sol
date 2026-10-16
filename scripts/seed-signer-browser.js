import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

window.SkyHedgeSeedSigner = {
  async run(payload) {
    const logEl = document.getElementById("log");
    const log = (m) => {
      logEl.textContent += `${m}\n`;
      console.log(m);
    };
    const post = async (body) =>
      fetch("/result", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

    const provider = window.phantom?.solana ?? window.solana;
    if (!provider?.connect || !provider?.signAndSendTransaction) {
      log("No Solana wallet provider on this page. Unlock Phantom in this browser, then click Start.");
      await post({ error: "Wallet provider not found (non-fatal)" });
      return;
    }
    try {
      const { publicKey } = await provider.connect();
      log(`connected ${publicKey.toString()}`);
      if (publicKey.toString() !== payload.expectedAdmin) {
        throw new Error(`wrong wallet ${publicKey.toString()}`);
      }
      const connection = new Connection(payload.rpc, "confirmed");
      for (const step of payload.steps) {
        log(`TX ${step.step} PRE: signing via Phantom (fresh blockhash)`);
        await post({ m: "pre", step: step.step });
        const keys = step.keys.map((k) => ({
          pubkey: new PublicKey(k.pubkey),
          isSigner: k.isSigner,
          isWritable: k.isWritable,
        }));
        const data = Uint8Array.from(atob(step.dataBase64), (c) => c.charCodeAt(0));
        const ix = new TransactionInstruction({
          programId: new PublicKey(step.programId),
          keys,
          data,
        });
        const tx = new Transaction().add(ix);
        const { blockhash } = await connection.getLatestBlockhash("finalized");
        tx.feePayer = publicKey;
        tx.recentBlockhash = blockhash;
        const { signature } = await provider.signAndSendTransaction(tx, { skipPreflight: false });
        log(`TX ${step.step} POST ${signature}`);
        await post({ step: step.step, signature });
      }
      log("done");
      await post({ m: "done" });
    } catch (error) {
      log(String(error?.message ?? error));
      await post({ error: String(error?.message ?? error) });
    }
  },
};
