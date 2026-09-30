import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const sourcePath = resolve(root, "prisma/schema.prisma");
const postgresPath = resolve(root, "prisma/postgresql/schema.prisma");
const baselinePath = resolve(root, "prisma/postgresql/migrations/202606230001_postgresql_baseline/migration.sql");
const receiptMigrationPath = resolve(root, "prisma/postgresql/migrations/202606230002_staging_cutover_receipt/migration.sql");
const lockPath = resolve(root, "prisma/postgresql/migrations/migration_lock.toml");

function models(schema) {
  const result = new Map();
  const pattern = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let match;
  while ((match = pattern.exec(schema))) {
    const fields = new Set();
    for (const raw of match[2].split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@") || line.startsWith("@")) continue;
      const field = line.match(/^(\w+)\s+/)?.[1];
      if (field) fields.add(field);
    }
    result.set(match[1], fields);
  }
  return result;
}

const MONEY_EXPECTATIONS = [
  /exchangeRate\s+Decimal\s+@default\(1\)\s+@db\.Decimal\(20, 10\)/,
  /startingSavings\s+Decimal\s+@default\(0\)\s+@db\.Decimal\(19, 4\)/,
  /supportMoney\s+Decimal\s+@default\(0\)\s+@db\.Decimal\(19, 4\)/,
  /safetyReserve\s+Decimal\s+@default\(0\)\s+@db\.Decimal\(19, 4\)/,
  /amount\s+Decimal\s+@db\.Decimal\(19, 4\)/,
  /amountBase\s+Decimal\s+@db\.Decimal\(19, 4\)/,
  /currentAmount\s+Decimal\s+@db\.Decimal\(19, 4\)/,
  /suggestedAmount\s+Decimal\s+@db\.Decimal\(19, 4\)/,
  /difference\s+Decimal\s+@db\.Decimal\(19, 4\)/,
];

async function main() {
  const [source, postgres, baseline, receiptMigration, lock] = await Promise.all([
    readFile(sourcePath, "utf8"),
    readFile(postgresPath, "utf8"),
    readFile(baselinePath, "utf8"),
    readFile(receiptMigrationPath, "utf8"),
    readFile(lockPath, "utf8"),
  ]);
  const errors = [];
  const warnings = [];
  if (!/provider\s*=\s*"postgresql"/.test(postgres)) errors.push("PostgreSQL schema provider is not postgresql");
  if (/\bFloat\b/.test(postgres)) errors.push("PostgreSQL schema still contains Float money fields");
  if (!/POSTGRES_DATABASE_URL/.test(postgres)) errors.push("PostgreSQL schema does not use POSTGRES_DATABASE_URL");
  if (!/provider\s*=\s*"postgresql"/.test(lock)) errors.push("PostgreSQL migration lock provider mismatch");
  for (const expectation of MONEY_EXPECTATIONS) if (!expectation.test(postgres)) errors.push(`Missing Decimal strategy: ${expectation}`);

  const sourceModels = models(source);
  const pgModels = models(postgres);
  for (const [name, fields] of sourceModels) {
    if (!pgModels.has(name)) { errors.push(`PostgreSQL schema missing model ${name}`); continue; }
    for (const field of fields) if (!pgModels.get(name).has(field)) errors.push(`PostgreSQL schema missing ${name}.${field}`);
  }
  const expectedTargetOnly = new Set(["MigrationReceipt"]);
  for (const name of pgModels.keys()) {
    if (sourceModels.has(name)) continue;
    if (!expectedTargetOnly.has(name)) errors.push(`Unexpected PostgreSQL-only model: ${name}`);
  }
  for (const name of expectedTargetOnly) if (!pgModels.has(name)) errors.push(`PostgreSQL schema missing operational model ${name}`);

  const requiredSql = [
    'CREATE TYPE "Frequency"',
    'DECIMAL(19,4)',
    'DECIMAL(20,10)',
    'CONSTRAINT "Trip_exchangeRate_check"',
    'CONSTRAINT "Trip_date_order_check"',
    'CONSTRAINT "PaymentMark_paymentKey_check"',
    'CREATE UNIQUE INDEX "PaymentMark_tripId_paymentKey_key"',
    'CREATE INDEX "Trip_userId_status_updatedAt_idx"',
    'CREATE INDEX "TripCost_tripId_status_dueDate_idx"',
    'CREATE INDEX "ExternalDataSnapshot_provider_stale_expiresAt_idx"',
  ];
  for (const text of requiredSql) if (!baseline.includes(text)) errors.push(`Baseline SQL missing: ${text}`);
  for (const text of ['CREATE TABLE "MigrationReceipt"', 'MigrationReceipt_bundleChecksum_check', 'CREATE UNIQUE INDEX "MigrationReceipt_bundleChecksum_key"']) {
    if (!receiptMigration.includes(text)) errors.push(`Receipt migration SQL missing: ${text}`);
  }

  const sourceFloatCount = (source.match(/\bFloat\b/g) || []).length;
  if (!sourceFloatCount) warnings.push("Source SQLite schema no longer contains Float; verify readiness assumptions");

  const result = {
    ready: errors.length === 0,
    sourceSchema: sourcePath,
    postgresSchema: postgresPath,
    models: { source: sourceModels.size, postgresql: pgModels.size },
    sourceFloatCount,
    decimalStrategy: { money: "Decimal(19,4)", exchangeRate: "Decimal(20,10)" },
    dateStrategy: { planningDates: "DATE", eventTimestamps: "TIMESTAMPTZ(3)" },
    errors,
    warnings,
  };
  console.log(JSON.stringify(result, null, 2));
  if (errors.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
