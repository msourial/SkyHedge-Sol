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

// shared/ uses ".js" specifiers so Vercel's Node ESM functions resolve at runtime.
// Metro does not map "./x.js" to "x.ts", so try the .ts source first for relative imports from shared/.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  if (
    moduleName.startsWith(".") &&
    moduleName.endsWith(".js") &&
    context.originModulePath.startsWith(sharedRoot + path.sep)
  ) {
    try {
      return resolve(context, moduleName.slice(0, -3) + ".ts", platform);
    } catch {
      // Fall through to the specifier as written.
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
