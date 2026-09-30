import "react-native-get-random-values";
import { Buffer } from "buffer";

const runtime = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
if (!runtime.Buffer) {
  runtime.Buffer = Buffer;
}
