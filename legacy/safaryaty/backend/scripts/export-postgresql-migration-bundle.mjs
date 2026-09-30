import "dotenv/config";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { TABLE_SPECS, buildManifest, normalizeRecord } from "./lib/migration-bundle.mjs";

const prisma = new PrismaClient();
const includeSessions = process.argv.includes("--include-sessions");
const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
const outputDir = resolve(outputArg ? outputArg.slice("--output=".length) : `migration-bundles/sqlite-to-postgres-${new Date().toISOString().replace(/[:.]/g, "-")}`);

async function readTable(spec) {
  if (spec.name === "sessions" && !includeSessions) return [];
  const delegate = prisma[spec.delegate];
  if (!delegate?.findMany) throw new Error(`Prisma delegate missing: ${spec.delegate}`);
  const rows = await delegate.findMany({ orderBy: { [spec.idField]: "asc" } });
  return rows.map((row) => normalizeRecord(spec.name, row));
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const backendPackage = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const data = {};
  for (const spec of TABLE_SPECS) {
    const rows = await readTable(spec);
    data[spec.name] = rows;
    await writeFile(resolve(outputDir, `${spec.name}.json`), `${JSON.stringify(rows, null, 2)}\n`, "utf8");
    console.log(`[export] ${spec.name}: ${rows.length}`);
  }
  const manifest = buildManifest(data, {
    appVersion: backendPackage.version,
    sourceProvider: "sqlite",
    sessionsIncluded: includeSessions,
  });
  await writeFile(resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  if (!manifest.relationValidation.ok) {
    console.error(JSON.stringify(manifest.relationValidation, null, 2));
    process.exitCode = 1;
  }
  console.log(JSON.stringify({ outputDir, globalChecksum: manifest.globalChecksum, relationValidation: manifest.relationValidation }, null, 2));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
