import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  TABLE_SPECS,
  buildManifest,
  compareManifest,
  normalizeRecord,
  validateBundleRelations,
} from "../backend/scripts/lib/migration-bundle.mjs";

const sqliteSchema = readFileSync(new URL("../backend/prisma/schema.prisma", import.meta.url), "utf8");
const postgresSchema = readFileSync(new URL("../backend/prisma/postgresql/schema.prisma", import.meta.url), "utf8");
const baseline = readFileSync(new URL("../backend/prisma/postgresql/migrations/202606230001_postgresql_baseline/migration.sql", import.meta.url), "utf8");
const receiptMigration = readFileSync(new URL("../backend/prisma/postgresql/migrations/202606230002_staging_cutover_receipt/migration.sql", import.meta.url), "utf8");
const backendPackage = JSON.parse(readFileSync(new URL("../backend/package.json", import.meta.url), "utf8"));

function modelNames(schema) {
  return [...schema.matchAll(/model\s+(\w+)\s*\{/g)].map((match) => match[1]).sort();
}

function emptyBundle() {
  return Object.fromEntries(TABLE_SPECS.map((spec) => [spec.name, []]));
}

test("PostgreSQL target preserves every application model plus one operational receipt", () => {
  const sourceModels = modelNames(sqliteSchema);
  const targetModels = modelNames(postgresSchema);
  for (const model of sourceModels) assert.ok(targetModels.includes(model), `Missing PostgreSQL model ${model}`);
  assert.deepEqual(targetModels.filter((model) => !sourceModels.includes(model)), ["MigrationReceipt"]);
  assert.match(postgresSchema, /provider\s*=\s*"postgresql"/);
  assert.match(postgresSchema, /POSTGRES_DATABASE_URL/);
});

test("PostgreSQL money strategy removes Float from target schema", () => {
  assert.doesNotMatch(postgresSchema, /\bFloat\b/);
  assert.match(postgresSchema, /exchangeRate\s+Decimal\s+@default\(1\)\s+@db\.Decimal\(20, 10\)/);
  assert.match(postgresSchema, /startingSavings\s+Decimal\s+@default\(0\)\s+@db\.Decimal\(19, 4\)/);
  assert.match(postgresSchema, /amountBase\s+Decimal\s+@db\.Decimal\(19, 4\)/);
});

test("PostgreSQL distinguishes planning dates from audit timestamps", () => {
  assert.match(postgresSchema, /departureDate\s+DateTime\?\s+@db\.Date/);
  assert.match(postgresSchema, /dueDate\s+DateTime\?\s+@db\.Date/);
  assert.match(postgresSchema, /createdAt\s+DateTime\s+@default\(now\(\)\)\s+@db\.Timestamptz\(3\)/);
  assert.match(postgresSchema, /paidDate\s+DateTime\?\s+@db\.Timestamptz\(3\)/);
});

test("PostgreSQL baseline includes financial checks and payment uniqueness", () => {
  assert.match(baseline, /DECIMAL\(19,4\)/);
  assert.match(baseline, /CONSTRAINT "Trip_exchangeRate_check" CHECK \("exchangeRate" > 0\)/);
  assert.match(baseline, /CONSTRAINT "Trip_date_order_check"/);
  assert.match(baseline, /CREATE UNIQUE INDEX "PaymentMark_tripId_paymentKey_key"/);
  assert.match(baseline, /CREATE INDEX "Trip_userId_status_updatedAt_idx"/);
  assert.doesNotMatch(baseline, /CREATE TABLE "MigrationReceipt"/);
  assert.match(receiptMigration, /CREATE TABLE "MigrationReceipt"/);
  assert.match(receiptMigration, /MigrationReceipt_bundleChecksum_check/);
});

test("migration bundle normalizes money and date-only values", () => {
  const record = normalizeRecord("trips", {
    id: "trip-1",
    userId: "user-1",
    travelers: 1,
    exchangeRate: 13.66991234567,
    departureDate: new Date("2026-07-01T19:00:00.000Z"),
    returnDate: new Date("2026-07-10T01:00:00.000Z"),
    createdAt: new Date("2026-01-01T10:30:00.000Z"),
  });
  assert.equal(record.exchangeRate, "13.6699123457");
  assert.equal(record.departureDate, "2026-07-01");
  assert.equal(record.returnDate, "2026-07-10");
  assert.equal(record.createdAt, "2026-01-01T10:30:00.000Z");
});

test("migration manifest catches relational and financial drift", () => {
  const data = emptyBundle();
  data.users = [{ id: "u1", email: "one@example.com" }];
  data.trips = [{ id: "t1", userId: "u1", travelers: 1, exchangeRate: "1.0000000000" }];
  data.tripFinanceProfiles = [{ tripId: "t1", startingSavings: "100.0000", supportMoney: "20.0000", safetyReserve: "10.0000" }];
  data.tripCosts = [{ id: "c1", tripId: "t1", amount: "50.0000" }];
  data.paymentMarks = [{ id: "p1", tripId: "t1", paymentKey: "cost-c1-0" }];

  assert.deepEqual(validateBundleRelations(data), []);
  const manifest = buildManifest(data, { appVersion: "4.29.50", exportedAt: "2026-06-23T00:00:00.000Z" });
  const tampered = structuredClone(data);
  tampered.tripCosts[0].amount = "51.0000";
  const changed = buildManifest(tampered, { appVersion: "4.29.50", exportedAt: "2026-06-23T00:00:00.000Z" });
  assert.ok(compareManifest(manifest, changed).some((item) => item.includes("tripCosts")));
});

test("backend exposes PostgreSQL readiness commands without replacing SQLite", () => {
  assert.match(sqliteSchema, /provider\s*=\s*"sqlite"/);
  assert.equal(backendPackage.scripts["db:postgres:audit"], "node scripts/audit-postgresql-readiness.mjs");
  assert.match(backendPackage.scripts["prisma:postgres:generate"], /postgresql\/schema\.prisma/);
  assert.match(backendPackage.scripts["db:migration:bundle:export"], /export-postgresql-migration-bundle/);
  assert.match(backendPackage.scripts["db:postgres:target:verify"], /verify-postgresql-target/);
});
