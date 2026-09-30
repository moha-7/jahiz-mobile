import "dotenv/config";
import { createHash } from "node:crypto";
import { createConnection } from "node:net";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

const ACK = "SAFARYATY_SOURCE_WRITES_STOPPED";
const execute = process.argv.includes("--execute");
const ack = process.argv.find((value) => value.startsWith("--ack="))?.slice(6);
const outputArg = process.argv.find((value) => value.startsWith("--output="))?.slice(9);

function sha256(buffer) { return createHash("sha256").update(buffer).digest("hex"); }
function serverReachable(port = 4000) {
  return new Promise((resolvePromise) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(600);
    socket.once("connect", () => { socket.destroy(); resolvePromise(true); });
    socket.once("timeout", () => { socket.destroy(); resolvePromise(false); });
    socket.once("error", () => resolvePromise(false));
  });
}
function sqlitePathFromUrl(url) {
  if (!url?.startsWith("file:")) throw new Error("DATABASE_URL must be a SQLite file URL");
  const raw = url.slice(5).split("?")[0];
  if (isAbsolute(raw)) return raw;
  return resolve(process.cwd(), "prisma", raw.replace(/^\.\//, ""));
}

async function main() {
  const source = sqlitePathFromUrl(process.env.DATABASE_URL);
  await stat(source).catch(() => { throw new Error(`SQLite source not found: ${source}`); });
  const backendRunning = await serverReachable(Number(process.env.PORT || 4000));
  if (backendRunning) throw new Error("Backend is reachable on the configured port. Stop all write traffic before backup.");
  if (!execute || ack !== ACK) {
    console.log(JSON.stringify({ executable: true, source, backendRunning, required: `--execute --ack=${ACK}` }, null, 2));
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = resolve(outputArg || `cutover-backups/sqlite-source-${stamp}.db`);
  await mkdir(dirname(destination), { recursive: true });
  const sourceFiles = [source, `${source}-wal`, `${source}-shm`];
  const files = [];
  for (const sourceFile of sourceFiles) {
    const exists = await stat(sourceFile).then(() => true).catch(() => false);
    if (!exists) continue;
    const suffix = sourceFile === source ? "" : sourceFile.slice(source.length);
    const backupFile = `${destination}${suffix}`;
    await copyFile(sourceFile, backupFile);
    const [sourceBytes, backupBytes] = await Promise.all([readFile(sourceFile), readFile(backupFile)]);
    const sourceHash = sha256(sourceBytes);
    const backupHash = sha256(backupBytes);
    if (sourceHash !== backupHash) throw new Error(`SQLite backup hash mismatch for ${sourceFile}`);
    files.push({ source: sourceFile, backup: backupFile, size: sourceBytes.length, sha256: sourceHash });
  }
  const primary = files.find((item) => item.source === source);
  if (!primary) throw new Error("Primary SQLite database was not copied");
  const receipt = {
    version: "4.29.51",
    valid: true,
    source,
    backup: destination,
    sourceSize: primary.size,
    backupSize: primary.size,
    sha256: primary.sha256,
    files,
    createdAt: new Date().toISOString(),
    backendConfirmedStopped: true,
  };
  const receiptPath = `${destination}.receipt.json`;
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ receiptPath, ...receipt }, null, 2));
}

main().catch((error) => { console.error(error?.stack || error); process.exitCode = 1; });
