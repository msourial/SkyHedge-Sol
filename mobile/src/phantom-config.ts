/** Exact opt-in: a flag without a Portal App ID never enables the SDK. */
export function phantomConfig(flag?: string, appId?: string, scheme?: string, defaultScheme = "skyhedge") {
  const id = appId?.trim() ?? "";
  return { enabled: flag === "true" && id.length > 0, appId: id, scheme: scheme?.trim() || defaultScheme };
}
