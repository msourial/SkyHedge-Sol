import { test } from "node:test";
import assert from "node:assert/strict";
import { Buffer as PolyBuffer } from "buffer";
import { patchBufferSubarray } from "./buffer-subarray.ts";

test("subarray keeps Buffer methods even when the engine ignores Symbol.species", () => {
  const original = Uint8Array.prototype.subarray;
  // Simulate Hermes: subarray returns a plain Uint8Array.
  Object.defineProperty(Uint8Array.prototype, "subarray", { configurable: true, writable: true, value: function (this: Uint8Array, b?: number, e?: number) { return new Uint8Array(this.buffer, this.byteOffset + (b ?? 0), (e ?? this.length) - (b ?? 0)); } });
  try {
    delete (PolyBuffer.prototype as { subarray?: unknown }).subarray;
    const plain = PolyBuffer.from([0, 1, 2, 3, 4, 5, 6, 7, 9, 0]).subarray(8) as unknown as { readUIntLE?: unknown };
    assert.equal(typeof plain.readUIntLE, "undefined");
    patchBufferSubarray(PolyBuffer as never);
    patchBufferSubarray(PolyBuffer as never);
    const data = PolyBuffer.from([0, 1, 2, 3, 4, 5, 6, 7, 9, 0]).subarray(8);
    assert.equal(data.readUIntLE(0, 2), 9);
    assert.equal(PolyBuffer.from([1, 2, 3]).slice(1).readUInt8(0), 2);
  } finally {
    Object.defineProperty(Uint8Array.prototype, "subarray", { configurable: true, writable: true, value: original });
  }
});
