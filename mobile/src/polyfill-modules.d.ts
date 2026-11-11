declare module 'text-encoding-utf-8' {
  export const TextEncoder: typeof globalThis.TextEncoder;
  export const TextDecoder: typeof globalThis.TextDecoder;
}
declare module '@ungap/structured-clone' {
  const clone: typeof globalThis.structuredClone;
  export default clone;
}
