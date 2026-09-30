import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  POSTGRES_STAGING_ACK,
  assertTargetEmptyCounts,
  buildImportPlan,
  cutoverGuard,
  materializePostgresRecord,
  sanitizedTargetIdentity,
  targetFingerprint,
} from "../backend/scripts/lib/postgresql-cutover.mjs";

const backendPackage = JSON.parse(readFileSync(new URL("../backend/package.json", import.meta.url), "utf8"));
const runtimePrisma = readFileSync(new URL("../backend/src/lib/prisma.ts", import.meta.url), "utf8");
const importer = readFileSync(new URL("../backend/scripts/import-postgresql-staging.mjs", import.meta.url), "utf8");
const smoke = readFileSync(new URL("../backend/scripts/postgresql-staging-smoke.ts", import.meta.url), "utf8");

const runtimeSafety = readFileSync(new URL("../backend/src/lib/postgresql-runtime-safety.ts", import.meta.url), "utf8");
const sourceBackup = readFileSync(new URL("../backend/scripts/backup-sqlite-cutover-source.mjs", import.meta.url), "utf8");
const rollbackVerifier = readFileSync(new URL("../backend/scripts/verify-sqlite-rollback.mjs", import.meta.url), "utf8");

test("staging cutover guard blocks production and checksum mistakes", () => {
  assert.ok(cutoverGuard({ execute: true }).length >= 4);
  assert.ok(cutoverGuard({
    postgresUrl: "postgresql://u:p@localhost:5432/staging",
    nodeEnv: "production",
    targetKind: "staging",
    ack: POSTGRES_STAGING_ACK,
    execute: true,
    confirmChecksum: "wrong",
    expectedChecksum: "expected",
  }).some((error) => error.includes("production")));
  assert.deepEqual(cutoverGuard({
    postgresUrl: "postgresql://u:p@localhost:5432/staging",
    nodeEnv: "staging",
    targetKind: "staging",
    ack: POSTGRES_STAGING_ACK,
    execute: true,
    confirmChecksum: "expected",
    expectedChecksum: "expected",
  }), []);
});

test("target fingerprint excludes credentials but binds database and schema", () => {
  const one = targetFingerprint("postgresql://alice:secret@db.example:5432/safaryaty?schema=public");
  const same = targetFingerprint("postgresql://bob:other@db.example:5432/safaryaty?schema=public");
  const differentDb = targetFingerprint("postgresql://alice:secret@db.example:5432/other?schema=public");
  const differentSchema = targetFingerprint("postgresql://alice:secret@db.example:5432/safaryaty?schema=staging");
  assert.equal(one, same);
  assert.notEqual(one, differentDb);
  assert.notEqual(one, differentSchema);
  assert.deepEqual(sanitizedTargetIdentity("postgresql://alice:secret@db.example:5432/safaryaty?schema=public"), {
    protocol: "postgresql", host: "db.example", port: "5432", database: "safaryaty", schema: "public"
  });
});

test("PostgreSQL materialization preserves decimal strings and date semantics", () => {
  const row = materializePostgresRecord("trips", {
    id: "t1",
    exchangeRate: "13.6699123457",
    departureDate: "2026-07-01",
    createdAt: "2026-06-23T10:20:30.123Z",
  });
  assert.equal(row.exchangeRate, "13.6699123457");
  assert.ok(row.departureDate instanceof Date);
  assert.equal(row.departureDate.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.ok(row.createdAt instanceof Date);
});

test("import plan is dependency ordered and batched without generating IDs", () => {
  const data = {
    users: [{ id: "u1" }, { id: "u2" }], sessions: [], trips: [{ id: "t1", userId: "u1", exchangeRate: "1.0000000000" }],
    tripFinanceProfiles: [{ tripId: "t1", startingSavings: "1.0000", supportMoney: "0.0000", safetyReserve: "0.0000" }],
    incomes: [], lifeCosts: [], installments: [], tripCosts: [], expenses: [], presetSuggestions: [], paymentMarks: [], externalDataSnapshots: []
  };
  const plan = buildImportPlan(data, { batchSize: 1, sessionsIncluded: false });
  assert.deepEqual(plan.steps.slice(0, 4).map((step) => step.name), ["users", "sessions", "trips", "tripFinanceProfiles"]);
  assert.equal(plan.steps[0].batches.length, 2);
  assert.equal(plan.steps[0].batches[0][0].id, "u1");
  assert.equal(plan.totalRows, 4);
});

test("non-empty PostgreSQL target is rejected before import", () => {
  assert.throws(() => assertTargetEmptyCounts({ users: 1, trips: 0 }), /not empty/);
  assert.doesNotThrow(() => assertTargetEmptyCounts({ users: 0, trips: 0 }));
});

test("importer verifies inside one serializable transaction before commit", () => {
  assert.match(importer, /202606230001_postgresql_baseline/);
  assert.match(importer, /202606230002_staging_cutover_receipt/);
  assert.match(importer, /server_version_num/);
  assert.match(importer, /pg_advisory_xact_lock/);
  assert.match(importer, /isolationLevel: "Serializable"/);
  assert.match(importer, /In-transaction target verification failed/);
  assert.match(importer, /--confirm=<bundle global checksum>/);
  assert.match(importer, /createMany/);
  assert.match(importer, /tx\.migrationReceipt\.create/);
});

test("staging runtime requires a verified receipt and does not replace SQLite default", () => {
  assert.match(runtimePrisma, /env\.DATABASE_PROVIDER === "sqlite"/);
  assert.match(runtimePrisma, /verifyPostgresRuntimeReceipt/);
  assert.match(runtimePrisma, /generated\/postgresql-client/);
  assert.match(runtimePrisma, /extendWithNumericDecimals/);
  assert.match(runtimePrisma, /rawClient\.migrationReceipt\.findUnique/);
});

test("PostgreSQL staging smoke rolls all test writes back and validates finance invariants", () => {
  assert.match(smoke, /throw ROLLBACK/);
  assert.match(smoke, /Database migration marker checksum does not match receipt/);
  assert.match(smoke, /Smoke-test transaction did not roll back/);
  assert.match(smoke, /Mark Paid changed Ready Money/);
  assert.match(smoke, /Payment ledger invariant failed/);
});

test("backend exposes controlled staging commands", () => {
  for (const command of [
    "db:postgres:staging:import",
    "db:postgres:staging:smoke",
    "db:cutover:source:backup",
    "db:rollback:sqlite:verify",
    "dev:postgres:staging",
  ]) assert.ok(backendPackage.scripts[command], `Missing ${command}`);
});


test("runtime safety blocks production and requires fingerprint/checksum parity", () => {
  assert.match(runtimeSafety, /PostgreSQL production runtime is blocked/);
  assert.match(runtimeSafety, /targetFingerprint !== postgresTargetFingerprint/);
  assert.match(runtimeSafety, /actualGlobalChecksum !== receipt\.bundleGlobalChecksum/);
  assert.match(runtimeSafety, /POSTGRES_VERIFICATION_RECEIPT is required/);
});

test("SQLite rollback backup preserves WAL companions and verifies every hash", () => {
  assert.match(sourceBackup, /Backend is reachable/);
  assert.match(sourceBackup, /SAFARYATY_SOURCE_WRITES_STOPPED/);
  assert.match(sourceBackup, /`\$\{source\}-wal`/);
  assert.match(sourceBackup, /`\$\{source\}-shm`/);
  assert.match(rollbackVerifier, /receipt\.files/);
  assert.match(rollbackVerifier, /hash mismatch/);
});
