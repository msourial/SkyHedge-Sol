// Test-only loader: shared/ imports use ".js" specifiers (for Vercel's Node ESM functions).
// Node's --experimental-strip-types does not map "./x.js" to "x.ts", so fall back to the .ts source.
import { register } from "node:module";

const hooks = `
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND" && /^\\.{1,2}\\//.test(specifier) && specifier.endsWith(".js")) {
      return nextResolve(specifier.slice(0, -3) + ".ts", context);
    }
    if (error?.code === "ERR_MODULE_NOT_FOUND" && /^\\.{1,2}\\//.test(specifier) && !/\\.[a-z]+$/i.test(specifier)) {
      return nextResolve(specifier + ".ts", context);
    }
    throw error;
  }
}
// Metro bundles bare JSON imports (shared/ui-market-identity.ts); Node ESM needs the json attribute.
export async function load(url, context, nextLoad) {
  if (url.endsWith(".json") && context.importAttributes?.type !== "json") {
    return nextLoad(url, { ...context, importAttributes: { ...context.importAttributes, type: "json" } });
  }
  return nextLoad(url, context);
}
`;

register("data:text/javascript," + encodeURIComponent(hooks));
