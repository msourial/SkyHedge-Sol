module.exports = ({ config }) => ({
  ...config,
  ...(process.env.EXPO_PUBLIC_PHANTOM_EMBEDDED === "true" && process.env.EXPO_PUBLIC_PHANTOM_APP_ID?.trim() ? {
    scheme: process.env.EXPO_PUBLIC_PHANTOM_SCHEME?.trim() || config.scheme,
    plugins: [...(config.plugins ?? []), "expo-web-browser"],
  } : {}),
  web: { ...config.web, bundler: "metro", output: "single", favicon: "./assets/icon.png" },
  // Applied only to the web export; Android configuration stays in app.json.
  experiments: { ...config.experiments, ...(process.env.EXPO_WEB_BUILD === "1" ? { baseUrl: "/app" } : {}) },
});
