module.exports = ({ config }) => ({
  ...config,
  web: { ...config.web, bundler: "metro", output: "single", favicon: "./assets/icon.png" },
  // Applied only to the web export; Android configuration stays in app.json.
  experiments: { ...config.experiments, ...(process.env.EXPO_WEB_BUILD === "1" ? { baseUrl: "/app" } : {}) },
});
