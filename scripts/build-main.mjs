// Bundles the Electron main process + preload with esbuild.
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const common = {
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: false,
  // Native/dynamic-require deps stay external and are shipped via node_modules.
  external: ["electron", "pdf-parse", "mammoth", "dotenv"],
  logLevel: "info",
};

await build({
  ...common,
  entryPoints: [path.join(root, "electron/main.ts")],
  outfile: path.join(root, "dist/main/main.js"),
});

await build({
  ...common,
  entryPoints: [path.join(root, "electron/preload.ts")],
  outfile: path.join(root, "dist/main/preload.js"),
});

console.log("Main process build complete.");
