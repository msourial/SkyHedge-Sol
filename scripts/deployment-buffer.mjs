import { PublicKey } from "@solana/web3.js";

const BUFFER_STATE_TAG = 1;
const BUFFER_METADATA_BYTES = 37;

/** Validate the on-chain Upgradeable Loader Buffer state before reusing its signer. */
export function validateDeploymentBufferAccount({ account, loader, authority, requiredDataLength }) {
  if (!account) return { status: "absent" };
  if (account.owner !== loader) throw new Error("Existing deployment buffer is not owned by the upgradeable loader.");
  if (account.executable) throw new Error("Existing deployment buffer is executable; refusing to overwrite it.");

  const data = Buffer.from(account.data ?? []);
  if (data.length < BUFFER_METADATA_BYTES || data.readUInt32LE(0) !== BUFFER_STATE_TAG) {
    throw new Error("Existing deployment account is not in Upgradeable Loader Buffer state.");
  }
  if (data[4] !== 1) throw new Error("Existing deployment buffer has no authority; refusing to reuse it.");

  const bufferAuthority = new PublicKey(data.subarray(5, BUFFER_METADATA_BYTES)).toBase58();
  if (bufferAuthority !== new PublicKey(authority).toBase58()) {
    throw new Error("Existing deployment buffer authority does not match the verified upgrade authority.");
  }
  if (data.length < requiredDataLength) {
    throw new Error(`Existing deployment buffer is too small (${data.length} bytes; need ${requiredDataLength}). Use a new buffer keypair.`);
  }

  return { status: "ready", dataLength: data.length, authority: bufferAuthority };
}
