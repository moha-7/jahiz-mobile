import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { defaultReceiptPath, targetFingerprint, sanitizedTargetIdentity, writeCutoverReport } from "./lib/postgresql-cutover.mjs";
import { TABLE_SPECS, buildManifest, compareManifest, normalizeRecord } from "./lib/migration-bundle.mjs";

const bundleArg = process.argv.find((arg) => arg.startsWith("--bundle="));
if (!bundleArg) {
  console.error("Usage: npm run db:postgres:target:verify -- --bundle=path/to/bundle");
  process.exit(1);
}
if (!process.env.POSTGRES_DATABASE_URL) {
  console.error("POSTGRES_DATABASE_URL is required");
  process.exit(1);
}

const bundleDir = resolve(bundleArg.slice("--bundle=".length));
const receiptArg = process.argv.find((arg) => arg.startsWith("--receipt="));
const clientPath = resolve(process.cwd(), "src/generated/postgresql-client/index.js");

async function main() {
  const clientModule = await import(pathToFileURL(clientPath).href).catch(() => {
    throw new Error("PostgreSQL Prisma client not generated. Run npm run prisma:postgres:generate first.");
  });
  const prisma = new clientModule.PrismaClient({ datasources: { db: { url: process.env.POSTGRES_DATABASE_URL } } });
  try {
    const expected = JSON.parse(await readFile(resolve(bundleDir, "manifest.json"), "utf8"));
    const data = {};
    for (const spec of TABLE_SPECS) {
      if (spec.name === "sessions" && !expected.sessionsIncluded) { data[spec.name] = []; continue; }
      const delegate = prisma[spec.delegate];
      const rows = await delegate.findMany({ orderBy: { [spec.idField]: "asc" } });
      data[spec.name] = rows.map((row) => normalizeRecord(spec.name, row));
    }
    const actual = buildManifest(data, {
      appVersion: expected.appVersion,
      sourceProvider: expected.sourceProvider,
      sessionsIncluded: expected.sessionsIncluded,
      exportedAt: expected.exportedAt,
    });
    const marker = await prisma.migrationReceipt.findUnique({ where: { id: "initial-sqlite-import" } });
    const errors = [...compareManifest(expected, actual), ...(actual.relationValidation.errors || [])];
    const fingerprint = targetFingerprint(process.env.POSTGRES_DATABASE_URL);
    if (!marker) errors.push("MigrationReceipt marker is missing");
    else {
      if (marker.bundleChecksum !== expected.globalChecksum) errors.push("MigrationReceipt bundle checksum mismatch");
      if (marker.targetFingerprint !== fingerprint) errors.push("MigrationReceipt target fingerprint mismatch");
    }
    const valid = errors.length === 0;
    let receiptPath = null;
    if (valid && receiptArg) {
      const receipt = {
        version: "4.29.51",
        valid: true,
        runtimeAllowed: process.env.POSTGRES_TARGET_KIND === "staging" && process.env.POSTGRES_STAGING_ACK === "SAFARYATY_POSTGRES_STAGING_VERIFIED",
        target: "postgresql",
        targetFingerprint: fingerprint,
        targetIdentity: sanitizedTargetIdentity(process.env.POSTGRES_DATABASE_URL),
        bundleDirectory: bundleDir,
        bundleGlobalChecksum: expected.globalChecksum,
        actualGlobalChecksum: actual.globalChecksum,
        databaseMarkerId: marker?.id || null,
        sessionsIncluded: Boolean(expected.sessionsIncluded),
        sourceProvider: expected.sourceProvider,
        sourceExportedAt: expected.exportedAt,
        verifiedAt: new Date().toISOString(),
      };
      receiptPath = await writeCutoverReport(receiptArg.slice("--receipt=".length) || defaultReceiptPath(bundleDir, expected.globalChecksum), receipt);
    }
    console.log(JSON.stringify({ target: "postgresql", valid, errors, expectedGlobalChecksum: expected.globalChecksum, actualGlobalChecksum: actual.globalChecksum, receiptPath }, null, 2));
    if (errors.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
