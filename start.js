// Wrapper script to load tsconfig-paths before starting the server
// This ensures path aliases (@/) are resolved correctly at runtime

const tsConfigPaths = require("tsconfig-paths");
const path = require("path");
const fs = require("fs");

// Load tsconfig.json
const tsConfigPath = path.join(__dirname, "tsconfig.json");
const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, "utf8"));

// Adjust paths for runtime (files are in dist/, but paths map to src/)
// We need to map @/* to dist/* at runtime
const baseUrl = path.resolve(__dirname, tsConfig.compilerOptions.baseUrl || ".");
const paths = {};

// Convert src/* paths to dist/* for runtime
Object.keys(tsConfig.compilerOptions.paths || {}).forEach((alias) => {
  const pathMappings = tsConfig.compilerOptions.paths[alias];
  paths[alias] = pathMappings.map((p) => {
    // Replace src/ with dist/ in the path mapping
    return p.replace(/^src\//, "dist/");
  });
});

// Register the paths
tsConfigPaths.register({
  baseUrl: baseUrl,
  paths: paths,
});

// Now require the server
require("./dist/server.js");

