/**
 * Hermes' Buffer polyfill has no BigInt read/write methods and its subarray may return a plain
 * Uint8Array. These helpers use only uint32 reads and index access, so they behave the same on the phone.
 */
export function readU64LE(data: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let index = 7; index >= 0; index--) value = (value << 8n) | BigInt(data[offset + index]!);
  return value;
}

export function readI64LE(data: Uint8Array, offset: number): bigint {
  const value = readU64LE(data, offset);
  return value >= 0x8000000000000000n ? value - 0x10000000000000000n : value;
}

export function readU16LE(data: Uint8Array, offset: number): number {
  return data[offset]! | (data[offset + 1]! << 8);
}

export function u64LeBytes(value: bigint): Uint8Array {
  if (value < 0n || value > 0xffffffffffffffffn) throw new Error("Amount is out of range.");
  const out = new Uint8Array(8);
  let rest = value;
  for (let index = 0; index < 8; index++) { out[index] = Number(rest & 0xffn); rest >>= 8n; }
  return out;
}

export function hexBytes(data: Uint8Array, offset: number, length: number): string {
  let hex = "";
  for (let index = 0; index < length; index++) hex += data[offset + index]!.toString(16).padStart(2, "0");
  return hex;
}

export function sliceBytes(data: Uint8Array, offset: number, length: number): Uint8Array {
  return Uint8Array.from(Array.prototype.slice.call(data, offset, offset + length) as number[]);
}
