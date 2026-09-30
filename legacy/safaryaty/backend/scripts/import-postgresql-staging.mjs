import "dotenv/config";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  MAX_DEFAULT_IMPORT_ROWS,
  assertTargetEmptyCounts,
  buildImportPlan,
  cutoverGuard,
  defaultReceiptPath,
  readMigrationBundle,
  sanitizedTargetIdentity,
  targetFingerprint,
  writeCutoverReport,
} from "./lib/postgresql-cutover.mjs";
import { TABLE_SPECS, buildManifest, compareManifest, normalizeRecord } from "./lib/migration-bundle.mjs";

const arg = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const has = (name) => process.argv.includes(`--${name}`);
const bundleArg = arg("bundle");
const execute = has("execute");
const confirmChecksum = arg("confirm") || "";
const batchSize = Number(arg("batch-size") || 250);
const allowLarge = has("allow-large-transaction");
const receiptArg = arg("receipt");

if (!bundleArg) {
  console.error("Usage: npm run db:postgres:staging:import -- --bundle=PATH [--execute --confirm=<bundle global checksum>]");
  process.exit(1);
}

async function loadPostgresClient() {
  const clientPath = resolve(process.cwd(), "src/generated/postgresql-client/index.js");
  return import(pathToFileURL(clientPath).href).catch(() => {
    throw new Error("PostgreSQL Prisma client not generated. Run npm run prisma:postgres:generate first.");
  });
}

async function targetCounts(prismaLike, sessionsIncluded) {
  const counts = {};
  for (const spec of TABLE_SPECS) {
    if (spec.name === "sessions" && !sessionsIncluded) {
      counts[spec.name] = await prismaLike[spec.delegate].count();
      continue;
    }
    counts[spec.name] = await prismaLike[spec.delegate].count();
  }
  return counts;
}


async function targetDatabasePreflight(prisma) {
  const versionRows = await prisma.$queryRawUnsafe("SELECT current_setting('server_version_num')::int AS version_num");
  const versionNumber = Number(versionRows?.[0]?.version_num || 0);
  if (versionNumber < 140000) throw new Error(`PostgreSQL 14 or newer is required for staging; found server_version_num=${versionNumber || "unknown"}`);
  const requiredMigrations = [
    "202606230001_postgresql_baseline",
    "202606230002_staging_cutover_receipt",
  ];
  const migrations = await prisma.$queryRawUnsafe(
    'SELECT "migration_name", "finished_at", "rolled_back_at" FROM "_prisma_migrations"'
  ).catch(() => {
    throw new Error("Prisma migration history is unavailable. Run npm run prisma:postgres:migrate:deploy before import.");
  });
  const byName = new Map((migrations || []).map((row) => [row.migration_name, row]));
  for (const migrationName of requiredMigrations) {
    const migration = byName.get(migrationName);
    if (!migration || !migration.finished_at || migration.rolled_back_at) {
      throw new Error(`Required PostgreSQL migration is not successfully applied: ${migrationName}`);
    }
  }
  return { versionNumber, migrations: requiredMigrations };
}

async function readTargetData(prismaLike, sessionsIncluded) {
  const data = {};
  for (const spec of TABLE_SPECS) {
    if (spec.name === "sessions" && !sessionsIncluded) {
      data[spec.name] = [];
      continue;
    }
    const rows = await prismaLike[spec.delegate].findMany({ orderBy: { [spec.idField]: "asc" } });
    data[spec.name] = rows.map((row) => normalizeRecord(spec.name, row));
  }
  return data;
}

