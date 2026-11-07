// Loaded only by the enabled root. Keep all SDK runtime imports in this module.
import { useMemo, type ReactNode } from "react";
import { PhantomProvider, AddressType, useConnect, useAccounts, useSolana, useDisconnect } from "@phantom/react-native-sdk";
import { VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { EmbeddedWalletContext } from "./embedded-context";
import type { WalletAdapter } from "./wallet-adapter";
import { devnetConnection } from "./chain";
import { describeChainError, TransactionFailedError } from "./buy-phase";

function Bridge({ children }: { children: ReactNode }) {
  const { connect } = useConnect();
  const { addresses, isConnected } = useAccounts();
  const { solana } = useSolana();
  const { disconnect } = useDisconnect();
  const address = isConnected ? addresses.find(a => a.addressType === AddressType.solana)?.address ?? null : null;
  const adapter = useMemo<WalletAdapter>(() => ({
    address,
    async connect(provider = "google") {
      const result = await connect({ provider });
      const account = result.addresses.find(a => a.addressType === AddressType.solana);
      if (!account) throw new Error("Phantom did not return a Solana account.");
      // This marker is never persisted or passed to MWA.
      return { address: account.address, authToken: "embedded" };
    },
    disconnect,
    async signAndSendTransaction(input) {
      if (!address || input.wallet.address !== address) throw new Error("The active wallet changed. Reconnect before approving this transaction.");
      const tx = VersionedTransaction.deserialize(Buffer.from(input.transactionBase64, "base64"));
      if (tx.signatures.some(signature => signature.some(byte => byte !== 0))) {
        throw new Error("Embedded wallets require an unsigned transaction. Additional signers must use presignTransaction.");
      }
      input.onPhase?.("waiting");
      await solana.switchNetwork("devnet");
      const { signature } = await solana.signAndSendTransaction(tx);
      input.onSignature?.(signature);
      input.onPhase?.("sending");
      input.onPhase?.("confirming");
      try {
        const confirmation = await devnetConnection(input.rpcUrl, "confirmed").confirmTransaction(signature, "finalized");
        if (confirmation.value.err) throw new TransactionFailedError(describeChainError(confirmation.value.err), signature, true);
      } catch (reason) {
        if (reason instanceof TransactionFailedError) throw reason;
        throw new TransactionFailedError(reason instanceof Error ? reason.message : "Solana did not confirm the transaction in time.", signature);
      }
      return signature;
    },
  }), [address, connect, disconnect, solana]);
  return <EmbeddedWalletContext.Provider value={adapter}>{children}</EmbeddedWalletContext.Provider>;
}

export function PhantomRoot({ children, appId, scheme }: { children: ReactNode; appId: string; scheme: string }) {
  const config = useMemo(() => ({ providers: ["google", "apple"] as ("google" | "apple")[], appId, scheme,
    addressTypes: [AddressType.solana], authOptions: { redirectUrl: `${scheme}://phantom-auth-callback` } }), [appId, scheme]);
  return <PhantomProvider config={config} appName="SkyHedge"><Bridge>{children}</Bridge></PhantomProvider>;
}
