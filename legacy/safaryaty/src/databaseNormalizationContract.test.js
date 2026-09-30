import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("../backend/prisma/schema.prisma", import.meta.url), "utf8");
const routes = readFileSync(new URL("../backend/src/modules/trips/trips.routes.ts", import.meta.url), "utf8");
const mapper = readFileSync(new URL("../backend/src/modules/trips/finance.mapper.ts", import.meta.url), "utf8");
const currency = readFileSync(new URL("../backend/src/modules/finance/currency-context.service.ts", import.meta.url), "utf8");
const cashflow = readFileSync(new URL("../backend/src/modules/finance/cashflow.engine.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("./api.js", import.meta.url), "utf8");
const backfill = readFileSync(new URL("../backend/scripts/backfill-trip-finance-profiles.ts", import.meta.url), "utf8");

test("Prisma contains a one-to-one normalized finance profile", () => {
  assert.match(schema, /model TripFinanceProfile/);
  assert.match(schema, /tripId\s+String\s+@id/);
  assert.match(schema, /startingSavings\s+Float/);
  assert.match(schema, /supportMoney\s+Float/);
  assert.match(schema, /safetyReserve\s+Float/);
  assert.match(schema, /reserveEnabled\s+Boolean/);
  assert.match(schema, /returnWithZero\s+Boolean/);
  assert.match(schema, /financeProfile\s+TripFinanceProfile\?/);
});

test("new and patched trips dual-write the normalized profile", () => {
  assert.match(routes, /financeProfile:\s*\{\s*create:/);
  assert.match(routes, /financeProfile:\s*\{\s*upsert:/);
  assert.match(api, /financeProfile:\s*financeProfileFromClientTrip/);
});

test("finance snapshot sync and currency conversion both keep the profile current", () => {
  assert.match(mapper, /upsertTripFinanceProfile/);
  assert.match(currency, /upsertTripFinanceProfile/);
});

test("cashflow reads normalized profile first with legacy notes fallback", () => {
  assert.match(cashflow, /readFinanceSettingsFromTripRow/);
  assert.match(cashflow, /financeProfileSource/);
});

test("backfill is explicit, resumable, and checksum-aware", () => {
  assert.match(backfill, /--dry-run/);
  assert.match(backfill, /--force/);
  assert.match(backfill, /checksumMatch/);
  assert.match(backfill, /tripFinanceProfile\.upsert/);
});
