const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");
const sharedRoot = path.resolve(workspaceRoot, "shared");

const config = getDefaultConfig(projectRoot);
// Shared Storm Glass tokens live in ../shared — allow Metro to resolve them.
config.watchFolders = [...(config.watchFolders ?? []), sharedRoot];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve("expo-crypto"),
  buffer: require.resolve("buffer"),
};

module.exports = config;
