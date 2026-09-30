import { createHash } from "node:crypto";

export const MIGRATION_BUNDLE_VERSION = 1;

export const TABLE_SPECS = Object.freeze([
  { name: "users", delegate: "user", idField: "id", money: {}, dateOnly: [] },
  { name: "sessions", delegate: "session", idField: "id", optional: true, money: {}, dateOnly: [] },
  { name: "trips", delegate: "trip", idField: "id", money: { exchangeRate: 10 }, dateOnly: ["departureDate", "returnDate"] },
  { name: "tripFinanceProfiles", delegate: "tripFinanceProfile", idField: "tripId", money: { startingSavings: 4, supportMoney: 4, safetyReserve: 4 }, dateOnly: [] },
  { name: "incomes", delegate: "income", idField: "id", money: { amount: 4 }, dateOnly: ["startDate", "endDate", "expectedDate"] },
  { name: "lifeCosts", delegate: "lifeCost", idField: "id", money: { amount: 4 }, dateOnly: ["startDate", "endDate", "dueDate"] },
  { name: "installments", delegate: "installment", idField: "id", money: { amount: 4 }, dateOnly: ["startDate", "endDate"] },
  { name: "tripCosts", delegate: "tripCost", idField: "id", money: { amount: 4 }, dateOnly: ["dueDate"] },
  { name: "expenses", delegate: "expense", idField: "id", money: { amount: 4, amountBase: 4 }, dateOnly: ["date"] },
  { name: "presetSuggestions", delegate: "presetSuggestion", idField: "id", money: { currentAmount: 4, suggestedAmount: 4, difference: 4 }, dateOnly: [] },
  { name: "paymentMarks", delegate: "paymentMark", idField: "id", money: {}, dateOnly: [] },
  { name: "externalDataSnapshots", delegate: "externalDataSnapshot", idField: "id", money: {}, dateOnly: [] },
]);

export const TABLE_BY_NAME = new Map(TABLE_SPECS.map((spec) => [spec.name, spec]));

function finiteNumber(value) {
  if (value == null || value === "") return 0;
  const number = Number(typeof value === "object" && value?.toString ? value.toString() : value);
  if (!Number.isFinite(number)) throw new Error(`Invalid numeric value: ${String(value)}`);
  return number;
}

export function decimalString(value, scale = 4) {
  return finiteNumber(value).toFixed(scale);
}

export function decimalToScaledBigInt(value, scale = 4) {
  const text = decimalString(value, scale);
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ""] = unsigned.split(".");
  const digits = `${whole}${fraction.padEnd(scale, "0").slice(0, scale)}`.replace(/^0+(?=\d)/, "") || "0";
  const result = BigInt(digits);
  return negative ? -result : result;
}

export function scaledBigIntToString(value, scale = 4) {
  const negative = value < 0n;
  const unsigned = negative ? -value : value;
  const padded = unsigned.toString().padStart(scale + 1, "0");
  const whole = padded.slice(0, -scale) || "0";
  const fraction = scale ? padded.slice(-scale) : "";
  return `${negative ? "-" : ""}${whole}${scale ? `.${fraction}` : ""}`;
}

function dateOnly(value) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date-only value: ${String(value)}`);
  return date.toISOString().slice(0, 10);
}

function timestamp(value) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid timestamp value: ${String(value)}`);
  return date.toISOString();
}

function normalizePrimitive(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (value && typeof value === "object" && value.constructor?.name === "Decimal") return value.toString();
  if (Array.isArray(value)) return value.map(normalizePrimitive);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalizePrimitive(child)]));
  }
  return value;
}

export function normalizeRecord(tableName, raw) {
  const spec = TABLE_BY_NAME.get(tableName);
  if (!spec) throw new Error(`Unknown migration table: ${tableName}`);
  const record = normalizePrimitive(raw);
  for (const [field, scale] of Object.entries(spec.money || {})) {
    if (record[field] != null) record[field] = decimalString(record[field], scale);
  }
  for (const field of spec.dateOnly || []) {
    if (record[field] != null) record[field] = dateOnly(record[field]);
  }
  for (const [field, value] of Object.entries(record)) {
    if (value == null || (spec.dateOnly || []).includes(field)) continue;
    if (/At$/.test(field) || field === "paidDate" || field === "revokedAt" || field === "expiresAt" || field === "sourceAsOf" || field === "fetchedAt" || field === "normalizedAt") {
      record[field] = timestamp(value);
    }
  }
  return record;
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
}

export function stableStringify(value) {
  return JSON.stringify(sortObject(value));
}

export function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : stableStringify(value)).digest("hex");
}

export function tableChecksum(rows) {
  return sha256(rows);
}

export function financialTotals(tableName, rows) {
  const spec = TABLE_BY_NAME.get(tableName);
  const totals = {};
  for (const [field, scale] of Object.entries(spec?.money || {})) {
    let total = 0n;
    for (const row of rows) total += decimalToScaledBigInt(row[field] ?? 0, scale);
    totals[field] = { scale, total: scaledBigIntToString(total, scale) };
  }
  return totals;
}

