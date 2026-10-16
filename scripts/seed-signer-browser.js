import { Transaction } from "@solana/web3.js";

window.SkyHedgeSeedSigner = {
  async run(steps, expectedAdmin) {
    const logEl = document.getElementById("log");
    const log = (m) => {
      logEl.textContent += `${m}\n`;
      console.log(m);
    };
    const post = async (body) =>
      fetch("/result", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

    const provider = window.phantom?.solana ?? window.solana;
    if (!provider?.connect || !provider?.signAndSendTransaction) {
      log("No Solana wallet provider on this page. Unlock Phantom/Solflare in this browser, then click Start.");
      await post({ error: "Wallet provider not found (non-fatal)" });
      return;
    }
    try {
      const { publicKey } = await provider.connect();
      log(`connected ${publicKey.toString()}`);
      if (publicKey.toString() !== expectedAdmin) {
        throw new Error(`wrong wallet ${publicKey.toString()}`);
      }
      for (const step of steps) {
        log(`TX ${step.step} PRE: signing via Phantom`);
        await post({ m: "pre", step: step.step });
        const raw = Uint8Array.from(atob(step.base64), (c) => c.charCodeAt(0));
        const tx = Transaction.from(raw);
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
