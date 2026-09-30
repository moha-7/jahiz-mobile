import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { TABLE_SPECS, buildManifest, compareManifest } from "./migration-bundle.mjs";

export const POSTGRES_STAGING_ACK = "SAFARYATY_POSTGRES_STAGING_VERIFIED";
export const MAX_DEFAULT_IMPORT_ROWS = 100_000;
export const DEFAULT_BATCH_SIZE = 250;

const DATE_ONLY_FIELDS = new Map(TABLE_SPECS.map((spec) => [spec.name, new Set(spec.dateOnly || [])]));
const MONEY_FIELDS = new Map(TABLE_SPECS.map((spec) => [spec.name, new Map(Object.entries(spec.money || {}))]));

export function sanitizedTargetIdentity(rawUrl) {
  const parsed = new URL(rawUrl);
  const schema = parsed.searchParams.get("schema") || "public";
  const port = parsed.port || (parsed.protocol === "postgresql:" || parsed.protocol === "postgres:" ? "5432" : "");
  return {
    protocol: parsed.protocol.replace(":", ""),
    host: parsed.hostname,
    port,
    database: parsed.pathname.replace(/^\//, ""),
    schema,
  };
}

export function targetFingerprint(rawUrl) {
  const identity = sanitizedTargetIdentity(rawUrl);
  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}

export function cutoverGuard(input = {}) {
  const errors = [];
  if (!input.postgresUrl) errors.push("POSTGRES_DATABASE_URL is required");
  if (input.nodeEnv === "production") errors.push("v4.29.51 blocks production cutover; staging only");
  if (input.targetKind !== "staging") errors.push("POSTGRES_TARGET_KIND must equal staging");
  if (input.ack !== POSTGRES_STAGING_ACK) errors.push(`POSTGRES_STAGING_ACK must equal ${POSTGRES_STAGING_ACK}`);
  if (input.execute && !input.confirmChecksum) errors.push("--confirm=<bundle global checksum> is required for execution");
  if (input.execute && input.expectedChecksum && input.confirmChecksum !== input.expectedChecksum) errors.push("Confirmation checksum does not match bundle manifest");
  return errors;
}

export function materializePostgresRecord(tableName, raw) {
  const dateOnly = DATE_ONLY_FIELDS.get(tableName) || new Set();
  const money = MONEY_FIELDS.get(tableName) || new Map();
  const record = {};
  for (const [field, value] of Object.entries(raw || {})) {
    if (value == null) {
      record[field] = null;
      continue;
    }
    if (money.has(field)) {
      record[field] = String(value);
      continue;
    }
    if (dateOnly.has(field)) {
      const text = String(value).slice(0, 10);
      record[field] = new Date(`${text}T00:00:00.000Z`);
      continue;
    }
    if (/At$/.test(field) || field === "paidDate" || field === "revokedAt" || field === "expiresAt" || field === "sourceAsOf" || field === "fetchedAt" || field === "normalizedAt") {
      record[field] = new Date(value);
      continue;
    }
    record[field] = value;
  }
  return record;
}

export function buildImportPlan(data, options = {}) {
  const batchSize = Math.max(1, Number(options.batchSize || DEFAULT_BATCH_SIZE));
  const steps = [];
  let totalRows = 0;
  for (const spec of TABLE_SPECS) {
    const rows = spec.name === "sessions" && !options.sessionsIncluded ? [] : (data[spec.name] || []);
    totalRows += rows.length;
    const batches = [];
    for (let offset = 0; offset < rows.length; offset += batchSize) {
      batches.push(rows.slice(offset, offset + batchSize).map((row) => materializePostgresRecord(spec.name, row)));
    }
    steps.push({ ...spec, count: rows.length, batches });
  }
  return { totalRows, batchSize, steps };
}

export function assertTargetEmptyCounts(counts) {
  const occupied = Object.entries(counts || {}).filter(([, count]) => Number(count) > 0);
  if (occupied.length) {
    throw new Error(`PostgreSQL target is not empty: ${occupied.map(([table, count]) => `${table}=${count}`).join(", ")}`);
  }
}

export async function readMigrationBundle(bundleDir) {
  const directory = resolve(bundleDir);
  const expected = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8"));
  const data = {};
  for (const spec of TABLE_SPECS) {
    data[spec.name] = JSON.parse(await readFile(resolve(directory, `${spec.name}.json`), "utf8"));
  }
  const actual = buildManifest(data, {
    appVersion: expected.appVersion,
    sourceProvider: expected.sourceProvider,
    sessionsIncluded: expected.sessionsIncluded,
    exportedAt: expected.exportedAt,
  });
  const errors = [...compareManifest(expected, actual), ...(actual.relationValidation.errors || [])];
  return { directory, expected, actual, data, errors };
}

export async function writeCutoverReport(path, report) {
  const destination = resolve(path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return destination;
}

export function defaultReceiptPath(bundleDir, checksum) {
  return resolve(process.cwd(), "migration-reports", `postgres-staging-${basename(bundleDir)}-${String(checksum).slice(0, 12)}.json`);
}
