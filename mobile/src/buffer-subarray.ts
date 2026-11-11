/**
 * Hermes ignores Symbol.species on typed arrays, so `buffer.subarray()` returns a
 * plain Uint8Array without Buffer methods (readUIntLE, readBigUInt64LE, ...).
 * Anchor's account coder decodes `data.subarray(8)` with buffer-layout, which then
 * fails with "undefined is not a function". Keep subarray results as Buffers.
 */
type BufferLike = { prototype: Uint8Array & { subarray(begin?: number, end?: number): Uint8Array } };
const PATCHED = Symbol.for("skyhedge.bufferSubarrayPatched");
export function patchBufferSubarray(BufferCtor: BufferLike): void {
  const proto = BufferCtor.prototype as BufferLike["prototype"] & { [PATCHED]?: boolean };
  if (proto[PATCHED]) return;
  const original = Uint8Array.prototype.subarray;
  Object.defineProperty(proto, "subarray", {
    configurable: true,
    writable: true,
    value: function subarray(this: Uint8Array, begin?: number, end?: number) {
      const view = original.call(this, begin, end);
      if (Object.getPrototypeOf(view) !== proto) Object.setPrototypeOf(view, proto);
      return view;
    },
  });
  Object.defineProperty(proto, PATCHED, { value: true });
}
