// Loaded before wallet/SDK imports by App.tsx.
import "react-native-get-random-values";
import { Buffer } from "buffer";
import { TextEncoder, TextDecoder } from "text-encoding-utf-8";
import structuredClone from "@ungap/structured-clone";
import process from "process";

const runtime = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
if (!runtime.Buffer) runtime.Buffer = Buffer;
if (!globalThis.TextEncoder) Object.assign(globalThis, { TextEncoder });
if (!globalThis.TextDecoder) Object.assign(globalThis, { TextDecoder });
// Anchor clones its JSON IDL before translating account names.
if (!globalThis.structuredClone) Object.assign(globalThis, { structuredClone });
if (!(globalThis as {process?: unknown}).process) Object.assign(globalThis, { process });
