import "dotenv/config";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

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

const child = spawn(process.execPath, [serverPath], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
