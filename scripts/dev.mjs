// Dev runner: starts the Vite dev server, builds the main process,
// then launches Electron pointed at the dev server.
import { createServer } from "vite";
import { spawn } from "node:child_process";
import { build } from "esbuild";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const electronPath = require("electron"); // path to electron.exe
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 1. Build main + preload
const common = {
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["electron", "pdf-parse", "mammoth", "dotenv"],
};
await build({ ...common, entryPoints: [path.join(root, "electron/main.ts")], outfile: path.join(root, "dist/main/main.js") });
await build({ ...common, entryPoints: [path.join(root, "electron/preload.ts")], outfile: path.join(root, "dist/main/preload.js") });

// 2. Start Vite dev server
const server = await createServer({ configFile: path.join(root, "vite.config.ts") });
await server.listen();
const port = server.config.server.port;
const url = `http://localhost:${port}`;
console.log(`Vite dev server: ${url}`);

// 3. Launch Electron
const child = spawn(electronPath, ["."], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});

child.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
