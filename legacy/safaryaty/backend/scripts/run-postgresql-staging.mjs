import "dotenv/config";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

if (process.env.NODE_ENV === "production") {
  console.error("v4.29.51 blocks PostgreSQL production runtime. Use staging only.");
  process.exit(1);
}

const dev = process.argv.includes("--dev");
const env = { ...process.env, NODE_ENV: "staging", DATABASE_PROVIDER: "postgresql" };
let args;

if (dev) {
  args = [resolve("node_modules/tsx/dist/cli.mjs"), "watch", "src/server.ts"];
} else {
  const candidates = [
    resolve("dist/server.js"),
    resolve("dist/src/server.js"),
  ];
  const serverPath = candidates.find((candidate) => existsSync(candidate));
  if (!serverPath) {
    console.error("Built backend entrypoint was not found. Run npm run build first.");
    console.error(`Checked: ${candidates.join(", ")}`);
    process.exit(1);
  }
  args = [serverPath];
}

const child = spawn(process.execPath, args, {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
