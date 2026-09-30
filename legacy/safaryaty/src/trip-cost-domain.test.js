import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalTripCategory,
  dedupeSuggestionsByCategory,
  normalizeTripCostFrequency,
  tripCostEffectiveTotal,
  tripCostOccurrenceDates,
  tripCostPaymentOccurrences
} from "../shared/trip-cost-domain.js";

const trip = { startDate: "2026-01-01", endDate: "2026-01-11" };

test("trip cost categories normalize legacy labels to canonical ids", () => {
  assert.equal(canonicalTripCategory("Food & Cafes"), "cat-food");
  assert.equal(canonicalTripCategory("Transportation"), "cat-transport");
  assert.equal(canonicalTripCategory("cat-emergency"), "cat-emergency");
});

test("trip-cost frequency keeps unit amount and computes effective total", () => {
  assert.equal(normalizeTripCostFrequency("DAILY"), "daily");
  assert.equal(tripCostEffectiveTotal({ amountLocal: 200, frequency: "daily" }, trip), 2000);
  assert.equal(tripCostEffectiveTotal({ amountLocal: 500, frequency: "weekly" }, trip), 1000);
});

test("daily costs aggregate into one payment row without losing calculation basis", () => {
  const dates = tripCostOccurrenceDates({ amountLocal: 200, frequency: "daily" }, trip);
  const rows = tripCostPaymentOccurrences({ amountLocal: 200, frequency: "daily" }, trip);
  assert.equal(dates.length, 10);
  assert.deepEqual(rows, [{ date: "2026-01-01", amount: 2000, units: 10, frequency: "daily" }]);
});

test("monthly occurrence stepping remains due-date based", () => {
  const dates = tripCostOccurrenceDates(
    { amountLocal: 5000, frequency: "monthly", nextDate: "2026-01-31" },
    { startDate: "2026-01-31", endDate: "2026-03-01" }
  );
  assert.deepEqual(dates, ["2026-01-31", "2026-02-28"]);
});

test("suggestions dedupe by canonical category and retain the newest row", () => {
  const rows = dedupeSuggestionsByCategory([
    { id: "old", category: "Food", updatedAt: "2026-01-01T00:00:00Z" },
    { id: "new", category: "cat-food", updatedAt: "2026-02-01T00:00:00Z" },
    { id: "transport", category: "Local Transport", updatedAt: "2026-01-05T00:00:00Z" }
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.categoryId === "cat-food")?.id, "new");
});
