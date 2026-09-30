import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync(new URL("../backend/src/modules/suggestions/suggestions.routes.ts", import.meta.url), "utf8");
const engine = readFileSync(new URL("../backend/src/modules/suggestions/suggestions.engine.ts", import.meta.url), "utf8");
const main = readFileSync(new URL("./main.jsx", import.meta.url), "utf8");
const api = readFileSync(new URL("./api.js", import.meta.url), "utf8");
const schema = readFileSync(new URL("../backend/prisma/schema.prisma", import.meta.url), "utf8");

test("suggestion generation reconciles existing rows instead of delete-and-recreate", () => {
  assert.match(routes, /presetSuggestion\.findMany/);
  assert.match(routes, /presetSuggestion\.update/);
  assert.doesNotMatch(routes, /deleteMany\(\{ where: \{ tripId: trip\.id, status: "PENDING"/);
});

test("applying a suggestion is transactional and never overwrites manual costs", () => {
  assert.match(routes, /prisma\.\$transaction/);
  assert.match(routes, /source: "SUGGESTION"/);
  assert.match(routes, /duplicateIds/);
});

test("removing an applied suggestion restores its pending state", () => {
  assert.match(routes, /suggestions\/:id\/restore/);
  assert.match(api, /restoreSuggestion/);
  assert.match(main, /api\.restoreSuggestion/);
});

test("frontend prevents double-click duplicate suggestion applications", () => {
  assert.match(main, /pendingCategories/);
  assert.match(main, /if \(selectedCategories\.has\(categoryId\) \|\| pendingCategories\[categoryId\]\) return/);
});

test("trip cost frequency truth supports daily weekly monthly and yearly", () => {
  assert.match(schema, /DAILY[\s\S]*WEEKLY[\s\S]*MONTHLY[\s\S]*YEARLY/);
  assert.match(engine, /TRIP_COST_CATEGORIES/);
  assert.doesNotMatch(engine, /minAmount: 2200/);
});
