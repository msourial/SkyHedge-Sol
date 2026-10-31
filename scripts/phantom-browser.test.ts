import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { Keypair, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import chain from "../mobile/src/chain.ts";
const { devnetConnection, DEVNET_RPC_URLS } = chain;
import browserWallet from "../mobile/src/wallet.web.ts";
const { authorizeDevnetWallet, signAndConfirmDevnetTransaction } = browserWallet;

const payer = Keypair.generate();
const other = Keypair.generate();
const transaction = () => new VersionedTransaction(new TransactionMessage({
  payerKey: payer.publicKey,
  recentBlockhash: SystemProgram.programId.toBase58(),
  instructions: [SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: other.publicKey, lamports: 1 })],
}).compileToV0Message());
const session = { address: payer.publicKey.toBase58(), authToken: "phantom-browser" };
const input = () => ({ transactionBase64: Buffer.from(transaction().serialize()).toString("base64"), wallet: session, rpcUrl: "https://api.mainnet-beta.solana.com" });
function install(provider: object) { (globalThis as any).window = { phantom: { solana: provider } }; }
afterEach(() => { delete (globalThis as any).window; });

test("connects through the injected Phantom provider and explains a missing extension", async () => {
  install({ isPhantom: true, connect: async () => ({ publicKey: payer.publicKey }) });
  assert.deepEqual(await authorizeDevnetWallet(), session);
  install({ isPhantom: false });
  await assert.rejects(authorizeDevnetWallet(), /Install the Phantom browser extension/);
});

test("refuses a changed account or wrong payer before asking Phantom to sign", async () => {
  let prompted = false;
  install({ isPhantom: true, publicKey: other.publicKey, signTransaction: async () => { prompted = true; } });
  await assert.rejects(signAndConfirmDevnetTransaction(input()), /account changed/);
  install({ isPhantom: true, publicKey: payer.publicKey, signTransaction: async () => { prompted = true; } });
  await assert.rejects(signAndConfirmDevnetTransaction({ ...input(), wallet: { ...session, address: other.publicKey.toBase58() } }), /account changed/);
  const wrong = new VersionedTransaction(new TransactionMessage({ payerKey: other.publicKey, recentBlockhash: SystemProgram.programId.toBase58(), instructions: [] }).compileToV0Message());
  await assert.rejects(signAndConfirmDevnetTransaction({ ...input(), transactionBase64: Buffer.from(wrong.serialize()).toString("base64") }), /payer/);
  assert.equal(prompted, false);
});

test("signs through Phantom, sends only to Devnet, and retains confirmation failures", async t => {
  const connection = devnetConnection(DEVNET_RPC_URLS[0], "confirmed");
  t.mock.method(connection, "getLatestBlockhashAndContext", async () => ({ context: { slot: 123 }, value: { blockhash: SystemProgram.programId.toBase58(), lastValidBlockHeight: 500 } }));
  let sent = 0;
  t.mock.method(connection, "sendRawTransaction", async (bytes: Uint8Array, options: any) => {
    assert.equal(options.skipPreflight, false); assert.equal(options.minContextSlot, 123);
    const signed = VersionedTransaction.deserialize(bytes);
    assert.ok(signed.signatures[0].some(Boolean));
    sent++; return "test-signature";
  });
  const confirmation = t.mock.method(connection, "confirmTransaction", async () => ({ value: { err: null } }));
  install({ isPhantom: true, publicKey: payer.publicKey, signTransaction: async (tx: VersionedTransaction) => { tx.sign([payer]); return tx; } });
  const phases: string[] = [];
  assert.equal(await signAndConfirmDevnetTransaction({ ...input(), onPhase: p => phases.push(p) }), "test-signature");
  assert.deepEqual(phases, ["waiting", "sending", "confirming"]); assert.equal(sent, 1);
  confirmation.mock.mockImplementation(async () => ({ value: { err: { InstructionError: [0, "Custom"] } } }));
  await assert.rejects(signAndConfirmDevnetTransaction(input()), (error: any) => error.signature === "test-signature");
  const before = sent;
  install({ isPhantom: true, publicKey: payer.publicKey, signTransaction: async () => { throw new Error("User rejected"); } });
  await assert.rejects(signAndConfirmDevnetTransaction(input()), /rejected/);
  assert.equal(sent, before);
  install({ isPhantom: true, publicKey: payer.publicKey, signTransaction: async () => {
    const altered = transaction(); altered.message.recentBlockhash = other.publicKey.toBase58(); return altered;
  } });
  await assert.rejects(signAndConfirmDevnetTransaction(input()), /different transaction/);
  assert.equal(sent, before);
  install({ isPhantom: true, publicKey: payer.publicKey, signTransaction: async (tx: VersionedTransaction) => {
    tx.message.recentBlockhash = other.publicKey.toBase58(); return tx;
  } });
  await assert.rejects(signAndConfirmDevnetTransaction(input()), /different transaction/);
  assert.equal(sent, before);
});
