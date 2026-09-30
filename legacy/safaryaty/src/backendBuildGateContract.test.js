import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const costProfile = readFileSync(new URL("../backend/src/modules/external/costProfile.adapter.ts", import.meta.url), "utf8");
const tripsRoutes = readFileSync(new URL("../backend/src/modules/trips/trips.routes.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../backend/src/app.ts", import.meta.url), "utf8");

test("external confidence is narrowed before ranking", () => {
  assert.match(costProfile, /function asExternalConfidence\(value: unknown\): ExternalConfidence/);
  assert.match(costProfile, /lowestConfidence\(confidence, asExternalConfidence\(fx\.confidence\)\)/);
  assert.doesNotMatch(costProfile, /lowestConfidence\(confidence, fx\.confidence\)/);
});

test("date field conversion preserves validated required fields", () => {
  assert.match(tripsRoutes, /function dateFields<T extends Record<string, any>>\(input: T, fields: readonly \(keyof T\)\[\]\): T/);
  assert.doesNotMatch(tripsRoutes, /const out: Record<string, any> = \{ \.\.\.input \}/);
});

test("trip create uses checked Prisma user relation when nesting finance profile", () => {
  assert.match(tripsRoutes, /user: \{ connect: \{ id: user\.id \} \}/);
  const createStart = tripsRoutes.indexOf('router.post("/"');
  const createEnd = tripsRoutes.indexOf('router.get("/:tripId"', createStart);
  const createBlock = tripsRoutes.slice(createStart, createEnd);
  assert.doesNotMatch(createBlock, /userId: user\.id/);
  assert.match(createBlock, /financeProfile: \{ create:/);
});

test("health endpoints expose the patch version", () => {
  const matches = app.match(/version: "4\.29\.52\.1"/g) || [];
  assert.equal(matches.length, 3);
});