export function validateBundleRelations(data) {
  const errors = [];
  const users = new Set((data.users || []).map((row) => row.id));
  const trips = new Set((data.trips || []).map((row) => row.id));
  const ensureUnique = (rows, keyOf, label) => {
    const seen = new Set();
    for (const row of rows || []) {
      const key = keyOf(row);
      if (seen.has(key)) errors.push(`${label} duplicate: ${key}`);
      seen.add(key);
    }
  };

  for (const spec of TABLE_SPECS) ensureUnique(data[spec.name], (row) => row[spec.idField], `${spec.name}.${spec.idField}`);
  ensureUnique(data.users, (row) => String(row.email).toLowerCase(), "User.email");
  ensureUnique((data.users || []).filter((row) => row.googleId), (row) => row.googleId, "User.googleId");
  ensureUnique(data.sessions, (row) => row.tokenHash, "Session.tokenHash");
  ensureUnique(data.tripFinanceProfiles, (row) => row.tripId, "TripFinanceProfile.tripId");
  ensureUnique(data.paymentMarks, (row) => `${row.tripId}:${row.paymentKey}`, "PaymentMark occurrence");
  ensureUnique(data.externalDataSnapshots, (row) => `${row.provider}:${row.resourceType}:${row.resourceKey}`, "ExternalDataSnapshot resource");

  for (const row of data.trips || []) if (!users.has(row.userId)) errors.push(`Trip ${row.id} references missing User ${row.userId}`);
  for (const row of data.sessions || []) if (!users.has(row.userId)) errors.push(`Session ${row.id} references missing User ${row.userId}`);
  const profileTrips = new Set((data.tripFinanceProfiles || []).map((row) => row.tripId));
  for (const trip of data.trips || []) if (!profileTrips.has(trip.id)) errors.push(`Trip ${trip.id} has no normalized TripFinanceProfile`);

  for (const table of ["tripFinanceProfiles", "incomes", "lifeCosts", "installments", "tripCosts", "expenses", "presetSuggestions", "paymentMarks"]) {
    for (const row of data[table] || []) {
      if (!trips.has(row.tripId)) errors.push(`${table} ${row.id || row.tripId} references missing Trip ${row.tripId}`);
    }
  }

  const currencyFields = {
    users: ["preferredCurrency"], trips: ["incomeCurrency", "tripCurrency", "displayCurrency"],
    incomes: ["currency"], lifeCosts: ["currency"], installments: ["currency"],
    tripCosts: ["currency"], expenses: ["currency"], presetSuggestions: ["currency"],
  };
  for (const [table, fields] of Object.entries(currencyFields)) {
    for (const row of data[table] || []) for (const field of fields) {
      if (row[field] != null && !/^[A-Z]{3}$/.test(String(row[field]))) errors.push(`${table}.${field} invalid for ${row.id || row.tripId}`);
    }
  }

  for (const trip of data.trips || []) {
    if (Number(trip.travelers) <= 0) errors.push(`Trip ${trip.id} has invalid travelers`);
    if (Number(trip.exchangeRate) <= 0) errors.push(`Trip ${trip.id} has invalid exchangeRate`);
    if (trip.departureDate && trip.returnDate && trip.returnDate < trip.departureDate) errors.push(`Trip ${trip.id} returnDate precedes departureDate`);
  }
  for (const table of ["incomes", "lifeCosts", "installments"]) {
    for (const row of data[table] || []) if (row.startDate && row.endDate && row.endDate < row.startDate) errors.push(`${table} ${row.id} endDate precedes startDate`);
  }

  for (const [table, spec] of TABLE_BY_NAME.entries()) {
    for (const row of data[table] || []) {
      for (const field of Object.keys(spec.money || {})) {
        if (Number(row[field]) < 0 && !(table === "presetSuggestions" && field === "difference")) {
          errors.push(`${table}.${field} is negative for ${row[spec.idField]}`);
        }
      }
    }
  }
  return errors;
}

export function buildManifest(data, options = {}) {
  const tables = {};
  for (const spec of TABLE_SPECS) {
    const rows = data[spec.name] || [];
    tables[spec.name] = {
      count: rows.length,
      checksum: tableChecksum(rows),
      financialTotals: financialTotals(spec.name, rows),
    };
  }
  const relationErrors = validateBundleRelations(data);
  return {
    formatVersion: MIGRATION_BUNDLE_VERSION,
    appVersion: options.appVersion || null,
    sourceProvider: options.sourceProvider || "sqlite",
    targetProvider: "postgresql",
    exportedAt: options.exportedAt || new Date().toISOString(),
    sessionsIncluded: Boolean(options.sessionsIncluded),
    tables,
    relationValidation: { ok: relationErrors.length === 0, errors: relationErrors },
    globalChecksum: sha256(Object.fromEntries(Object.entries(tables).map(([name, summary]) => [name, summary.checksum]))),
  };
}

export function compareManifest(expected, actual) {
  const errors = [];
  if (expected.formatVersion !== actual.formatVersion) errors.push(`formatVersion ${actual.formatVersion} != ${expected.formatVersion}`);
  for (const spec of TABLE_SPECS) {
    const left = expected.tables?.[spec.name];
    const right = actual.tables?.[spec.name];
    if (!left || !right) { errors.push(`Missing table summary: ${spec.name}`); continue; }
    if (left.count !== right.count) errors.push(`${spec.name} count ${right.count} != ${left.count}`);
    if (left.checksum !== right.checksum) errors.push(`${spec.name} checksum mismatch`);
    if (stableStringify(left.financialTotals) !== stableStringify(right.financialTotals)) errors.push(`${spec.name} financial totals mismatch`);
  }
  if (expected.globalChecksum !== actual.globalChecksum) errors.push("Global checksum mismatch");
  return errors;
}