async function main() {
  const bundle = await readMigrationBundle(bundleArg);
  if (bundle.errors.length) throw new Error(`Migration bundle is invalid:\n- ${bundle.errors.join("\n- ")}`);

  const guardErrors = cutoverGuard({
    postgresUrl: process.env.POSTGRES_DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    targetKind: process.env.POSTGRES_TARGET_KIND,
    ack: process.env.POSTGRES_STAGING_ACK,
    execute,
    confirmChecksum,
    expectedChecksum: bundle.expected.globalChecksum,
  });
  if (guardErrors.length) throw new Error(`Staging cutover guard blocked:\n- ${guardErrors.join("\n- ")}`);

  const plan = buildImportPlan(bundle.data, { batchSize, sessionsIncluded: bundle.expected.sessionsIncluded });
  if (plan.totalRows > MAX_DEFAULT_IMPORT_ROWS && !allowLarge) {
    throw new Error(`Bundle has ${plan.totalRows} rows. Re-run with --allow-large-transaction only after reviewing transaction timeout and capacity.`);
  }

  const clientModule = await loadPostgresClient();
  const prisma = new clientModule.PrismaClient({ datasources: { db: { url: process.env.POSTGRES_DATABASE_URL } } });
  const fingerprint = targetFingerprint(process.env.POSTGRES_DATABASE_URL);
  const identity = sanitizedTargetIdentity(process.env.POSTGRES_DATABASE_URL);
  const startedAt = new Date().toISOString();

  try {
    const databasePreflight = await targetDatabasePreflight(prisma);
    const markerCountBefore = await prisma.migrationReceipt.count();
    if (markerCountBefore !== 0) throw new Error(`PostgreSQL target already has ${markerCountBefore} migration receipt record(s)`);
    const countsBefore = await targetCounts(prisma, bundle.expected.sessionsIncluded);
    assertTargetEmptyCounts(countsBefore);

    const dryRunReport = {
      version: "4.29.51",
      mode: execute ? "execute" : "dry-run",
      validBundle: true,
      bundleDirectory: bundle.directory,
      bundleGlobalChecksum: bundle.expected.globalChecksum,
      targetFingerprint: fingerprint,
      targetIdentity: identity,
      targetEmpty: true,
      databasePreflight,
      totalRows: plan.totalRows,
      batchSize: plan.batchSize,
      tables: Object.fromEntries(plan.steps.map((step) => [step.name, step.count])),
      startedAt,
    };

    if (!execute) {
      console.log(JSON.stringify({ ...dryRunReport, executable: true, requiredConfirmation: bundle.expected.globalChecksum }, null, 2));
      return;
    }

    const inserted = {};
    await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(7242951)");
      assertTargetEmptyCounts(await targetCounts(tx, bundle.expected.sessionsIncluded));

      for (const step of plan.steps) {
        inserted[step.name] = 0;
        if (step.name === "sessions" && !bundle.expected.sessionsIncluded) continue;
        for (const batch of step.batches) {
          if (!batch.length) continue;
          const result = await tx[step.delegate].createMany({ data: batch });
          inserted[step.name] += Number(result.count || 0);
        }
        if (inserted[step.name] !== step.count) throw new Error(`${step.name} inserted ${inserted[step.name]} rows, expected ${step.count}`);
      }

      const targetData = await readTargetData(tx, bundle.expected.sessionsIncluded);
      const targetManifest = buildManifest(targetData, {
        appVersion: bundle.expected.appVersion,
        sourceProvider: bundle.expected.sourceProvider,
        sessionsIncluded: bundle.expected.sessionsIncluded,
        exportedAt: bundle.expected.exportedAt,
      });
      const errors = [...compareManifest(bundle.expected, targetManifest), ...(targetManifest.relationValidation.errors || [])];
      if (errors.length) throw new Error(`In-transaction target verification failed:\n- ${errors.join("\n- ")}`);
      await tx.migrationReceipt.create({
        data: {
          id: "initial-sqlite-import",
          bundleChecksum: bundle.expected.globalChecksum,
          targetFingerprint: fingerprint,
          appVersion: bundle.expected.appVersion || null,
          sessionsIncluded: Boolean(bundle.expected.sessionsIncluded),
          verifiedAt: new Date(),
        }
      });
    }, { isolationLevel: "Serializable", maxWait: 20_000, timeout: 600_000 });

    const finalData = await readTargetData(prisma, bundle.expected.sessionsIncluded);
    const finalManifest = buildManifest(finalData, {
      appVersion: bundle.expected.appVersion,
      sourceProvider: bundle.expected.sourceProvider,
      sessionsIncluded: bundle.expected.sessionsIncluded,
      exportedAt: bundle.expected.exportedAt,
    });
    const finalErrors = [...compareManifest(bundle.expected, finalManifest), ...(finalManifest.relationValidation.errors || [])];
    if (finalErrors.length) throw new Error(`Post-commit verification failed:\n- ${finalErrors.join("\n- ")}`);

    const databaseMarker = await prisma.migrationReceipt.findUnique({ where: { id: "initial-sqlite-import" } });
    if (!databaseMarker || databaseMarker.bundleChecksum !== bundle.expected.globalChecksum || databaseMarker.targetFingerprint !== fingerprint) {
      throw new Error("PostgreSQL migration receipt marker does not match the verified import");
    }

    const finishedAt = new Date().toISOString();
    const receipt = {
      ...dryRunReport,
      mode: "execute",
      valid: true,
      runtimeAllowed: true,
      inserted,
      sessionsIncluded: Boolean(bundle.expected.sessionsIncluded),
      sourceProvider: bundle.expected.sourceProvider,
      sourceExportedAt: bundle.expected.exportedAt,
      databaseMarkerId: databaseMarker.id,
      verifiedAt: finishedAt,
      finishedAt,
      actualGlobalChecksum: finalManifest.globalChecksum,
    };
    const receiptPath = await writeCutoverReport(receiptArg || defaultReceiptPath(bundle.directory, bundle.expected.globalChecksum), receipt);
    console.log(JSON.stringify({ success: true, receiptPath, ...receipt }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
